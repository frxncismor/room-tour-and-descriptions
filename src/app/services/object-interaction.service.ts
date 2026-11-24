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
  PieceInfo,
  RoomLimits,
  SelectableId,
  SelectedInfo,
  SurfaceInfo,
} from '../interfaces/scene.interface';
import type { SurfaceId } from '../pieces/piece-ids';

/**
 * Resultado de `handleClick`: como `InteractionResult`, pero `objectInfo` puede
 * ser una pieza o una superficie (`kind`) y las paredes/techo devuelven el
 * punto de impacto.
 */
export interface PickResult extends Omit<InteractionResult, 'objectInfo'> {
  objectInfo: SelectedInfo | null;
  /** Punto de impacto en un clic de pared o techo. */
  surfacePoint?: Vector3;
}

/** Opciones de `registerPiece`. */
export interface PieceRegistration {
  /**
   * Objetos que se contornean en lugar de los proxies (las mallas visibles de
   * una pieza procedural). Por defecto se contornean los propios proxies.
   */
  visuals?: Object3D[];
}

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
  info: SelectedInfo;
}

/** Impacto ya resuelto: pieza/mueble, superficie o suelo. */
type Pick =
  | { type: 'item'; root: Object3D; info: ObjectInfo | PieceInfo }
  | { type: 'surface'; root: Object3D; info: SurfaceInfo; point: Vector3 }
  | { type: 'floor'; point: Vector3 };

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
function writeStencil(
  root: Object3D,
  backup: StencilBackup = new Map()
): StencilBackup {
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
  /** Objetos registrados (muebles, proxies de piezas y superficies) y su info. */
  private readonly objects = new Map<Object3D, SelectedInfo>();
  /** Lo que recibe el rayo: registrados + suelo (el rayo no recorre la escena). */
  private readonly pickables = new Set<Object3D>();
  private pickableList: Object3D[] | null = null;
  /** Objetos de cada id (una pieza puede tener varias cajas). */
  private readonly groups = new Map<SelectableId, Set<Object3D>>();
  /** Objetos a contornear por id cuando no son los propios proxies. */
  private readonly visuals = new Map<SelectableId, Object3D[]>();
  private floorMesh: Object3D | null = null;
  private roomLimits: RoomLimits = {
    minX: -8,
    maxX: 8,
    minZ: -8,
    maxZ: 8,
  };

  private canvas: HTMLElement | null = null;
  private camera: PerspectiveCamera | null = null;
  private scene: Scene | null = null;

  private outlines: Group[] = [];
  private outlineMaterial: MeshBasicMaterial | null = null;
  /** Desplazamiento del contorno en NDC (se actualiza con el tamaño del canvas). */
  private readonly outlineOffset = { value: new Vector2(0.01, 0.01) };
  private hoverOutlines: Group[] = [];
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
  ): Promise<PickResult> {
    try {
      this.setContext(camera, scene);
      const ndc = this.getMousePosition(event);
      const hits = this.intersect(ndc, camera, scene);

      this.clearSelection();

      // Prioridad pieza > pared > suelo. Con toque se suman los impactos de los
      // rayos del anillo: una pieza cercana gana a lo que haya bajo el dedo.
      const tolerance = this.tolerancePx(event, options);
      if (tolerance > 0 && this.firstPick(hits)?.type !== 'item') {
        const near = this.nearbyPiece(event, tolerance, camera, scene);
        if (near) return this.pickResult(near);
      }

      for (const pick of this.picks(hits)) {
        if (pick.type === 'floor') {
          const floorPoint = this.validateTeleportationPosition(pick.point);
          if (floorPoint) {
            return { objectInfo: null, success: true, floorPoint };
          }
          continue;
        }
        return this.pickResult(pick);
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

  /** Selecciona (si es pieza o mueble) y compone el resultado del clic. */
  private pickResult(pick: Pick): PickResult {
    if (pick.type === 'floor') {
      return { objectInfo: null, success: true, floorPoint: pick.point };
    }
    if (pick.type === 'surface') {
      return {
        objectInfo: pick.info,
        success: true,
        object: pick.root,
        surfacePoint: pick.point,
      };
    }
    this.select(pick.root, pick.info);
    return { objectInfo: pick.info, success: true, object: pick.root };
  }

  /** Toque (o tolerancia explícita) → radio en px CSS; ratón/lápiz → 0. */
  private tolerancePx(event: PointerLike, options: ClickOptions): number {
    if (options.tolerancePx !== undefined)
      return Math.max(0, options.tolerancePx);
    const type = options.pointerType ?? event.pointerType;
    return type === 'touch' ? TOUCH_TOLERANCE_PX : 0;
  }

  /** Impactos registrados (pieza, superficie, suelo) en orden de distancia. */
  private *picks(hits: ReturnType<ObjectInteractionService['intersect']>) {
    for (const hit of hits) {
      const pick = this.resolvePick(hit);
      if (pick) yield pick;
    }
  }

  /** Primer impacto registrado: el que decide el clic. */
  private firstPick(
    hits: ReturnType<ObjectInteractionService['intersect']>
  ): Pick | null {
    for (const pick of this.picks(hits)) return pick;
    return null;
  }

  private resolvePick(hit: { object: Object3D; point: Vector3 }): Pick | null {
    if (this.isFloorClick(hit.object)) {
      return { type: 'floor', point: hit.point };
    }
    const root = this.findRootObject(hit.object);
    const info = root ? this.objects.get(root) : undefined;
    if (!root || !info) return null;
    if (info.kind === 'surface') {
      return { type: 'surface', root, info, point: hit.point };
    }
    return { type: 'item', root, info };
  }

  /** Anillos de rayos alrededor del punto; gana la pieza del anillo más cercano. */
  private nearbyPiece(
    event: PointerLike,
    tolerancePx: number,
    camera: PerspectiveCamera,
    scene: Scene
  ): Pick | null {
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
        const found = this.firstPick(this.intersect(ndc, camera, scene));
        if (found?.type === 'item') return found;
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
    this.disposeOutlines(this.outlines);
    this.outlines = [];
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

  /** Selecciona un objeto por código: sustituye el contorno anterior (y resalta todo su grupo). */
  selectObject(object: Object3D): void {
    const info = this.objects.get(object);
    this.removeOutline();
    if (info && info.kind !== 'surface') this.select(object, info);
    else this.select(object);
  }

  /** Registra un mueble (o una superficie ya con `kind`) como seleccionable. */
  addObject(object: Object3D, info: SelectedInfo): void {
    this.objects.set(object, info);
    let group = this.groups.get(info.id);
    if (!group) this.groups.set(info.id, (group = new Set()));
    group.add(object);
    this.addPickable(object);
  }

  /**
   * Registra una pieza con una o varias cajas proxy (invisibles: reciben el
   * rayo aunque `visible = false`). Se resaltan todas a la vez.
   */
  registerPiece(
    info: PieceInfo | ObjectInfo,
    proxies: Object3D[],
    options: PieceRegistration = {}
  ): void {
    for (const proxy of proxies) this.addObject(proxy, info);
    if (options.visuals) this.visuals.set(info.id, options.visuals);
  }

  /** Registra una pared o el techo (`kind: 'surface'`). */
  registerSurface(object: Object3D, id: SurfaceId): void {
    this.addObject(object, { id, kind: 'surface' });
  }

  /** Añade un objeto al conjunto que recibe el rayo (p. ej. el suelo). */
  addPickable(object: Object3D): void {
    this.pickables.add(object);
    this.pickableList = null;
    if (object.name === 'floor') this.floorMesh = object;
  }

  removePickable(object: Object3D): void {
    this.pickables.delete(object);
    this.pickableList = null;
    if (this.floorMesh === object) this.floorMesh = null;
  }

  /** Todos los objetos (cajas) de una pieza; vacío si no está registrada. */
  groupOf(id: SelectableId): Object3D[] {
    return [...(this.groups.get(id) ?? [])];
  }

  removeObject(object: Object3D): void {
    const info = this.objects.get(object);
    const wasSelected = this.selected === object || this.outlinedBy(object);
    this.objects.delete(object);
    this.removePickable(object);
    if (info) {
      const group = this.groups.get(info.id);
      group?.delete(object);
      if (group?.size === 0) {
        this.groups.delete(info.id);
        this.visuals.delete(info.id);
      }
    }
    if (wasSelected) this.removeOutline();
    if (
      this.hovered &&
      (this.hovered.object === object || this.hovered.info.id === info?.id)
    )
      this.applyHover(null);
  }

  getObjectInfo(object: Object3D): SelectedInfo | undefined {
    return this.objects.get(object);
  }

  /** ¿Pertenece el objeto al grupo de lo seleccionado? */
  private outlinedBy(object: Object3D): boolean {
    const id = this.selected ? this.objects.get(this.selected)?.id : undefined;
    return id !== undefined && this.groups.get(id)?.has(object) === true;
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
    this.pickables.clear();
    this.pickableList = null;
    this.groups.clear();
    this.visuals.clear();
    this.floorMesh = null;
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
      .intersectObjects(this.pickTargets(scene), true)
      .filter(hit => !this.isOutline(hit.object));
  }

  /** Objetos que reciben el rayo; el suelo se busca una vez si nadie lo registró. */
  private pickTargets(scene: Scene): Object3D[] {
    if (!this.floorMesh) {
      const floor = scene.getObjectByName('floor');
      if (floor) this.floorMesh = floor;
    }
    this.pickableList ??= [...this.pickables];
    return this.floorMesh && !this.pickables.has(this.floorMesh)
      ? [...this.pickableList, this.floorMesh]
      : this.pickableList;
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

  /** Objetos que se contornean para `info`: sus `visuals` o todas las cajas del grupo. */
  private outlineRoots(root: Object3D, info?: SelectedInfo): Object3D[] {
    if (!info) return [root];
    const visuals = this.visuals.get(info.id);
    if (visuals?.length) return visuals;
    const group = this.groups.get(info.id);
    return group && group.size > 0 ? [...group] : [root];
  }

  private select(root: Object3D, info?: SelectedInfo): void {
    this.selected = root;
    this.ensureCanvasSize();
    // Al seleccionar, el contorno de hover se retira (el de selección lo sustituye).
    this.removeHoverOutline();
    this.outlineMaterial = this.createOutlineMaterial(
      { color: OUTLINE_COLOR },
      this.outlineOffset,
      'selection-outline'
    );
    const stencil: StencilBackup = new Map();
    for (const target of this.outlineRoots(root, info)) {
      writeStencil(target, stencil);
      this.outlines.push(
        this.buildOutline(target, this.outlineMaterial, OUTLINE_NAME)
      );
    }
    this.selectedStencil = stencil;
  }

  /** Grupo de cascos (uno por malla opaca) como hijo de `root`: hereda su transformación. */
  private buildOutline(
    root: Object3D,
    material: MeshBasicMaterial,
    name: string
  ): Group {
    const outline = new Group();
    outline.name = name;
    // Los hijos de un objeto invisible (caja proxy) no se dibujan: el casco
    // cuelga entonces de su padre.
    const container = root.visible ? root : (root.parent ?? root);
    root.updateMatrixWorld(true);
    container.updateMatrixWorld(true);
    const rootInverse = container.matrixWorld.clone().invert();
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
    container.add(outline);
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
      // Color de marca exacto: sin tone mapping (Neutral 1,1 lo desviaría).
      toneMapped: false,
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
    const pick = this.firstPick(hits);
    if (pick && pick.type !== 'floor') {
      this.applyHover({ object: pick.root, info: pick.info });
      return;
    }
    this.applyHover(null);
  }

  private applyHover(target: HoverTarget | null): void {
    const same = this.hovered?.info.id === target?.info.id;
    const isSelected = (t: HoverTarget) =>
      this.selected !== null &&
      this.objects.get(this.selected)?.id === t.info.id;
    // Mismo objeto: nada que hacer, salvo que haya perdido su contorno al deseleccionarse.
    if (
      same &&
      (!target || this.hoverOutlines.length > 0 || isSelected(target))
    )
      return;
    this.removeHoverOutline();
    this.hovered = target;
    // El seleccionado ya tiene su contorno; el hover nunca toca los materiales;
    // las paredes y el techo no se contornean (solo cambian el cursor).
    if (target && !isSelected(target) && target.info.kind !== 'surface') {
      this.ensureCanvasSize();
      // Un único material de hover, reutilizado entre objetos.
      this.hoverMaterial ??= this.createOutlineMaterial(
        { color: HOVER_OUTLINE_COLOR, opacity: HOVER_OUTLINE_OPACITY },
        this.hoverOffset,
        'hover-outline'
      );
      const stencil: StencilBackup = new Map();
      for (const root of this.outlineRoots(target.object, target.info)) {
        writeStencil(root, stencil);
        this.hoverOutlines.push(
          this.buildOutline(root, this.hoverMaterial, HOVER_OUTLINE_NAME)
        );
      }
      this.hoverStencil = stencil;
    }
    if (!same) this.onHoverChange?.(target);
  }

  private removeHoverOutline(): void {
    restoreStencil(this.hoverStencil);
    this.hoverStencil = null;
    this.disposeOutlines(this.hoverOutlines);
    this.hoverOutlines = [];
  }

  /** Quita los contornos de la escena; la geometría compartida con el original no se libera. */
  private disposeOutlines(outlines: Group[]): void {
    for (const outline of outlines) {
      outline.removeFromParent();
      this.disposeHullGeometries(outline);
      outline.clear();
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
