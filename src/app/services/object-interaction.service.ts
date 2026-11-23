import { Injectable } from '@angular/core';
import {
  BackSide,
  Color,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
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

interface EmissiveBackup {
  color: Color;
  intensity: number;
}

interface EmissiveMaterial extends Material {
  emissive: Color;
  emissiveIntensity: number;
}

const OUTLINE_NAME = '__selection-outline';
const OUTLINE_COLOR = 0x2f8fa8;
const OUTLINE_PULSE_COLOR = 0x8fe3f5;
const OUTLINE_PULSE_AMPLITUDE = 0.5;
const OUTLINE_PULSE_SPEED = 0.003;
/** Grosor deseado del contorno en metros (igual en sofá, mesa o estantería). */
const OUTLINE_THICKNESS = 0.025;
const OUTLINE_MIN_SCALE = 1.01;
const OUTLINE_MAX_SCALE = 1.15;
const HOVER_EMISSIVE_COLOR = 0x3a6a78;
const HOVER_EMISSIVE_INTENSITY = 0.35;
const TELEPORT_MARGIN = 1.5;
const TELEPORT_MAX_CLAMP = 2;

function hasEmissive(material: Material): material is EmissiveMaterial {
  return (
    'emissive' in material &&
    (material as EmissiveMaterial).emissive instanceof Color
  );
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
  private selected: Object3D | null = null;

  private pendingHover: Vector2 | null = null;
  private hoverDirty = false;
  private hovered: HoverTarget | null = null;
  private readonly pulseColor = new Color(OUTLINE_PULSE_COLOR);
  private readonly emissiveBackup = new Map<Material, EmissiveBackup>();

  /** Notificación opcional de cambios de hover (F4b la conecta a señales). */
  onHoverChange: ((target: HoverTarget | null) => void) | null = null;

  setRoomLimits(limits: RoomLimits): void {
    this.roomLimits = limits;
  }

  /** Elemento cuyo rectángulo define las coordenadas NDC (el canvas). */
  setCanvas(canvas: HTMLElement | null): void {
    this.canvas = canvas;
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
      // La geometría es compartida con el original: no se libera aquí.
      this.outline.removeFromParent();
      this.outline.clear();
      this.outline = null;
    }
    if (this.outlineMaterial) {
      this.outlineMaterial.dispose();
      this.outlineMaterial = null;
    }
    this.selected = null;
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
    this.restoreEmissive();
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
      if (current.name === OUTLINE_NAME) return true;
      current = current.parent;
    }
    return false;
  }

  private isFloorClick(object: Object3D): boolean {
    return object.name === 'floor';
  }

  private select(root: Object3D): void {
    this.selected = root;
    this.outlineMaterial = new MeshBasicMaterial({
      color: OUTLINE_COLOR,
      side: BackSide,
    });
    const outline = new Group();
    outline.name = OUTLINE_NAME;

    // El contorno vive como hijo del objeto: hereda su transformación.
    root.updateMatrixWorld(true);
    const rootInverse = root.matrixWorld.clone().invert();
    const meshes: Mesh[] = [];
    root.traverse(child => {
      if ((child as Mesh).isMesh && !this.isOutline(child)) {
        meshes.push(child as Mesh);
      }
    });
    for (const mesh of meshes) {
      const clone = new Mesh(mesh.geometry, this.outlineMaterial);
      clone.raycast = () => undefined;
      clone.matrixAutoUpdate = false;
      clone.matrix
        .copy(rootInverse)
        .multiply(mesh.matrixWorld)
        .multiply(this.growAroundCenter(mesh));
      clone.matrixWorldNeedsUpdate = true;
      outline.add(clone);
    }
    outline.raycast = () => undefined;
    root.add(outline);
    this.outline = outline;
  }

  /**
   * Matriz local que agranda la malla alrededor del centro de su caja (no de su
   * origen local) lo justo para ~`OUTLINE_THICKNESS` m de borde en cualquier tamaño.
   */
  private growAroundCenter(mesh: Mesh): Matrix4 {
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return new Matrix4();
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const worldScale = mesh.getWorldScale(new Vector3());
    const half =
      Math.max(
        size.x * worldScale.x,
        size.y * worldScale.y,
        size.z * worldScale.z
      ) / 2 || 1;
    const factor = Math.min(
      OUTLINE_MAX_SCALE,
      Math.max(OUTLINE_MIN_SCALE, 1 + OUTLINE_THICKNESS / half)
    );
    return new Matrix4()
      .makeTranslation(center.x, center.y, center.z)
      .scale(new Vector3(factor, factor, factor))
      .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
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
    if (this.hovered?.object === target?.object) return;
    this.restoreEmissive();
    this.hovered = target;
    if (target) this.highlight(target.object);
    this.onHoverChange?.(target);
  }

  private highlight(root: Object3D): void {
    root.traverse(child => {
      if (!(child as Mesh).isMesh || this.isOutline(child)) return;
      const material = (child as Mesh).material;
      const list = Array.isArray(material) ? material : [material];
      for (const m of list) {
        if (!hasEmissive(m) || this.emissiveBackup.has(m)) continue;
        this.emissiveBackup.set(m, {
          color: m.emissive.clone(),
          intensity: m.emissiveIntensity,
        });
        m.emissive.set(HOVER_EMISSIVE_COLOR);
        m.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
      }
    });
  }

  private restoreEmissive(): void {
    for (const [material, backup] of this.emissiveBackup) {
      if (hasEmissive(material)) {
        material.emissive.copy(backup.color);
        material.emissiveIntensity = backup.intensity;
      }
    }
    this.emissiveBackup.clear();
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
