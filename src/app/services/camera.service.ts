import { Injectable } from '@angular/core';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraConfiguration } from '../interfaces/scene.interface';

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  private camera!: PerspectiveCamera;
  private controls!: OrbitControls;
  private initialHeight = 1.7;
  private isAnimating = false;
  private isOrbitEnabled = true;

  initialize(config: CameraConfiguration): void {
    this.camera = new PerspectiveCamera(
      config.fov,
      window.innerWidth / window.innerHeight,
      config.near,
      config.far
    );
    this.camera.position.copy(config.initialPosition);
    this.initialHeight = config.initialHeight;
  }

  setupControls(rendererElement: HTMLElement): void {
    this.controls = new OrbitControls(this.camera, rendererElement);
    this.configureControls();
    this.setupControlListeners();
  }

  private configureControls(): void {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minPolarAngle = 0.1;
    this.controls.rotateSpeed = 0.7;
    this.controls.enablePan = false;
    this.controls.target.y = this.initialHeight * 0.8;
  }

  private setupControlListeners(): void {
    this.controls.addEventListener('change', () => {
      this.camera.position.y = this.initialHeight;
      this.controls.target.y = this.initialHeight * 0.8;
    });
  }

  async teleportTo(position: Vector3): Promise<boolean> {
    if (this.isAnimating) return false;

    this.isAnimating = true;
    this.isOrbitEnabled = false;

    const duration = 1200;
    const startPosition = this.camera.position.clone();
    const startTime = Date.now();

    await this.animateTeleportation(
      position,
      startPosition,
      startTime,
      duration
    );

    this.isAnimating = false;
    this.isOrbitEnabled = true;
    this.camera.position.y = this.initialHeight;
    this.controls.target.y = this.initialHeight * 0.8;

    return true;
  }

  private animateTeleportation(
    targetPosition: Vector3,
    startPosition: Vector3,
    startTime: number,
    duration: number
  ): Promise<void> {
    return new Promise(resolve => {
      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeInOutQuad(progress);

        const newPosition = startPosition
          .clone()
          .lerp(targetPosition, easeProgress);
        newPosition.y = this.initialHeight;
        this.camera.position.copy(newPosition);

        const targetLookAt = new Vector3(
          newPosition.x,
          this.initialHeight * 0.8,
          newPosition.z - 2
        );
        this.controls.target.lerp(targetLookAt, easeProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  private easeInOutQuad(t: number): number {
    t *= 2;
    if (t < 1) return 0.5 * t * t;
    t--;
    return -0.5 * (t * (t - 2) - 1);
  }

  update(): void {
    if (this.controls && this.isOrbitEnabled) {
      this.controls.update();
    }
  }

  getCamera(): PerspectiveCamera {
    return this.camera;
  }

  dispose(): void {
    if (this.controls) {
      this.controls.dispose();
    }
  }
}
