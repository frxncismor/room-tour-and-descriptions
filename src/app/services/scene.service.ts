import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
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
import {
  ObjectInteractionService,
  PointerLike,
} from './object-interaction.service';
import { RoomBuilderService } from './room-builder.service';
import { ViewerStateService } from './viewer-state.service';

/** Global de Angular: el build de producción lo fija a false y elimina el bloque. */
declare const ngDevMode: boolean | undefined;

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
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      stencil: true, // el contorno por casco usa stencil (por defecto está desactivado)
    });
    renderer.shadowMap.enabled = true;
    return renderer;
  },
});

/** Coste de render del último frame y memoria GPU viva (diagnóstico). */
export interface RenderStats {
  calls: number;
  triangles: number;
  textures: number;
  geometries: number;
}

const MAX_FRAME_DELTA_MS = 100;
/** Fallos de frame seguidos tras los que se para el bucle y se avisa. */
export const MAX_CONSECUTIVE_FRAME_FAILURES = 3;

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
  private frameFailures = 0;
  private frameErrorLogged = false;
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

    const interaction = this.objectInteractionService;
    interaction.setCanvas(canvas);
    interaction.setContext(this.cameraService.getCamera(), this.scene);
    interaction.onHoverChange = hover => {
      const id = hover ? (this.objectIds.get(hover.object) ?? null) : null;
      if (this.state.hovered() !== id) this.state.hovered.set(id);
    };

    this.applySize();
    this.addListeners(canvas);
    this.isInitialized = true;
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      Object.assign(window, { __rtad: { stats: () => this.getRenderStats() } });
    }
    this.startLoop();
  }

  dispose(): void {
    if (!this.isInitialized && !this.renderer) return;

    this.generation++;
    this.stopLoop();
    Reflect.deleteProperty(window, '__rtad');
    this.removeListeners();

    this.cameraService.dispose();
    const interaction = this.objectInteractionService;
    interaction.onHoverChange = null;
    interaction.setCanvas(null);
    interaction.dispose();

    if (this.scene) {
      this.roomBuilderService.dispose(this.scene);
      disposeObject3D(this.scene);
      this.scene.clear();
    }
    this.models.clear();
    this.objectIds.clear();
    this.modelProgress.clear();
    this.failed.clear();
    this.pending.clear();
    this.frameFailures = 0;
    this.frameErrorLogged = false;

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
    try {
      const delta =
        this.lastFrameTime < 0
          ? 0
          : Math.min(time - this.lastFrameTime, MAX_FRAME_DELTA_MS);
      this.lastFrameTime = time;

      this.cameraService.update(delta);
      this.objectInteractionService.update(time);
      this.renderer?.render(this.scene, this.cameraService.getCamera());
      this.frameFailures = 0;
    } catch (error) {
      this.onFrameError(error);
    }
  };

  /** Tolera fallos puntuales; tras N seguidos para el bucle y ofrece reintentar. */
  private onFrameError(error: unknown): void {
    this.frameFailures++;
    if (!this.frameErrorLogged) {
      this.frameErrorLogged = true;
      console.error('Render frame failed:', error);
    }
    if (this.frameFailures < MAX_CONSECUTIVE_FRAME_FAILURES) return;

    this.stopLoop();
    this.state.sceneReady.set(false);
    this.state.error.set({
      code: 'render-failed',
      message: 'The 3D view stopped working. Try again.',
      retry: () => this.resumeAfterRenderFailure(),
    });
  }

  private resumeAfterRenderFailure(): void {
    if (!this.isInitialized) return;
    this.frameFailures = 0;
    this.frameErrorLogged = false;
    if (this.state.error()?.code === 'render-failed')
      this.state.error.set(null);
    this.state.sceneReady.set(this.state.loadStatus() !== 'loading');
    this.startLoop();
  }

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
    this.objectInteractionService.setCanvasSize(width, height);
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
    this.clearLoadError();
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
    this.clearLoadError();
    await this.loadModels(ids);
  }

  /** Solo borra errores de carga: un `render-failed` o de WebGL sigue vigente. */
  private clearLoadError(): void {
    if (this.state.error()?.code === 'model-load-failed') {
      this.state.error.set(null);
    }
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
    this.objectInteractionService.selectObject(entry.object);
    this.state.selected.set(entry.info);
    const obstacles = [...this.models.values()]
      .filter(other => other !== entry)
      .map(other => other.object);
    void this.cameraService.focusOn(entry.object, obstacles);
  }

  clearSelection(): void {
    this.objectInteractionService.clearSelection();
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
      this.asPointerEvent(point),
      this.cameraService.getCamera(),
      this.scene
    );
    if (generation !== this.generation) return;

    if (result.floorPoint) {
      this.state.selected.set(null);
      void this.cameraService.teleportTo(result.floorPoint);
    } else if (result.object && this.objectIds.has(result.object)) {
      this.selectObject(this.objectIds.get(result.object) as ModelId);
    } else {
      // Sin acierto (o fallo del raycast) no debe quedar una ficha abierta.
      this.state.selected.set(null);
    }
  }

  /** Movimiento del puntero; `null` cuando sale del canvas. */
  handlePointerMove(point: ScreenPoint | null): void {
    if (!this.isInitialized || !this.canvas) return;
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
    // El id llega por onHoverChange.
    this.objectInteractionService.setHover(ndc);
  }

  private asPointerEvent(point: ScreenPoint): PointerLike {
    return {
      clientX: point.clientX,
      clientY: point.clientY,
      pointerType: point.pointerType,
      target: this.canvas,
    } as PointerLike;
  }

  /** Draw calls y triángulos del último frame (three.js resetea `info.render` al *empezar* cada render, así que fuera del bucle siempre es el frame completo anterior); texturas y geometrías vivas. */
  getRenderStats(): RenderStats {
    const info = this.renderer?.info;
    return {
      calls: info?.render.calls ?? 0,
      triangles: info?.render.triangles ?? 0,
      textures: info?.memory.textures ?? 0,
      geometries: info?.memory.geometries ?? 0,
    };
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): PerspectiveCamera {
    return this.cameraService.getCamera();
  }
}
