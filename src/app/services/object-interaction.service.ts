import { Injectable } from '@angular/core';
import {
  AlwaysStencilFunc,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Material,
  KeepStencilOp,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import {
  InteractionResult,
  ObjectInfo,
  RoomLimits,
} from '../interfaces/scene.interface';

/** Mínimo que necesita el servicio de un evento de puntero/ratón. */
export interface PointerLike {
  clientX: number;
  clientY: number;
  target?: EventTarget | null;
  currentTarget?: EventTarget | null;
  /** 'touch' activa la tolerancia táctil de `handleClick`. */
  pointerType?: string;
}

/** Opciones de `handleClick`. */
export interface ClickOptions {
  /** Anula `event.pointerType`. */
  pointerType?: string;
  /** Tolerancia en px CSS; por defecto 14 con toque y 0 con ratón/lápiz. */
  tolerancePx?: number;
}

/** Tolerancia por defecto del toque (px CSS) y rayos por anillo. */
export const TOUCH_TOLERANCE_PX = 14;
const TOLERANCE_RINGS = [0.5, 1];
const TOLERANCE_RAYS = 8;

/** Objeto bajo el cursor; `name` sirve de id para el cursor/UI. */
export interface HoverTarget {
  object: Object3D;
  info: ObjectInfo;
}

const OUTLINE_NAME = '__selection-outline';
const OUTLINE_COLOR = 0x2f8fa8;
const OUTLINE_PULSE_COLOR = 0x8fe3f5;
const OUTLINE_PULSE_AMPLITUDE = 0.5;
const OUTLINE_PULSE_SPEED = 0.003;
/** Grosor del contorno en px CSS: constante en pantalla, sea cual sea el mueble o la distancia. */
export const OUTLINE_THICKNESS_PX = 3;
/**
 * Empuje (m) del casco hacia el fondo: oculta los destellos de caras traseras
 * interiores. Debe ser muy pequeño: con valores de centímetros el casco queda
 * tras la propia malla o la pared y el contorno desaparece (estantería).
 */
export const OUTLINE_DEPTH_PUSH = 0;
/** Sesgo de profundidad (negativo = hacia la cámara): gana el empate con paredes/suelo pegados al mueble. */
export const OUTLINE_POLYGON_OFFSET = -1;
/** Unidades de `polygonOffset`: sesgo suave; el stencil ya oculta el casco dentro de la silueta. */
export const OUTLINE_POLYGON_UNITS = -4;
/** Atributo con normales suavizadas (por posición) que guía la extrusión del contorno. */
export const OUTLINE_NORMAL_ATTRIBUTE = 'outlineNormal';
/** Hover: contorno fino y semitransparente; no toca los materiales del mueble. */
const HOVER_OUTLINE_NAME = '__hover-outline';
const HOVER_OUTLINE_COLOR = 0x8fc9d8;
export const HOVER_OUTLINE_THICKNESS_PX = 1.75;
export const HOVER_OUTLINE_OPACITY = 0.7;
const TELEPORT_MARGIN = 1.5;
const TELEPORT_MAX_CLAMP = 2;

function isTranslucentMaterial(m: Material): boolean {
  return m.transparent || m.opacity < 1;
}

/**
 * Mallas transparentes (vasos, cristal): su casco se vería a través y las
 * rellenaría. Con material array solo cuenta si TODAS sus partes lo son; si es
 * mixto, el casco se pinta y `outlineGroups` excluye las partes translúcidas.
 */
export function isTranslucent(mesh: Mesh): boolean {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return list.length > 0 && list.every(isTranslucentMaterial);
}

/** Valores de stencil de un material, para restaurarlos al quitar el contorno. */
type StencilBackup = Map<
  Material,
  {
    stencilWrite: boolean;
    stencilRef: number;
    stencilFunc: number;
    stencilZPass: number;
  }
>;

/** Referencia de stencil que marca la silueta del mueble. */
export const OUTLINE_STENCIL_REF = 1;
/** Orden de render del casco: después de todo lo opaco. */
export const OUTLINE_RENDER_ORDER = 10;

/** Los materiales opacos del objeto escriben stencil=1 donde se dibujan. No toca color/emissive/map. */
function writeStencil(root: Object3D): StencilBackup {
  const backup: StencilBackup = new Map();
  root.traverse(child => {
    const mesh = child as Mesh;
    if (
      !mesh.isMesh ||
      child.name === OUTLINE_NAME ||
      child.name === HOVER_OUTLINE_NAME
    )
      return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (isTranslucentMaterial(m) || backup.has(m)) continue;
      backup.set(m, {
        stencilWrite: m.stencilWrite,
        stencilRef: m.stencilRef,
        stencilFunc: m.stencilFunc,
        stencilZPass: m.stencilZPass,
      });
      m.stencilWrite = true;
      m.stencilRef = OUTLINE_STENCIL_REF;
      m.stencilFunc = AlwaysStencilFunc;
      m.stencilZPass = ReplaceStencilOp;
    }
  });
  return backup;
}

