import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import {
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import {
  ModelConfiguration,
  ObjectInfo,
  ScreenPoint,
} from '../interfaces/scene.interface';
import { CameraService } from './camera.service';
import { ModelLoaderService, disposeObject3D } from './model-loader.service';
import { ObjectInteractionService } from './object-interaction.service';
import { RoomBuilderService } from './room-builder.service';
import { ViewerStateService } from './viewer-state.service';

export type ModelId = keyof typeof MODEL_CONFIGURATIONS;

/** Subconjunto de WebGLRenderer que usa SceneService (permite stubs en tests). */
export type SceneRenderer = Pick<
  WebGLRenderer,
  | 'render'
  | 'setSize'
  | 'setPixelRatio'
  | 'dispose'
  | 'forceContextLoss'
  | 'shadowMap'
  | 'info'
>;

/** Crea el renderer; lanza si WebGL no está disponible. */
export const RENDERER_FACTORY = new InjectionToken<
  (canvas: HTMLCanvasElement) => SceneRenderer
>('RENDERER_FACTORY', {
  providedIn: 'root',
  factory: () => (canvas: HTMLCanvasElement) => {
    const probe = document.createElement('canvas');
    const supported =
      !!probe.getContext('webgl2') || !!probe.getContext('webgl');
    if (!supported) {
      throw new Error('WebGL is not available');
    }
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    return renderer;
  },
});

/** Métodos de ObjectInteractionService que aún dependen de F4a. */
type InteractionApi = ObjectInteractionService & {
  setCanvas?(canvas: HTMLElement | null): void;
  setContext?(camera: PerspectiveCamera, scene: Scene): void;
  update?(timeMs: number): void;
  setHover?(ndc: { x: number; y: number } | null): void;
  onHoverChange?: ((hover: { object: Object3D } | null) => void) | null;
};

const MAX_FRAME_DELTA_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class SceneService {
  private scene!: Scene;
  private renderer: SceneRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;

  private rafId: number | null = null;
  private lastFrameTime = -1;
  private resizeObserver: ResizeObserver | null = null;
  private generation = 0;

  private readonly models = new Map<
    ModelId,
    { object: Object3D; info: ObjectInfo }
  >();
  private readonly objectIds = new Map<Object3D, ModelId>();
  private readonly modelProgress = new Map<ModelId, number>();
  private readonly failed = new Map<ModelId, unknown>();
  private readonly pending = new Map<ModelId, Promise<void>>();

  private readonly zone = inject(NgZone);
  private readonly rendererFactory = inject(RENDERER_FACTORY);
  private readonly cameraService = inject(CameraService);
  private readonly modelLoaderService = inject(ModelLoaderService);
  private readonly objectInteractionService = inject(ObjectInteractionService);
  private readonly roomBuilderService = inject(RoomBuilderService);
  private readonly state = inject(ViewerStateService);

  // Referencias estables para poder quitar los listeners en dispose().
  private readonly onWindowResize = () => this.handleResize();
  private readonly onVisibilityChange = () => {
    if (document.hidden) {
      this.stopLoop();
    } else {
      this.startLoop();
    }
  };
  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.stopLoop();
    this.state.sceneReady.set(false);
    this.state.error.set({
      code: 'webgl-context-lost',
      message: 'The 3D context was lost. It will recover automatically.',
    });
  };
  private readonly onContextRestored = () => {
    if (this.state.error()?.code === 'webgl-context-lost') {
      this.state.error.set(null);
    }
    this.state.sceneReady.set(this.state.loadStatus() !== 'loading');
    this.startLoop();
  };

  // ── Ciclo de vida ─────────────────────────────────────────────────

  initialize(canvas: HTMLCanvasElement): void {
    if (this.isInitialized) {
      console.warn('Scene is already initialized');
      return;
    }

    try {
      this.renderer = this.rendererFactory(canvas);
    } catch (error) {
      console.error('WebGL unavailable:', error);
      this.state.loadStatus.set('error');
      this.state.error.set({
        code: 'webgl-unavailable',
        message: 'Your browser or device cannot run the 3D viewer (WebGL).',
      });
      return;
    }

    this.canvas = canvas;
    this.scene = new Scene();
    this.cameraService.setRoomLimits(DEFAULT_SCENE_CONFIG.room.limits);
    this.cameraService.initialize(
      DEFAULT_SCENE_CONFIG.camera,
      this.containerAspect()
    );
    this.cameraService.setupControls(canvas);
    this.roomBuilderService.buildRoom(this.scene, DEFAULT_SCENE_CONFIG.room);
    this.objectInteractionService.setRoomLimits(
      DEFAULT_SCENE_CONFIG.room.limits
    );

    // TODO F4a: setCanvas/setContext/onHoverChange aún no existen en esta rama.
    const interaction = this.objectInteractionService as InteractionApi;
    interaction.setCanvas?.(canvas);
    interaction.setContext?.(this.cameraService.getCamera(), this.scene);
    interaction.onHoverChange = hover => {
      const id = hover ? (this.objectIds.get(hover.object) ?? null) : null;
      if (this.state.hovered() !== id) this.state.hovered.set(id);
    };

    this.applySize();
    this.addListeners(canvas);
    this.isInitialized = true;
    this.startLoop();
  }

  dispose(): void {
    if (!this.isInitialized && !this.renderer) return;

    this.generation++;
    this.stopLoop();
    this.removeListeners();

    this.cameraService.dispose();
    const interaction = this.objectInteractionService as InteractionApi;
    interaction.onHoverChange = null;
    interaction.setCanvas?.(null);
    interaction.dispose();
    this.modelLoaderService.dispose();

    if (this.scene) {
      disposeObject3D(this.scene);
      this.scene.clear();
    }
    this.models.clear();
    this.objectIds.clear();
    this.modelProgress.clear();
    this.failed.clear();
    this.pending.clear();

    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.canvas?.removeAttribute('data-ready');
    this.canvas = null;
    this.isInitialized = false;
    this.state.reset();
  }

  // ── Bucle de render (fuera de Angular, sin tocar señales) ─────────

  private startLoop(): void {
    if (this.rafId !== null || !this.isInitialized || document.hidden) return;
    this.lastFrameTime = -1;
    this.zone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.frame);
    });
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private readonly frame = (time: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const delta =
      this.lastFrameTime < 0
        ? 0
        : Math.min(time - this.lastFrameTime, MAX_FRAME_DELTA_MS);
    this.lastFrameTime = time;

    this.cameraService.update(delta);
    // TODO F4a: `update` aún no existe en ObjectInteractionService.
    (this.objectInteractionService as InteractionApi).update?.(time);
    this.renderer?.render(this.scene, this.cameraService.getCamera());
  };

  // ── Tamaño y listeners ────────────────────────────────────────────

  private addListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.onWindowResize);
      this.resizeObserver.observe(this.container(canvas));
    } else {
      window.addEventListener('resize', this.onWindowResize);
    }
  }

  private removeListeners(): void {
    this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas?.removeEventListener(
      'webglcontextrestored',
      this.onContextRestored
    );
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('resize', this.onWindowResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private container(canvas: HTMLCanvasElement): HTMLElement {
    return canvas.parentElement ?? canvas;
  }

  private containerSize(): { width: number; height: number } {
    const el = this.canvas ? this.container(this.canvas) : null;
    const width = el?.clientWidth || window.innerWidth;
    const height = el?.clientHeight || window.innerHeight;
    return { width, height };
  }

  private containerAspect(): number {
    const { width, height } = this.containerSize();
    return height > 0 ? width / height : 1;
  }

  private applySize(): void {
    if (!this.renderer) return;
    const { width, height } = this.containerSize();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.cameraService.setAspect(height > 0 ? width / height : 1);
  }

  private handleResize(): void {
    if (this.isInitialized) this.applySize();
  }

  // ── Carga ─────────────────────────────────────────────────────────

  private modelIds(): ModelId[] {
    return Object.keys(MODEL_CONFIGURATIONS) as ModelId[];
  }

  /** Carga todos los modelos; los fallos van a `ViewerStateService.error`. */
  async loadAll(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Scene not initialized');
      return;
    }
    this.state.loadStatus.set('loading');
    this.state.loadProgress.set(0);
    this.state.error.set(null);
    await this.loadModels(this.modelIds());
  }

  /** Reintenta los modelos que fallaron (o solo `id`). */
  async retryLoad(id?: string): Promise<void> {
    if (!this.isInitialized) return;
    const ids = id
      ? this.modelIds().filter(m => m === id)
      : this.modelIds().filter(m => !this.models.has(m));
    if (ids.length === 0) return;
    this.state.loadStatus.set('loading');
    this.state.error.set(null);
    await this.loadModels(ids);
  }

  private async loadModels(ids: ModelId[]): Promise<void> {
    const generation = this.generation;
    ids.forEach(id => {
      this.failed.delete(id);
      if (!this.models.has(id)) this.modelProgress.set(id, 0);
    });
    this.publishProgress();

    await Promise.allSettled(ids.map(id => this.loadOne(id)));
    if (generation !== this.generation) return;

    this.publishProgress();
    if (this.failed.size > 0) {
      const names = [...this.failed.keys()].map(
        id => MODEL_CONFIGURATIONS[id].metadata.name
      );
      this.state.loadStatus.set('error');
      this.state.error.set({
        code: 'model-load-failed',
        message: `Could not load: ${names.join(', ')}.`,
        retry: () => void this.retryLoad(),
      });
    } else {
      this.state.loadStatus.set('ready');
    }
    this.state.sceneReady.set(true);
    this.canvas?.setAttribute('data-ready', 'true');
  }

  /** Carga un modelo una sola vez (llamadas concurrentes comparten la promesa). */
  private loadOne(id: ModelId): Promise<void> {
    if (this.models.has(id)) return Promise.resolve();
    const running = this.pending.get(id);
    if (running) return running;

    const generation = this.generation;
    const config: ModelConfiguration = MODEL_CONFIGURATIONS[id];
    const task = this.modelLoaderService
      .loadModel(config, (loaded, total) => {
        if (generation !== this.generation) return;
        this.modelProgress.set(
          id,
          total > 0 ? Math.min(loaded / total, 0.99) : 0
        );
        this.publishProgress();
      })
      .then(object => {
        if (generation !== this.generation) {
          disposeObject3D(object);
          return;
        }
        this.scene.add(object);
        this.models.set(id, { object, info: config.metadata });
        this.objectIds.set(object, id);
        this.objectInteractionService.addObject(object, config.metadata);
        this.modelProgress.set(id, 1);
      })
      .catch(error => {
        console.error(`Error loading model ${config.path}:`, error);
        if (generation === this.generation) this.failed.set(id, error);
      })
      .finally(() => {
        this.pending.delete(id);
      });
    this.pending.set(id, task);
    return task;
  }

  /** Progreso agregado 0–100 sin dividir entre totales desconocidos. */
  private publishProgress(): void {
    const ids = this.modelIds();
    const sum = ids.reduce(
      (acc, id) => acc + (this.modelProgress.get(id) ?? 0),
      0
    );
    const percent = Math.round((sum / ids.length) * 100);
    this.state.loadProgress.set(
      Math.max(this.state.loadProgress(), Math.min(percent, 100))
    );
  }

  // ── API para la UI ────────────────────────────────────────────────

  getObjectList(): { id: string; name: string }[] {
    return [...this.models.entries()].map(([id, entry]) => ({
      id,
      name: entry.info.name,
    }));
  }

  /** Selecciona un mueble por id: abre su ficha y acerca la cámara (D-04). */
  selectObject(id: string): void {
    const entry = this.models.get(id as ModelId);
    if (!entry) return;
    this.objectInteractionService.removeOutline();
    this.objectInteractionService.createOutline(entry.object);
    this.state.selected.set(entry.info);
    void this.cameraService.focusOn(entry.object);
  }

  clearSelection(): void {
    this.objectInteractionService.removeOutline();
    this.state.selected.set(null);
  }

  resetView(): void {
    void this.cameraService.reset();
  }

  /** Clic/toque sobre el canvas: suelo → caminar; mueble → seleccionar. */
  async handlePointerSelect(point: ScreenPoint): Promise<void> {
    if (!this.isInitialized || !this.canvas) return;
    const generation = this.generation;

    const result = await this.objectInteractionService.handleClick(
      this.asMouseEvent(point),
      this.cameraService.getCamera(),
      this.scene
    );
    if (generation !== this.generation) return;

    if (result.floorPoint) {
      this.state.selected.set(null);
      void this.cameraService.teleportTo(result.floorPoint);
    } else if (result.object && this.objectIds.has(result.object)) {
      this.selectObject(this.objectIds.get(result.object) as string);
    } else if (result.success && result.objectInfo) {
      // Compatibilidad con la versión previa de F4a (solo `objectInfo`).
      this.state.selected.set(result.objectInfo);
    } else if (result.success) {
      this.state.selected.set(null);
    }
  }

  /** Movimiento del puntero; `null` cuando sale del canvas. */
  handlePointerMove(point: ScreenPoint | null): void {
    if (!this.isInitialized || !this.canvas) return;
    const interaction = this.objectInteractionService as InteractionApi;

    let ndc: { x: number; y: number } | null = null;
    if (point) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        ndc = {
          x: ((point.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((point.clientY - rect.top) / rect.height) * 2 + 1,
        };
      }
    }
    // TODO F4a: setHover aún no existe; el id llega por onHoverChange.
    interaction.setHover?.(ndc);
  }

  private asMouseEvent(point: ScreenPoint): MouseEvent {
    return {
      clientX: point.clientX,
      clientY: point.clientY,
      target: this.canvas,
    } as unknown as MouseEvent;
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): PerspectiveCamera {
    return this.cameraService.getCamera();
  }

  // ── Compatibilidad con el visor actual (F7 lo reemplaza) ──────────

  /** @deprecated F7: usar `handlePointerSelect` y `ViewerStateService.selected`. */
  async onMouseClick(event: MouseEvent): Promise<ObjectInfo | null> {
    await this.handlePointerSelect(event);
    return this.state.selected();
  }

  /** @deprecated F7: usar `loadAll`. */
  async loadSofa(): Promise<Object3D | null> {
    return this.loadLegacy('sofa');
  }

  /** @deprecated F7: usar `loadAll`. */
  async loadPokerTable(): Promise<Object3D | null> {
    return this.loadLegacy('pokerTable');
  }

  /** @deprecated F7: usar `loadAll`. */
  async loadBookshelf(): Promise<Object3D | null> {
    return this.loadLegacy('bookshelf');
  }

  private async loadLegacy(id: ModelId): Promise<Object3D | null> {
    await this.loadOne(id);
    return this.models.get(id)?.object ?? null;
  }

  /** @deprecated Usar `handlePointerSelect` (el teleport lo hace el servicio). */
  teleportTo(position: Vector3): Promise<boolean> {
    return this.cameraService.teleportTo(position);
  }
}
