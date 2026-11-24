import { Injectable } from '@angular/core';
import { Box3, Object3D, PerspectiveCamera, Ray, Sphere, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
import {
  CameraConfiguration,
  RoomLimits,
  SurfaceId,
} from '../interfaces/scene.interface';

/** Margen (m) entre la cámara y las paredes. */
const WALL_MARGIN = 0.5;
/** FOV horizontal mínimo en pantallas estrechas (grados) y tope del vertical. */
const MIN_HORIZONTAL_FOV = 50;
const MAX_VERTICAL_FOV = 90;
/**
 * Vista inicial en retrato (aspect <= PORTRAIT_FULL_ASPECT): encuadre diagonal.
 * La cámara se coloca en la esquina delantera derecha, bajo el techo (4 m), y
 * mira en diagonal hacia el fondo izquierdo con un pitch medio (~25°): la
 * profundidad de la sala llena el alto, se ve la esquina y no queda vacío
 * sobre las paredes. Entre aspect 1 y PORTRAIT_FULL_ASPECT se mezcla con la
 * vista de escritorio (sin saltos).
 */
const PORTRAIT_FULL_ASPECT = 0.5;
const PORTRAIT_POSITION = new Vector3(7, 3.8, -1.5);
const PORTRAIT_TARGET = new Vector3(0, 0.5, -4.5);
const AXIS_Y = new Vector3(0, 1, 0);
const MIN_CAMERA_HEIGHT = 0.3;
const MOVE_DURATION_MS = 1200;
const FOCUS_DURATION_MS = 900;
/** Giros (rad) alrededor del mueble probados al enfocar, por orden de prioridad. */
const FOCUS_YAW_OFFSETS = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI];
/** Altura extra (m) sobre la de ojos para ver por encima de lo que tapa. */
const FOCUS_RAISED_EXTRA = 1;
/** Holgura (m) con la que se encoge la caja del mueble al muestrear su oclusión. */
const OCCLUSION_INSET = 0.05;
/** Margen (fracción de NDC) alrededor del mueble enfocado. */
const FOCUS_MARGIN = 0.12;
/** En retrato: borde superior de la ficha inferior (~30 % del alto) y bajo la barra de botones (NDC). */
const SHEET_BOTTOM_NDC = -0.32;
const TOP_BAR_NDC = 0.78;
/**
 * En apaisado la ficha ocupa una columna a la derecha: ancho de la ficha
 * (360 px, ver description-panel) + margen derecho (16 px) + holgura (16 px).
 * Debe coincidir con el CSS de `description-panel`.
 */
const SHEET_COLUMN_PX = 392;
/** Grosor máximo (m) para tratar una pieza como plana y colgada (cuadro, reloj). */
const FLAT_PIECE_MAX_THICKNESS = 0.1;
/** Inclinación máxima (grados) de la vista hacia abajo al enfocar un objeto. */
const FOCUS_MAX_PITCH_DEG = 30;
/** Holgura mínima entre la cámara y cualquier obstáculo (m). */
const CAMERA_CLEARANCE = 0.4;
/** Ancho (px) que se asume si el canvas aún no tiene medida (p. ej. en tests). */
const FALLBACK_VIEWPORT_WIDTH = 1280;
/** Zoom libre (spec C.3): distancia mínima y máxima de la órbita (m). */
const DEFAULT_MAX_POLAR = Math.PI / 2.1;
const MIN_ORBIT_DISTANCE = 0.8;
const MAX_ORBIT_DISTANCE = 12;
/** Altura máxima (m) de cámara y objetivo: la sala mide 4 m, nunca se atraviesa el techo. */
const MAX_CAMERA_HEIGHT = 3.9;
/** Pared: alto (m) a encuadrar con holgura (4 + 0,4), margen lateral por lado y tope de distancia (m). */
const SURFACE_FIT_HEIGHT = 4.4;
const SURFACE_SIDE_MARGIN = 0.4;
const SURFACE_MAX_DISTANCE = 9;
/** Margen (×) sobre el ancho de la pared al repartirla en tramos. */
const SURFACE_SPAN_FACTOR = 1.04;
/** El objetivo se coloca delante de la pared para que el límite de sala no lo desplace (m). */
const SURFACE_TARGET_OFFSET = 0.5;
/** Pose fija del techo: pitch (grados) y distancia (m) al objetivo. */
const CEILING_PITCH_DEG = 23;
const CEILING_TARGET_DISTANCE = 5;
/** Grados sobre la horizontal que se permiten al mirar paredes y techo. */
const RELAXED_POLAR_EXTRA_DEG = 30;