function restoreStencil(backup: StencilBackup | null): void {
  backup?.forEach((saved, m) => Object.assign(m, saved));
}

/** Grupos de geometría opacos de un material array (null = toda la malla). */
export function outlineGroups(
  mesh: Mesh
): { start: number; count: number }[] | null {
  if (!Array.isArray(mesh.material)) return null;
  const materials = mesh.material;
  if (!materials.some(isTranslucentMaterial)) return null;
  return mesh.geometry.groups
    .filter(
      g =>
        g.materialIndex !== undefined &&
        !isTranslucentMaterial(materials[g.materialIndex])
    )
    .map(g => ({ start: g.start, count: g.count }));
}

/**
 * Añade (una sola vez) normales suavizadas: la suma ponderada por área de las
 * normales de cara de todos los vértices que comparten posición. Con normales
 * partidas (aristas duras) el casco invertido se abriría en grietas.
 */
export function ensureOutlineNormals(geometry: BufferGeometry): void {
  if (geometry.getAttribute(OUTLINE_NORMAL_ATTRIBUTE)) return;
  const position = geometry.getAttribute('position');
  if (!position) return;
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const key = (i: number) =>
    `${Math.round(position.getX(i) * 1e4)}_${Math.round(position.getY(i) * 1e4)}_${Math.round(position.getZ(i) * 1e4)}`;
  const sums = new Map<string, Vector3>();
  const keys: string[] = new Array(position.count);
  for (let i = 0; i < position.count; i++) keys[i] = key(i);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i + 2 < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(position, i0);
    b.fromBufferAttribute(position, i1).sub(a);
    c.fromBufferAttribute(position, i2).sub(a);
    b.cross(c); // longitud = 2 × área: pondera la contribución
    for (const v of [i0, i1, i2]) {
      let sum = sums.get(keys[v]);
      if (!sum) sums.set(keys[v], (sum = new Vector3()));
      sum.add(b);
    }
  }
  const data = new Float32Array(position.count * 3);
  const n = new Vector3();
  for (let i = 0; i < position.count; i++) {
    n.copy(sums.get(keys[i]) ?? n.set(0, 1, 0)).normalize();
    data[i * 3] = n.x;
    data[i * 3 + 1] = n.y;
    data[i * 3 + 2] = n.z;
  }
  geometry.setAttribute(OUTLINE_NORMAL_ATTRIBUTE, new BufferAttribute(data, 3));
}

@Injectable({
  providedIn: 'root',
})
export class ObjectInteractionService {
  private readonly raycaster = new Raycaster();
  private readonly objects = new Map<Object3D, ObjectInfo>();
  private roomLimits: RoomLimits = {
    minX: -8,
    maxX: 8,
    minZ: -8,
    maxZ: 8,
  };

  private canvas: HTMLElement | null = null;
  private camera: PerspectiveCamera | null = null;
  private scene: Scene | null = null;

  private outline: Group | null = null;
  private outlineMaterial: MeshBasicMaterial | null = null;
  /** Desplazamiento del contorno en NDC (se actualiza con el tamaño del canvas). */
  private readonly outlineOffset = { value: new Vector2(0.01, 0.01) };
  private hoverOutline: Group | null = null;
  private hoverMaterial: MeshBasicMaterial | null = null;
  /** Estado de stencil original de los materiales del objeto (seleccionado / hover). */
  private selectedStencil: StencilBackup | null = null;
  private hoverStencil: StencilBackup | null = null;
  private readonly ownedGeometries = new WeakSet<BufferGeometry>();
  private readonly hoverOffset = { value: new Vector2(0.01, 0.01) };
  /** Tamaño del canvas en px CSS, cacheado (evita `getBoundingClientRect` por frame). */
  private canvasSize: { width: number; height: number } | null = null;
  private selected: Object3D | null = null;

