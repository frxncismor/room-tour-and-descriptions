import { Injectable } from '@angular/core';
import { Box3, Object3D, PerspectiveCamera, Sphere, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
import { CameraConfiguration, RoomLimits } from '../interfaces/scene.interface';

/** Margen (m) entre la cámara y las paredes. */
const WALL_MARGIN = 0.5;
/** FOV horizontal mínimo en pantallas estrechas (grados) y tope del vertical. */
const MIN_HORIZONTAL_FOV = 50;
const MAX_VERTICAL_FOV = 90;
/**
 * Vista inicial en retrato (aspect <= PORTRAIT_FULL_ASPECT): la cámara sube y
 * mira hacia abajo, al centro de los muebles, para que la profundidad de la
 * sala llene el alto en vez de dejar techo y suelo vacíos. Entre aspect 1 y
 * PORTRAIT_FULL_ASPECT se mezcla con la vista de escritorio (sin saltos).
 */
const PORTRAIT_FULL_ASPECT = 0.5;
const PORTRAIT_POSITION = new Vector3(-0.15, 3.9, 6.2);
const PORTRAIT_TARGET = new Vector3(-0.15, 0, -4.8);
const MIN_CAMERA_HEIGHT = 0.3;
const MOVE_DURATION_MS = 1200;
const FOCUS_DURATION_MS = 900;

interface Tween {
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  duration: number;
  elapsed: number;
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
    controls.minDistance = 1;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI / 2.1;
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

  /** `maxDistance` derivado de la sala: nunca más lejos que su semi-lado menor. */
  private applyDistanceLimit(): void {
    if (!this.controls) return;
    const halfWidth = (this.limits.maxX - this.limits.minX) / 2;
    const halfDepth = (this.limits.maxZ - this.limits.minZ) / 2;
    // La vista inicial (retrato) puede quedar algo más lejos que el semi-lado.
    const framed = this.camera
      ? this.framedPosition().distanceTo(this.framedTarget()) + 0.1
      : 0;
    this.controls.maxDistance = Math.max(
      this.controls.minDistance + 1,
      Math.min(halfWidth, halfDepth),
      framed
    );
  }

  /** Mantiene cámara y objetivo dentro de la sala (nunca se ve el exterior). */
  clampToRoom(): void {
    if (!this.camera) return;
    this.clampPoint(this.camera.position);
    if (this.controls) {
      this.clampPoint(this.controls.target);
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

  /** Acerca la cámara a `object` para verlo entero (D-04). */
  focusOn(object: Object3D): Promise<boolean> {
    if (!this.camera) return Promise.resolve(false);
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return Promise.resolve(false);

    const sphere = box.getBoundingSphere(new Sphere());
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const minDistance = this.controls?.minDistance ?? 1;
    const maxDistance = this.controls?.maxDistance ?? 8;
    const distance = this.clamp(
      (sphere.radius / Math.sin(halfFov)) * 1.15,
      minDistance,
      maxDistance
    );

    const away = this.camera.position.clone().sub(sphere.center);
    away.y = 0;
    if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
    away.normalize();

    const toPosition = sphere.center.clone().addScaledVector(away, distance);
    toPosition.y = this.initialHeight;
    this.clampPoint(toPosition);
    const toTarget = sphere.center.clone();
    toTarget.y = Math.max(toTarget.y, MIN_CAMERA_HEIGHT);
    return this.startTween(toPosition, toTarget, FOCUS_DURATION_MS);
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
    duration: number
  ): Promise<boolean> {
    this.cancelAnimation();
    this.atFramedPose = false;
    const target = this.controls?.target ?? new Vector3();

    if (this.prefersReducedMotion()) {
      this.camera.position.copy(toPosition);
      target.copy(toTarget);
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
        resolve,
      };
      // Los controles siguen activos: un arrastre dispara start y cancela el tween.
    });
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