/** Pared (sala 16 × 16 × 4): centro, normal hacia dentro y eje a lo largo de ella. */
interface WallSpec {
  center: Vector3;
  normal: Vector3;
  along: Vector3;
}

const WALL_LENGTH = 16;
const WALL_HEIGHT = 4;
const WALL_SPECS: Readonly<Record<Exclude<SurfaceId, 'ceiling'>, WallSpec>> = {
  wallGreen: {
    center: new Vector3(0, 0, -8),
    normal: new Vector3(0, 0, 1),
    along: new Vector3(1, 0, 0),
  },
  wallWindow: {
    center: new Vector3(-8, 0, 0),
    normal: new Vector3(1, 0, 0),
    along: new Vector3(0, 0, -1),
  },
  wallTv: {
    center: new Vector3(0, 0, 8),
    normal: new Vector3(0, 0, -1),
    along: new Vector3(-1, 0, 0),
  },
  wallDesk: {
    center: new Vector3(8, 0, 0),
    normal: new Vector3(-1, 0, 0),
    along: new Vector3(0, 0, 1),
  },
};

/** Pose (cámara y objetivo) de una superficie y reparto de la pared en tramos. */
export interface SurfacePose {
  position: Vector3;
  target: Vector3;
  /** Nº de tramos de la pared (1 en el techo). */
  tramos: number;
  /** Tramo (1…tramos) al que corresponde la pose. */
  tramo: number;
  /** Ancho (m) de un tramo. */
  tramoWidth: number;
}

interface Tween {
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  duration: number;
  elapsed: number;
  /** Límite polar abierto (paredes y techo) al terminar; si no, el de siempre. */
  relaxPolar: boolean;
  resolve: (completed: boolean) => void;
}

/**
 * Cámara en primera persona con órbita limitada a la sala.
 * Las animaciones avanzan en `update(dt)` (el bucle de SceneService): sin rAF propio.
 */
@Injectable({
  providedIn: 'root',
})
export class CameraService {
  private camera!: PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private limits: RoomLimits = DEFAULT_SCENE_CONFIG.room.limits;
  private baseFov = 65;
  private aspect = 1;
  private initialHeight = 1.7;
  private initialPosition = new Vector3(0, 1.7, 3);
  private initialTarget = new Vector3(0, 1.36, 0);
  private tween: Tween | null = null;
  /** true mientras la cámara sigue en la vista inicial (sin que el usuario la mueva). */
  private atFramedPose = true;
  /** true mientras el propio servicio llama a controls.update() (tween, reencuadre, damping). */
  private selfUpdating = false;
  private readonly onControlsStart = () => {
    this.atFramedPose = false;
    this.cancelAnimation();
  };
  /**
   * Cualquier cambio de OrbitControls que no venga de este servicio (p. ej. el paneo
   * con flechas, que emite change pero no start) cuenta como vista tocada.
   */
  private readonly onControlsChange = () => {
    if (this.selfUpdating) return;
    this.atFramedPose = false;
    this.cancelAnimation();
  };