  private pendingHover: Vector2 | null = null;
  private hoverDirty = false;
  private hovered: HoverTarget | null = null;
  private readonly pulseColor = new Color(OUTLINE_PULSE_COLOR);

  /** Notificación opcional de cambios de hover (F4b la conecta a señales). */
  onHoverChange: ((target: HoverTarget | null) => void) | null = null;

  setRoomLimits(limits: RoomLimits): void {
    this.roomLimits = limits;
  }

  /** Elemento cuyo rectángulo define las coordenadas NDC (el canvas). */
  setCanvas(canvas: HTMLElement | null): void {
    this.canvas = canvas;
    this.canvasSize = null;
  }

  /** Tamaño actual del canvas (px CSS); SceneService lo actualiza al redimensionar. */
  setCanvasSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.canvasSize = { width, height };
    this.outlineOffset.value.set(
      (2 * OUTLINE_THICKNESS_PX) / width,
      (2 * OUTLINE_THICKNESS_PX) / height
    );
    this.hoverOffset.value.set(
      (2 * HOVER_OUTLINE_THICKNESS_PX) / width,
      (2 * HOVER_OUTLINE_THICKNESS_PX) / height
    );
  }

  /** Cámara y escena usadas por el hover (el clic las recibe por parámetro). */
  setContext(camera: PerspectiveCamera, scene: Scene): void {
    this.camera = camera;
    this.scene = scene;
  }

  async handleClick(
    event: PointerLike,
    camera: PerspectiveCamera,
    scene: Scene,
    options: ClickOptions = {}
  ): Promise<InteractionResult> {
    try {
      this.setContext(camera, scene);
      const ndc = this.getMousePosition(event);
      const intersects = this.intersect(ndc, camera, scene);

      this.clearSelection();

      const tolerance = this.tolerancePx(event, options);
      if (tolerance > 0 && !this.hitsFurnitureFirst(intersects)) {
        const near = this.nearbyFurniture(event, tolerance, camera, scene);
        if (near) {
          this.select(near.root);
          return { objectInfo: near.info, success: true, object: near.root };
        }
      }

      for (const intersect of intersects) {
        const object = intersect.object;

        if (this.isFloorClick(object)) {
          const floorPoint = this.validateTeleportationPosition(
            intersect.point
          );
          if (floorPoint) {
            return { objectInfo: null, success: true, floorPoint };
          }
          continue;
        }

        const root = this.findRootObject(object);
        const objectInfo = root ? this.objects.get(root) : undefined;
        if (root && objectInfo) {
          this.select(root);
          return { objectInfo, success: true, object: root };
        }
      }

      return { objectInfo: null, success: true };
    } catch (error) {
      return {
        objectInfo: null,
        success: false,
        error: error instanceof Error ? error.message : 'Interaction failed',
      };
    }
  }

  /** Toque (o tolerancia explícita) → radio en px CSS; ratón/lápiz → 0. */
  private tolerancePx(event: PointerLike, options: ClickOptions): number {
    if (options.tolerancePx !== undefined)
      return Math.max(0, options.tolerancePx);
    const type = options.pointerType ?? event.pointerType;
    return type === 'touch' ? TOUCH_TOLERANCE_PX : 0;
  }

  /** ¿El primer impacto relevante (mueble o suelo) es un mueble? */
  private hitsFurnitureFirst(
    hits: ReturnType<ObjectInteractionService['intersect']>
  ): boolean {
    return this.firstFurniture(hits) !== null;
  }

  /** Mueble alcanzado antes que el suelo (las paredes no bloquean, como en el clic). */
  private firstFurniture(
    hits: ReturnType<ObjectInteractionService['intersect']>
  ): { root: Object3D; info: ObjectInfo } | null {
    for (const hit of hits) {
      if (this.isFloorClick(hit.object)) return null;
      const root = this.findRootObject(hit.object);
      const info = root ? this.objects.get(root) : undefined;
      if (root && info) return { root, info };
    }
    return null;
  }

  /** Anillos de rayos alrededor del punto; gana el mueble del anillo más cercano. */
  private nearbyFurniture(
    event: PointerLike,
    tolerancePx: number,
    camera: PerspectiveCamera,
    scene: Scene
  ): { root: Object3D; info: ObjectInfo } | null {
    const base = this.getMousePosition(event);
    const element = this.canvas ?? (event.currentTarget as HTMLElement);
    const rect = element.getBoundingClientRect();
    for (const ring of TOLERANCE_RINGS) {
      const radius = tolerancePx * ring;
      for (let i = 0; i < TOLERANCE_RAYS; i++) {
        const angle = (i / TOLERANCE_RAYS) * Math.PI * 2;
        const ndc = new Vector2(
          base.x + ((Math.cos(angle) * radius) / rect.width) * 2,
          base.y - ((Math.sin(angle) * radius) / rect.height) * 2
        );
        const found = this.firstFurniture(this.intersect(ndc, camera, scene));
        if (found) return found;
      }
    }
    return null;
  }

  /** Coordenadas NDC respecto al rectángulo del canvas (no de `event.target`). */
  getMousePosition(event: PointerLike): Vector2 {
    const element =
      this.canvas ??
      (event.currentTarget as HTMLElement | null) ??
      (event.target as HTMLElement | null);
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      throw new Error('No element available to compute pointer position');
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      throw new Error('Canvas has no size');
    }
    return new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  /** Marca la posición del puntero; se resuelve como mucho una vez por frame. */
  setHover(ndc: { x: number; y: number } | null): void {
    this.pendingHover = ndc ? new Vector2(ndc.x, ndc.y) : null;
    this.hoverDirty = true;
  }

  /** Llamar una vez por frame desde el bucle de F4b (sin rAF propio). */
  update(timeMs: number): void {
    if (this.outlineMaterial) {
      // Pulso de color (el contorno es opaco: sin velo translúcido sobre el objeto).
      const t =
        ((Math.sin(timeMs * OUTLINE_PULSE_SPEED) + 1) / 2) *
        OUTLINE_PULSE_AMPLITUDE;
      this.outlineMaterial.color.setHex(OUTLINE_COLOR).lerp(this.pulseColor, t);
    }
    if (this.hoverDirty) {
      this.hoverDirty = false;
      this.resolveHover();
    }
  }

  getHovered(): HoverTarget | null {
    return this.hovered;
  }

  getSelected(): Object3D | null {
    return this.selected;
  }

  /** Quita el contorno actual y libera su material. */
  removeOutline(): void {
    if (this.outline) {
      // La geometría es compartida con el original: solo se liberan los clones.
      this.outline.removeFromParent();
      this.disposeHullGeometries(this.outline);
      this.outline.clear();
      this.outline = null;
    }
    restoreStencil(this.selectedStencil);
    this.selectedStencil = null;
    if (this.outlineMaterial) {
      this.outlineMaterial.dispose();
      this.outlineMaterial = null;
    }
    this.selected = null;
    this.hoverDirty = true; // re-evalúa el hover (el objeto ya no está seleccionado)
  }

  clearSelection(): void {
    this.removeOutline();
  }

  /** Selecciona un objeto por código: sustituye el contorno anterior. */
  selectObject(object: Object3D): void {
    this.removeOutline();
    this.select(object);
  }

  addObject(object: Object3D, info: ObjectInfo): void {
    this.objects.set(object, info);
  }

  removeObject(object: Object3D): void {
    this.objects.delete(object);
    if (this.selected === object) this.removeOutline();
    if (this.hovered?.object === object) this.applyHover(null);
  }

  getObjectInfo(object: Object3D): ObjectInfo | undefined {
    return this.objects.get(object);
  }

  dispose(): void {
    this.removeOutline();
    this.removeHoverOutline();
    this.hoverMaterial?.dispose();
    this.hoverMaterial = null;
    this.hovered = null;
    this.pendingHover = null;
    this.hoverDirty = false;
    this.onHoverChange = null;
    this.objects.clear();
    this.canvas = null;
    this.camera = null;
    this.scene = null;
  }

  // ---- privado ----

  private intersect(ndc: Vector2, camera: PerspectiveCamera, scene: Scene) {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, camera);
    return this.raycaster
      .intersectObjects(scene.children, true)
      .filter(hit => !this.isOutline(hit.object));
  }

  private isOutline(object: Object3D): boolean {
    let current: Object3D | null = object;
    while (current) {
      if (current.name === OUTLINE_NAME || current.name === HOVER_OUTLINE_NAME)
        return true;
      current = current.parent;
    }
    return false;
  }

  private isFloorClick(object: Object3D): boolean {
    return object.name === 'floor';
  }

  private select(root: Object3D): void {
    this.selected = root;
    this.ensureCanvasSize();
    // Al seleccionar, el contorno de hover se retira (el de selección lo sustituye).
    this.removeHoverOutline();
    this.outlineMaterial = this.createOutlineMaterial(
      { color: OUTLINE_COLOR },
      this.outlineOffset,
      'selection-outline'
    );
    this.selectedStencil = writeStencil(root);
    this.outline = this.buildOutline(root, this.outlineMaterial, OUTLINE_NAME);
  }

  /** Grupo de cascos (uno por malla opaca) como hijo de `root`: hereda su transformación. */
  private buildOutline(
    root: Object3D,
    material: MeshBasicMaterial,
    name: string
  ): Group {
    const outline = new Group();
    outline.name = name;
    root.updateMatrixWorld(true);
    const rootInverse = root.matrixWorld.clone().invert();
    const meshes: Mesh[] = [];
    root.traverse(child => {
      if (
        (child as Mesh).isMesh &&
        !this.isOutline(child) &&
        !isTranslucent(child as Mesh)
      ) {
        meshes.push(child as Mesh);
      }
    });
    for (const mesh of meshes) {
      ensureOutlineNormals(mesh.geometry);
      const groups = outlineGroups(mesh);
      let geometry = mesh.geometry;
      if (groups) {
        // Material mixto: casco solo sobre las partes opacas.
        geometry = geometry.clone();
        this.ownedGeometries.add(geometry);
        geometry.clearGroups();
        const index = mesh.geometry.getIndex();
        const source = index ? Array.from(index.array) : null;
        const picked: number[] = [];
        for (const g of groups)
          for (let i = g.start; i < g.start + g.count; i++)
            picked.push(source ? source[i] : i);
        geometry.setIndex(picked);
      }
      const clone = new Mesh(geometry, material);
      clone.renderOrder = OUTLINE_RENDER_ORDER;
      clone.raycast = () => undefined;
      clone.matrixAutoUpdate = false;
      clone.matrix.copy(rootInverse).multiply(mesh.matrixWorld);
      clone.matrixWorldNeedsUpdate = true;
      outline.add(clone);
    }
    outline.raycast = () => undefined;
    root.add(outline);
    return outline;
  }

  /**
   * Casco invertido (BackSide) cuyos vértices se desplazan en espacio de clip
   * `OUTLINE_THICKNESS_PX` píxeles a lo largo de la normal suavizada proyectada:
   * grosor constante en pantalla, sin escalar la malla (no se desplaza ni engorda
   * en piezas con el origen lejos de su centro).
   */
  private createOutlineMaterial(
    params: { color: number; opacity?: number },
    offset: { value: Vector2 },
    cacheKey: string
  ): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      ...params,
      transparent: params.opacity !== undefined,
      // Sin test de profundidad: el stencil ya evita pintar dentro de la silueta, así
      // el borde se ve completo aunque la pared lo tape (mueble pegado a ella).
      depthTest: false,
      depthWrite: false,
      side: BackSide,
      polygonOffset: true,
      polygonOffsetFactor: OUTLINE_POLYGON_OFFSET,
      polygonOffsetUnits: OUTLINE_POLYGON_UNITS,
      // Solo se pinta fuera de la silueta del mueble (stencil != 1).
      stencilWrite: true,
      stencilRef: OUTLINE_STENCIL_REF,
      stencilFunc: NotEqualStencilFunc,
      stencilFail: KeepStencilOp,
      stencilZFail: KeepStencilOp,
      stencilZPass: KeepStencilOp,
    });
    material.onBeforeCompile = shader => {
      shader.uniforms['uOutlineOffset'] = offset;
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `attribute vec3 ${OUTLINE_NORMAL_ATTRIBUTE};
uniform vec2 uOutlineOffset;
void main() {`
        )
        .replace(
          '#include <project_vertex>',
          `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
mvPosition.z -= ${OUTLINE_DEPTH_PUSH.toFixed(3)};
gl_Position = projectionMatrix * mvPosition;
vec3 outlineViewNormal = normalMatrix * ${OUTLINE_NORMAL_ATTRIBUTE};
vec2 outlineDir = ( projectionMatrix * vec4( outlineViewNormal, 0.0 ) ).xy / uOutlineOffset;
float outlineLen = length( outlineDir );
if ( outlineLen > 1e-5 ) gl_Position.xy += outlineDir / outlineLen * uOutlineOffset * gl_Position.w;`
        );
    };
    material.customProgramCacheKey = () => cacheKey;
    return material;
  }

  /** Si nadie ha informado del tamaño, lo lee una sola vez del canvas. */
  private ensureCanvasSize(): void {
    if (this.canvasSize) return;
    const rect = this.canvas?.getBoundingClientRect?.();
    if (rect) this.setCanvasSize(rect.width, rect.height);
  }

  private resolveHover(): void {
    if (!this.pendingHover || !this.camera || !this.scene) {
      this.applyHover(null);
      return;
    }
    const hits = this.intersect(this.pendingHover, this.camera, this.scene);
    for (const hit of hits) {
      if (this.isFloorClick(hit.object)) break;
      const root = this.findRootObject(hit.object);
      const info = root ? this.objects.get(root) : undefined;
      if (root && info) {
        this.applyHover({ object: root, info });
        return;
      }
    }
    this.applyHover(null);
  }

  private applyHover(target: HoverTarget | null): void {
    const same = this.hovered?.object === target?.object;
    // Mismo objeto: nada que hacer, salvo que haya perdido su contorno al deseleccionarse.
    if (
      same &&
      (!target || this.hoverOutline || target.object === this.selected)
    )
      return;
    this.removeHoverOutline();
    this.hovered = target;
    // El seleccionado ya tiene su contorno; el hover nunca toca los materiales.
    if (target && target.object !== this.selected) {
      this.ensureCanvasSize();
      // Un único material de hover, reutilizado entre objetos.
      this.hoverMaterial ??= this.createOutlineMaterial(
        { color: HOVER_OUTLINE_COLOR, opacity: HOVER_OUTLINE_OPACITY },
        this.hoverOffset,
        'hover-outline'
      );
      this.hoverStencil = writeStencil(target.object);
      this.hoverOutline = this.buildOutline(
        target.object,
        this.hoverMaterial,
        HOVER_OUTLINE_NAME
      );
    }
    if (!same) this.onHoverChange?.(target);
  }

  private removeHoverOutline(): void {
    restoreStencil(this.hoverStencil);
    this.hoverStencil = null;
    if (this.hoverOutline) {
      this.hoverOutline.removeFromParent();
      this.disposeHullGeometries(this.hoverOutline);
      this.hoverOutline.clear();
      this.hoverOutline = null;
    }
  }

  /** Libera las geometrías clonadas (mallas mixtas); las compartidas no se tocan. */
  private disposeHullGeometries(outline: Group): void {
    for (const child of outline.children) {
      const geometry = (child as Mesh).geometry;
      if (geometry && this.ownedGeometries.delete(geometry)) geometry.dispose();
    }
  }

  private validateTeleportationPosition(position: Vector3): Vector3 | null {
    const clampedX = Math.max(
      this.roomLimits.minX + TELEPORT_MARGIN,
      Math.min(this.roomLimits.maxX - TELEPORT_MARGIN, position.x)
    );
    const clampedZ = Math.max(
      this.roomLimits.minZ + TELEPORT_MARGIN,
      Math.min(this.roomLimits.maxZ - TELEPORT_MARGIN, position.z)
    );

    if (
      Math.abs(clampedX - position.x) > TELEPORT_MAX_CLAMP ||
      Math.abs(clampedZ - position.z) > TELEPORT_MAX_CLAMP
    ) {
      return null;
    }

    return new Vector3(clampedX, position.y, clampedZ);
  }

  private findRootObject(object: Object3D): Object3D | null {
    let current: Object3D | null = object;
    while (current) {
      if (this.objects.has(current)) return current;
      current = current.parent;
    }
    return null;
  }
}
