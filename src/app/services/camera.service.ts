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
/** Metros que se retrocede la cámara inicial por cada unidad que falte a aspect 1. */
const PORTRAIT_BACKOFF = 6;
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
  private readonly onControlsStart = () => this.cancelAnimation();

  initialize(config: CameraConfiguration, aspect = 1): void {
    this.camera = new PerspectiveCamera(
      config.fov,
      aspect,
      config.near,
      config.far
    );
    this.baseFov = config.fov;
    this.initialPosition = config.initialPosition.clone();
    this.setAspect(aspect);
    this.camera.position.copy(this.framedPosition());
    this.initialHeight = config.initialHeight;
    this.initialTarget = new Vector3(0, config.initialHeight * 0.8, 0);
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
  }

  /** En pantallas estrechas mantiene un FOV horizontal mínimo (con tope vertical). */
  private fovFor(aspect: number): number {
    if (aspect >= 1) return this.baseFov;
    const half = Math.tan((MIN_HORIZONTAL_FOV * Math.PI) / 360) / aspect;
    const vertical = (2 * Math.atan(half) * 180) / Math.PI;
    return Math.min(MAX_VERTICAL_FOV, Math.max(this.baseFov, vertical));
  }

  /** Posición inicial: en pantallas estrechas retrocede (dentro de la sala). */
  private framedPosition(): Vector3 {
    const position = this.initialPosition.clone();
    if (this.aspect < 1) {
      position.z += (1 - this.aspect) * PORTRAIT_BACKOFF;
      this.clampPoint(position);
      position.y = this.initialPosition.y;
    }
    return position;
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
    controls.target.copy(this.initialTarget);
    controls.addEventListener('start', this.onControlsStart);
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
    this.controls.maxDistance = Math.max(
      this.controls.minDistance + 1,
      Math.min(halfWidth, halfDepth)
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
      this.initialTarget.clone(),
      MOVE_DURATION_MS
    );
  }

  /** Cancela la animación en curso; su promesa resuelve `false`. */
  cancelAnimation(): void {
    const tween = this.tween;
    if (!tween) return;
    this.tween = null;
    if (this.controls) this.controls.enabled = true;
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
    const target = this.controls?.target ?? new Vector3();

    if (this.prefersReducedMotion()) {
      this.camera.position.copy(toPosition);
      target.copy(toTarget);
      this.controls?.update();
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
      if (this.controls) this.controls.enabled = false;
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
        if (this.controls) this.controls.enabled = true;
        tween.resolve(true);
      }
    }
    this.controls?.update();
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
      this.controls.stopListenToKeyEvents();
      this.controls.dispose();
      this.controls = null;
    }
  }
}