  initialize(config: CameraConfiguration, aspect = 1): void {
    this.camera = new PerspectiveCamera(
      config.fov,
      aspect,
      config.near,
      config.far
    );
    this.baseFov = config.fov;
    this.initialPosition = config.initialPosition.clone();
    this.initialHeight = config.initialHeight;
    this.initialTarget = new Vector3(0, config.initialHeight * 0.8, 0);
    this.atFramedPose = true;
    this.setAspect(aspect);
    this.camera.position.copy(this.framedPosition());
  }

  setRoomLimits(limits: RoomLimits): void {
    this.limits = limits;
    this.applyDistanceLimit();
  }

  setAspect(aspect: number): void {
    if (!this.camera || !(aspect > 0)) return;
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.fov = this.fovFor(aspect);
    this.camera.updateProjectionMatrix();
    // Si el usuario aún no ha movido la cámara, la vista inicial se reencuadra.
    if (this.atFramedPose && !this.tween) {
      this.camera.position.copy(this.framedPosition());
      this.controls?.target.copy(this.framedTarget());
      this.applyDistanceLimit();
      this.updateControls();
    }
  }

  private updateControls(): void {
    this.selfUpdating = true;
    try {
      this.controls?.update();
    } finally {
      this.selfUpdating = false;
    }
  }

  /** En pantallas estrechas mantiene un FOV horizontal mínimo (con tope vertical). */
  private fovFor(aspect: number): number {
    if (aspect >= 1) return this.baseFov;
    const half = Math.tan((MIN_HORIZONTAL_FOV * Math.PI) / 360) / aspect;
    const vertical = (2 * Math.atan(half) * 180) / Math.PI;
    return Math.min(MAX_VERTICAL_FOV, Math.max(this.baseFov, vertical));
  }

  /** Mezcla 0 (escritorio) → 1 (retrato completo) según el aspect. */
  private portraitBlend(): number {
    if (this.aspect >= 1) return 0;
    return this.clamp((1 - this.aspect) / (1 - PORTRAIT_FULL_ASPECT), 0, 1);
  }

  /** Posición inicial: en retrato sube y se aleja (dentro de la sala). */
  private framedPosition(): Vector3 {
    const position = this.initialPosition
      .clone()
      .lerp(PORTRAIT_POSITION, this.portraitBlend());
    this.clampPoint(position);
    return position;
  }

  /** Punto de mira inicial: en retrato baja al centro de los muebles. */
  private framedTarget(): Vector3 {
    return this.initialTarget
      .clone()
      .lerp(PORTRAIT_TARGET, this.portraitBlend());
  }

