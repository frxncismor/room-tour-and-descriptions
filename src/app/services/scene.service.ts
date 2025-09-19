import { Injectable, inject } from '@angular/core';
import { Euler, Scene, Vector3, WebGLRenderer } from 'three';
import {
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import { ModelConfiguration, ObjectInfo } from '../interfaces/scene.interface';
import { CameraService } from './camera.service';
import { ModelLoaderService } from './model-loader.service';
import { ObjectInteractionService } from './object-interaction.service';
import { RoomBuilderService } from './room-builder.service';

@Injectable({
  providedIn: 'root',
})
export class SceneService {
  private scene!: Scene;
  private renderer!: WebGLRenderer;
  private isInitialized = false;

  private readonly cameraService = inject(CameraService);
  private readonly modelLoaderService = inject(ModelLoaderService);
  private readonly objectInteractionService = inject(ObjectInteractionService);
  private readonly roomBuilderService = inject(RoomBuilderService);

  initialize(canvas: HTMLCanvasElement): void {
    if (this.isInitialized) {
      console.warn('Scene is already initialized');
      return;
    }

    this.setupRenderer(canvas);
    this.setupScene();
    this.setupCamera();
    this.setupControls(canvas);
    this.setupRoom();
    this.setupObjectInteraction();
    this.startAnimation();
    this.setupWindowResize();

    this.isInitialized = true;
  }

  private setupRenderer(canvas: HTMLCanvasElement): void {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
  }

  private setupScene(): void {
    this.scene = new Scene();
  }

  private setupCamera(): void {
    this.cameraService.initialize(DEFAULT_SCENE_CONFIG.camera);
  }

  private setupControls(canvas: HTMLCanvasElement): void {
    this.cameraService.setupControls(canvas);
  }

  private setupRoom(): void {
    this.roomBuilderService.buildRoom(this.scene, DEFAULT_SCENE_CONFIG.room);
  }

  private setupObjectInteraction(): void {
    this.objectInteractionService.setRoomLimits(
      DEFAULT_SCENE_CONFIG.room.limits
    );
  }

  private startAnimation(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      this.cameraService.update();
      this.renderer.render(this.scene, this.cameraService.getCamera());
    };
    animate();
  }

  private setupWindowResize(): void {
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  private handleWindowResize(): void {
    if (this.renderer && this.cameraService.getCamera()) {
      const camera = this.cameraService.getCamera();
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  async onMouseClick(event: MouseEvent): Promise<ObjectInfo | null> {
    if (!this.isInitialized) {
      console.warn('Scene not initialized');
      return null;
    }

    const result = await this.objectInteractionService.handleClick(
      event,
      this.cameraService.getCamera(),
      this.scene
    );

    if (result.success && result.objectInfo) {
      return result.objectInfo;
    }

    return null;
  }

  async loadModel(
    path: string,
    position: Vector3,
    scale: number = 1,
    rotation: Euler = new Euler()
  ): Promise<Object3D> {
    const config: ModelConfiguration = {
      path,
      position,
      scale,
      rotation,
      metadata: { name: '', description: '' },
    };

    const model = await this.modelLoaderService.loadModel(config);
    this.scene.add(model);
    return model;
  }

  addObject(object: Object3D, name: string, description: string): void {
    const objectInfo: ObjectInfo = { name, description };
    this.objectInteractionService.addObject(object, objectInfo);
  }

  async teleportTo(position: Vector3): Promise<boolean> {
    return this.cameraService.teleportTo(position);
  }

  async loadSofa(): Promise<Object3D> {
    const config = MODEL_CONFIGURATIONS.sofa;
    const sofa = await this.loadModel(
      config.path,
      config.position,
      config.scale,
      config.rotation
    );
    this.addObject(sofa, config.metadata.name, config.metadata.description);
    return sofa;
  }

  async loadPokerTable(): Promise<Object3D> {
    const config = MODEL_CONFIGURATIONS.pokerTable;
    const pokerTable = await this.loadModel(
      config.path,
      config.position,
      config.scale,
      config.rotation
    );
    this.addObject(
      pokerTable,
      config.metadata.name,
      config.metadata.description
    );
    return pokerTable;
  }

  async loadBookshelf(): Promise<Object3D> {
    const config = MODEL_CONFIGURATIONS.bookshelf;
    const bookshelf = await this.loadModel(
      config.path,
      config.position,
      config.scale,
      config.rotation
    );
    this.addObject(
      bookshelf,
      config.metadata.name,
      config.metadata.description
    );
    return bookshelf;
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): unknown {
    return this.cameraService.getCamera();
  }

  getRenderer(): WebGLRenderer {
    return this.renderer;
  }

  dispose(): void {
    if (!this.isInitialized) return;

    this.cleanupRenderer();
    this.cleanupServices();
    this.removeEventListeners();

    this.isInitialized = false;
  }

  private cleanupRenderer(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  private cleanupServices(): void {
    this.cameraService.dispose();
    this.objectInteractionService.dispose();
    this.modelLoaderService.dispose();
  }

  private removeEventListeners(): void {
    window.removeEventListener('resize', this.handleWindowResize);
  }
}