  setupControls(domElement: HTMLElement): void {
    this.controls?.dispose();
    const controls = new OrbitControls(this.camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = MIN_ORBIT_DISTANCE;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = DEFAULT_MAX_POLAR;
    // Zoom libre (spec C.3): rueda y pellizco acercan al punto señalado.
    controls.zoomToCursor = true;
    controls.rotateSpeed = 0.7;
    // El paneo (botón derecho, dos dedos, flechas) queda en el plano horizontal.
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.target.copy(this.framedTarget());
    controls.addEventListener('start', this.onControlsStart);
    controls.addEventListener('change', this.onControlsChange);
    // Flechas del teclado con el canvas enfocado.
    if (!domElement.hasAttribute('tabindex')) {
      domElement.tabIndex = 0;
    }
    controls.listenToKeyEvents(domElement);
    this.controls = controls;
    this.applyDistanceLimit();
  }

  /**
   * `maxDistance` 12 m (spec C.3), sin quedar nunca por debajo de lo que pide
   * la vista inicial en retrato (algo más lejos que el semi-lado de la sala).
   */
  private applyDistanceLimit(): void {
    if (!this.controls) return;
    const framed = this.camera
      ? this.framedPosition().distanceTo(this.framedTarget()) + 0.1
      : 0;
    this.controls.maxDistance = Math.max(
      this.controls.minDistance + 1,
      MAX_ORBIT_DISTANCE,
      framed
    );
  }

  /** Mantiene cámara y objetivo dentro de la sala (nunca se ve el exterior). */
  clampToRoom(): void {
    if (!this.camera) return;
    this.clampPoint(this.camera.position);
    this.camera.position.y = Math.min(
      this.camera.position.y,
      MAX_CAMERA_HEIGHT
    );
    if (this.controls) {
      this.clampPoint(this.controls.target);
      this.controls.target.y = Math.min(
        this.controls.target.y,
        MAX_CAMERA_HEIGHT
      );
    }
  }

  private clampPoint(point: Vector3): void {
    point.x = this.clamp(
      point.x,
      this.limits.minX + WALL_MARGIN,
      this.limits.maxX - WALL_MARGIN
    );
    point.z = this.clamp(
      point.z,
      this.limits.minZ + WALL_MARGIN,
      this.limits.maxZ - WALL_MARGIN
    );
    point.y = Math.max(point.y, MIN_CAMERA_HEIGHT);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  /** Camina hasta `point` (a la altura de ojos), conservando el rumbo. */
  teleportTo(point: Vector3): Promise<boolean> {
    if (!this.camera) return Promise.resolve(false);
    const toPosition = new Vector3(point.x, this.initialHeight, point.z);
    this.clampPoint(toPosition);
    toPosition.y = this.initialHeight;

    const heading = this.currentHeading();
    const toTarget = new Vector3(
      toPosition.x + heading.x * 2,
      this.initialHeight * 0.8,
      toPosition.z + heading.z * 2
    );
    return this.startTween(toPosition, toTarget, MOVE_DURATION_MS);
  }

  /**
   * Acerca la cámara a `object` para verlo entero (D-04). Entre varios ángulos
   * elige el primero (el actual tiene prioridad) que quede dentro de la sala y
   * sin otro mueble de `obstacles` entre la cámara y el objetivo; si todos
   * tapan, el de menor oclusión. Con `approach` (dirección horizontal del
   * frente de la pieza) el encuadre es frontal venga la cámara de donde venga;
   * sin él, el lado de la cámara actual.
   */
  focusOn(
    object: Object3D,
    obstacles: readonly Object3D[] = [],
    approach?: Vector3
  ): Promise<boolean> {
    if (!this.camera) return Promise.resolve(false);
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return Promise.resolve(false);

    const sphere = box.getBoundingSphere(new Sphere());
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const minDistance = this.controls?.minDistance ?? 1;
    const maxDistance = this.controls?.maxDistance ?? 8;
    const baseDistance = this.clamp(
      (sphere.radius / Math.sin(halfFov)) * 1.15,
      minDistance,
      maxDistance
    );

    const away = approach
      ? approach.clone()
      : this.camera.position.clone().sub(sphere.center);
    away.y = 0;
    if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
    away.normalize();
    // Una pieza plana se enfoca de frente (por su normal, del lado de la cámara).
    const size = box.getSize(new Vector3());
    const thinAxis = size.x < size.z ? 'x' : 'z';
    const wide = thinAxis === 'x' ? size.z : size.x;
    if (
      size[thinAxis] <= FLAT_PIECE_MAX_THICKNESS &&
      size[thinAxis] < wide / 4
    ) {
      const normal = new Vector3(
        thinAxis === 'x' ? 1 : 0,
        0,
        thinAxis === 'z' ? 1 : 0
      );
      away.copy(normal.multiplyScalar(Math.sign(away.dot(normal)) || 1));
    }

    const pose = this.pickFocusPose(
      box,
      sphere.center,
      away,
      { baseDistance, minDistance, maxDistance },
      obstacles
    );
    return this.startTween(pose.position, pose.target, FOCUS_DURATION_MS);
  }

  /** Nº de tramos en que se reparte una pared con ese aspecto (spec C.2). */
  surfaceTramos(aspect: number): number {
    const reach = 2 * SURFACE_MAX_DISTANCE * this.tanHalfHorizontalFov(aspect);
    return Math.max(
      1,
      Math.ceil((WALL_LENGTH * SURFACE_SPAN_FACTOR) / reach - 1e-9)
    );
  }

  /** Tramo (1…n) de la pared más cercano al punto pulsado. */
  surfaceTramoAt(surface: SurfaceId, point: Vector3, aspect: number): number {
    if (surface === 'ceiling') return 1;
    const n = this.surfaceTramos(aspect);
    const wall = WALL_SPECS[surface];
    const offset = point.clone().sub(wall.center).dot(wall.along);
    const index = Math.floor((offset + WALL_LENGTH / 2) / (WALL_LENGTH / n));
    return this.clamp(index + 1, 1, n);
  }

  /**
   * Pose de cámara y objetivo para ver una pared de frente (≤ 9 m) o el techo
   * (pose fija). `tramo` va de 1 a `surfaceTramos(aspect)`.
   */
  surfacePose(surface: SurfaceId, tramo: number, aspect: number): SurfacePose {
    if (surface === 'ceiling') return this.ceilingPose();
    const wall = WALL_SPECS[surface];
    const n = this.surfaceTramos(aspect);
    const index = this.clamp(Math.round(tramo), 1, n);
    const width = WALL_LENGTH / n;
    const along = -WALL_LENGTH / 2 + width * (index - 0.5);
    const tanV = Math.tan((this.fovFor(aspect) * Math.PI) / 360);
    const distance = Math.min(
      SURFACE_MAX_DISTANCE,
      Math.max(
        SURFACE_FIT_HEIGHT / (2 * tanV),
        (width + 2 * SURFACE_SIDE_MARGIN) /
          (2 * this.tanHalfHorizontalFov(aspect))
      )
    );
    const middle = wall.center.clone().addScaledVector(wall.along, along);
    const target = middle
      .clone()
      .addScaledVector(wall.normal, SURFACE_TARGET_OFFSET);
    target.y = WALL_HEIGHT / 2;
    const position = middle.clone().addScaledVector(wall.normal, distance);
    position.y = WALL_HEIGHT / 2;
    return { position, target, tramos: n, tramo: index, tramoWidth: width };
  }

  /** Techo: desde el centro, 23° hacia arriba y hacia la zona de la TV (cornisa y colgante). */
  private ceilingPose(): SurfacePose {
    const pitch = (CEILING_PITCH_DEG * Math.PI) / 180;
    const position = new Vector3(0, this.initialHeight, 0);
    const target = position
      .clone()
      .add(
        new Vector3(
          0,
          Math.sin(pitch) * CEILING_TARGET_DISTANCE,
          Math.cos(pitch) * CEILING_TARGET_DISTANCE
        )
      );
    return { position, target, tramos: 1, tramo: 1, tramoWidth: WALL_LENGTH };
  }

  private tanHalfHorizontalFov(aspect: number): number {
    return Math.tan((this.fovFor(aspect) * Math.PI) / 360) * aspect;
  }

  /**
   * Encuadra una pared (tramo `tramo`) o el techo. Resuelve `false` si algo
   * corta el movimiento; con `prefers-reduced-motion` salta sin transición.
   */
  focusSurface(
    surface: SurfaceId,
    tramo = 1,
    aspect = this.aspect
  ): Promise<boolean> {
    if (!this.camera) return Promise.resolve(false);
    const pose = this.surfacePose(surface, tramo, aspect);
    return this.startTween(pose.position, pose.target, FOCUS_DURATION_MS, true);
  }

  /** Zona de pantalla (NDC) libre de ficha y botones; en retrato deja sitio abajo a la ficha. */
  private visibleBand(): {
    bottom: number;
    top: number;
    left: number;
    right: number;
  } {
    const blend = this.clamp((1 - this.aspect) / 0.3, 0, 1);
    const width =
      this.controls?.domElement?.clientWidth || FALLBACK_VIEWPORT_WIDTH;
    // Solo en apaisado (aspect > 1, donde la ficha va a la derecha): la zona
    // libre acaba donde empieza la columna de la ficha.
    const sheetRight =
      this.aspect > 1
        ? this.clamp(
            1 - (2 * SHEET_COLUMN_PX) / width,
            -1 + 2 * FOCUS_MARGIN,
            1
          )
        : 1;
    return {
      left: -(1 - FOCUS_MARGIN),
      right: Math.min(1 - FOCUS_MARGIN, sheetRight),
      bottom: -(1 - FOCUS_MARGIN) * (1 - blend) + SHEET_BOTTOM_NDC * blend,
      top: (1 - FOCUS_MARGIN) * (1 - blend) + TOP_BAR_NDC * blend,
    };
  }

  /**
   * Cámara y objetivo para un candidato a distancia dada: el target se acerca
   * a la cámara (en el suelo, dentro de los límites de OrbitControls) hasta que
   * el centro del mueble queda en medio de la zona visible.
   */
  private focusPoseAt(
    camera: PerspectiveCamera,
    center: Vector3,
    dir: Vector3,
    height: number,
    distance: number,
    desiredY: number,
    corners: readonly Vector3[]
  ): { position: Vector3; target: Vector3; overflow: number } {
    const position = center.clone().addScaledVector(dir, distance);
    position.y = height;
    const lookAt = center.clone();
    lookAt.y = Math.max(lookAt.y, MIN_CAMERA_HEIGHT);
    const horizontal = Math.hypot(position.x - center.x, position.z - center.z);
    const project = (target: Vector3, point: Vector3): Vector3 => {
      camera.position.copy(position);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      return point.clone().project(camera);
    };
    const targetFor = (k: number): Vector3 =>
      lookAt.clone().addScaledVector(dir, k);

    const band = this.visibleBand();
    let target = lookAt;
    if (desiredY !== 0) {
      let lo = 0;
      let hi = horizontal * 0.75;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (project(targetFor(mid), center).y < desiredY) lo = mid;
        else hi = mid;
      }
      target = targetFor(lo);
    }
    if (band.right < 1 - FOCUS_MARGIN - 1e-3) {
      // La ficha ocupa la derecha: si el mueble invade su columna, se desplaza
      // el objetivo hacia la derecha de la cámara lo justo para que no la pise.
      const right = new Vector3(dir.z, 0, -dir.x);
      const base = target;
      const maxX = (shift: number): number => {
        const shifted = base.clone().addScaledVector(right, shift);
        return Math.max(...corners.map(c => project(shifted, c).x));
      };
      if (maxX(0) > band.right) {
        let lo = 0;
        let hi = horizontal * 0.5;
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2;
          if (maxX(mid) > band.right) lo = mid;
          else hi = mid;
        }
        target = base.clone().addScaledVector(right, hi);
      }
    }
    let overflow = 0;
    for (const corner of corners) {
      const ndc = project(target, corner);
      overflow = Math.max(
        overflow,
        ndc.x - band.right,
        band.left - ndc.x,
        ndc.y - band.top,
        band.bottom - ndc.y
      );
    }
    return { position, target, overflow };
  }

  /** Distancia mínima (≥ base) con la que el mueble cabe en la zona visible. */
  private fitDistance(
    fit: (distance: number) => number,
    base: number,
    max: number
  ): number {
    if (fit(base) <= 0) return base;
    if (fit(max) > 0) return max;
    let lo = base;
    let hi = max;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (fit(mid) > 0) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  /** Elige la pose de cámara con menos oclusión (empates: el orden de prioridad). */
  private pickFocusPose(
    box: Box3,
    center: Vector3,
    away: Vector3,
    range: { baseDistance: number; minDistance: number; maxDistance: number },
    obstacles: readonly Object3D[]
  ): { position: Vector3; target: Vector3 } {
    const obstacleBoxes = obstacles
      .map(o => new Box3().setFromObject(o))
      .filter(b => !b.isEmpty());
    const samples = this.occlusionSamples(box, center);
    const corners = this.boxCorners(box);
    const band = this.visibleBand();
    const desiredY = (band.bottom + band.top) / 2;
    const probe = this.camera.clone();
    const heights = [
      this.initialHeight,
      this.initialHeight + FOCUS_RAISED_EXTRA,
    ];

    let best: { position: Vector3; target: Vector3 } | null = null;
    let bestScore = Infinity;
    for (const yaw of FOCUS_YAW_OFFSETS) {
      const dir = away.clone().applyAxisAngle(AXIS_Y, yaw);
      for (const height of heights) {
        const isDefault = yaw === 0 && height === heights[0];
        const at = (distance: number) =>
          this.focusPoseAt(
            probe,
            center,
            dir,
            // Sin mirar demasiado desde arriba objetos pequeños y cercanos.
            Math.min(
              height,
              center.y +
                distance * Math.tan((FOCUS_MAX_PITCH_DEG * Math.PI) / 180)
            ),
            distance,
            desiredY,
            corners
          );
        const distance = this.fitDistance(
          d => at(d).overflow,
          range.baseDistance,
          range.maxDistance
        );
        const pose = at(distance);
        const raw = pose.position.clone();
        this.clampPoint(pose.position);
        // El candidato por defecto conserva su clamp de siempre; el resto
        // se descarta si la sala los obliga a moverse.
        if (!isDefault && pose.position.distanceToSquared(raw) > 1e-4) continue;

        const score = this.occlusionScore(
          pose.position,
          samples,
          obstacleBoxes
        );
        if (score < bestScore) {
          best = pose;
          bestScore = score;
        }
        if (score === 0) return pose;
      }
    }
    return (
      best ?? {
        position: center.clone().addScaledVector(away, range.baseDistance),
        target: center.clone(),
      }
    );
  }

  private boxCorners(box: Box3): Vector3[] {
    const { min, max } = box;
    const points: Vector3[] = [];
    for (const x of [min.x, max.x])
      for (const y of [min.y, max.y])
        for (const z of [min.z, max.z]) points.push(new Vector3(x, y, z));
    return points;
  }

  /** Centro y esquinas (algo encogidas) de la caja del mueble. */
  private occlusionSamples(box: Box3, center: Vector3): Vector3[] {
    const inner = box.clone().expandByScalar(-OCCLUSION_INSET);
    if (inner.isEmpty()) return [center.clone()];
    const { min, max } = inner;
    const points = [center.clone()];
    for (const x of [min.x, max.x])
      for (const y of [min.y, max.y])
        for (const z of [min.z, max.z]) points.push(new Vector3(x, y, z));
    return points;
  }

  /** Nº de puntos del mueble tapados por algún obstáculo desde `from`. */
  private occlusionScore(
    from: Vector3,
    samples: readonly Vector3[],
    obstacleBoxes: readonly Box3[]
  ): number {
    if (obstacleBoxes.length === 0) return 0;
    // Un obstáculo pegado a la cámara (margen del frustum cercano) tapa la
    // vista aunque no corte ningún rayo: descarta el candidato.
    let hidden = obstacleBoxes.some(
      b => b.distanceToPoint(from) < CAMERA_CLEARANCE
    )
      ? samples.length + 1
      : 0;
    const ray = new Ray();
    const hit = new Vector3();
    for (const sample of samples) {
      ray.origin.copy(from);
      ray.direction.copy(sample).sub(from);
      const length = ray.direction.length();
      if (length < 1e-6) continue;
      ray.direction.divideScalar(length);
      const blocked = obstacleBoxes.some(
        b => ray.intersectBox(b, hit) !== null && hit.distanceTo(from) < length
      );
      if (blocked) hidden++;
    }
    return hidden;
  }

  /** Vuelve a la posición y mirada iniciales. */
  reset(): Promise<boolean> {
    if (!this.camera) return Promise.resolve(false);
    return this.startTween(
      this.framedPosition(),
      this.framedTarget(),
      MOVE_DURATION_MS
    ).then(completed => {
      // Si algo (arrastre, flechas) cortó el tween, la vista ya no es la inicial.
      if (completed && !this.tween) this.atFramedPose = true;
      return completed;
    });
  }

  /** Cancela la animación en curso; su promesa resuelve `false`. */
  cancelAnimation(): void {
    const tween = this.tween;
    if (!tween) return;
    this.tween = null;
    tween.resolve(false);
  }

  isAnimating(): boolean {
    return this.tween !== null;
  }

  private startTween(
    toPosition: Vector3,
    toTarget: Vector3,
    duration: number,
    relaxPolar = false
  ): Promise<boolean> {
    this.cancelAnimation();
    this.atFramedPose = false;
    const target = this.controls?.target ?? new Vector3();
    // Mirar una pared de frente o el techo pide un polo más abierto que el normal.
    if (relaxPolar) this.setMaxPolar(true);

    if (this.prefersReducedMotion()) {
      this.camera.position.copy(toPosition);
      target.copy(toTarget);
      this.setMaxPolar(relaxPolar);
      this.updateControls();
      return Promise.resolve(true);
    }

    return new Promise<boolean>(resolve => {
      this.tween = {
        fromPosition: this.camera.position.clone(),
        toPosition,
        fromTarget: target.clone(),
        toTarget,
        duration,
        elapsed: 0,
        relaxPolar,
        resolve,
      };
      // Los controles siguen activos: un arrastre dispara start y cancela el tween.
    });
  }

  /** Límite polar de OrbitControls: el de siempre o el abierto de paredes y techo. */
  private setMaxPolar(relaxed: boolean): void {
    if (!this.controls) return;
    this.controls.maxPolarAngle = relaxed
      ? Math.PI / 2 + (RELAXED_POLAR_EXTRA_DEG * Math.PI) / 180
      : DEFAULT_MAX_POLAR;
  }

  private currentHeading(): Vector3 {
    const target = this.controls?.target ?? new Vector3(0, 0, 0);
    const heading = target.clone().sub(this.camera.position);
    heading.y = 0;
    if (heading.lengthSq() < 1e-6) heading.set(0, 0, -1);
    return heading.normalize();
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /** Avanza animaciones y controles; llamar una vez por frame con el delta en ms. */
  update(deltaMs = 0): void {
    if (!this.camera) return;
    const tween = this.tween;
    if (tween) {
      tween.elapsed += Math.max(0, deltaMs);
      const progress = Math.min(tween.elapsed / tween.duration, 1);
      const eased = this.easeInOutQuad(progress);
      this.camera.position.lerpVectors(
        tween.fromPosition,
        tween.toPosition,
        eased
      );
      this.controls?.target.lerpVectors(
        tween.fromTarget,
        tween.toTarget,
        eased
      );
      if (progress >= 1) {
        this.tween = null;
        this.setMaxPolar(tween.relaxPolar);
        tween.resolve(true);
      }
    }
    this.updateControls();
    this.clampToRoom();
  }

  getCamera(): PerspectiveCamera {
    return this.camera;
  }

  getTarget(): Vector3 {
    return this.controls?.target ?? new Vector3();
  }

  dispose(): void {
    this.cancelAnimation();
    if (this.controls) {
      this.controls.removeEventListener('start', this.onControlsStart);
      this.controls.removeEventListener('change', this.onControlsChange);
      this.controls.stopListenToKeyEvents();
      this.controls.dispose();
      this.controls = null;
    }
  }
}
