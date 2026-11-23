import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import {
  ACESFilmicToneMapping,
  Group,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  DECOR_CONFIGURATIONS,
  DEFAULT_SCENE_CONFIG,
  FLOOR_TEXTURES,
  MODEL_CONFIGURATIONS,
  RUG_TEXTURES,
} from '../config/scene.config';
import {
  ModelConfiguration,
  ObjectInfo,
  ScreenPoint,
} from '../interfaces/scene.interface';
import { CameraService } from './camera.service';
import {
  ModelLoaderService,
  disableRaycast,
  disposeObject3D,
} from './model-loader.service';
import {
  ObjectInteractionService,
  PointerLike,
} from './object-interaction.service';
import { RoomBuilderService, RoomTextureSet } from './room-builder.service';
import { ViewerStateService } from './viewer-state.service';

/** Global de Angular: el build de producción lo fija a false y elimina el bloque. */
declare const ngDevMode: boolean | undefined;

export type ModelId = keyof typeof MODEL_CONFIGURATIONS;
type DecorId = keyof typeof DECOR_CONFIGURATIONS;

/** Texturas de la sala que cuentan en el progreso (clave `tex:<set>`). */
const TEXTURE_SETS: Record<RoomTextureSet, { label: string }> = {
  floor: FLOOR_TEXTURES,
  rug: RUG_TEXTURES,
};

const TONE_MAPPING = {
  neutral: NeutralToneMapping,
  aces: ACESFilmicToneMapping,
  none: NoToneMapping,
} as const;

/** Subconjunto de WebGLRenderer que usa SceneService (permite stubs en tests). */
export type SceneRenderer = Pick<
  WebGLRenderer,
  | 'render'
  | 'setSize'
  | 'setPixelRatio'
  | 'dispose'
  | 'forceContextLoss'
  | 'shadowMap'
  | 'toneMapping'
  | 'toneMappingExposure'
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
  private decorGroup: Group | null = null;
  private readonly decorLoaded = new Set<DecorId>();
  private readonly texturesLoaded = new Set<RoomTextureSet>();
  /** Progreso 0-1 por clave: `<modelo>`, `decor:<id>` o `tex:<set>`. */
  private readonly modelProgress = new Map<string, number>();
  private readonly failed = new Map<string, unknown>();
  private readonly pending = new Map<string, Promise<void>>();

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

    this.renderer.toneMapping =
      TONE_MAPPING[DEFAULT_SCENE_CONFIG.renderer.toneMapping];
    this.renderer.toneMappingExposure = DEFAULT_SCENE_CONFIG.renderer.exposure;
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
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      Reflect.deleteProperty(window, '__rtad');
    }
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
    this.decorGroup = null;
    this.decorLoaded.clear();
    this.texturesLoaded.clear();
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

  private decorIds(): DecorId[] {
    return Object.keys(DECOR_CONFIGURATIONS) as DecorId[];
  }

  private textureSets(): RoomTextureSet[] {
    return Object.keys(TEXTURE_SETS) as RoomTextureSet[];
  }

  /** Todas las piezas que cuentan en la carga: modelos, decoración y texturas. */
  private allKeys(): string[] {
    return [
      ...this.modelIds(),
      ...this.decorIds().map(id => `decor:${id}`),
      ...this.textureSets().map(set => `tex:${set}`),
    ];
  }

  private isLoaded(key: string): boolean {
    if (key.startsWith('decor:')) {
      return this.decorLoaded.has(key.slice(6) as DecorId);
    }
    if (key.startsWith('tex:')) {
      return this.texturesLoaded.has(key.slice(4) as RoomTextureSet);
    }
    return this.models.has(key as ModelId);
  }

  private label(key: string): string {
    if (key.startsWith('decor:')) {
      return DECOR_CONFIGURATIONS[key.slice(6) as DecorId].label;
    }
    if (key.startsWith('tex:')) {
      return TEXTURE_SETS[key.slice(4) as RoomTextureSet].label;
    }
    return MODEL_CONFIGURATIONS[key as ModelId].metadata.name;
  }

  /** Carga todo: modelos, decoración y texturas; los fallos van a `ViewerStateService.error`. */
  async loadAll(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Scene not initialized');
      return;
    }
    this.state.loadStatus.set('loading');
    this.state.loadProgress.set(0);
    this.clearLoadError();
    await this.load(this.allKeys());
  }

  /** Carga las piezas decorativas no interactivas (sin ficha ni selección). */
  async loadDecor(keys?: string[]): Promise<void> {
    const wanted = keys ?? this.decorIds().map(id => `decor:${id}`);
    await Promise.allSettled(wanted.map(key => this.loadDecorOne(key)));
  }

  /** Carga las texturas del suelo y la alfombra. */
  async loadTextures(keys?: string[]): Promise<void> {
    const wanted = keys ?? this.textureSets().map(set => `tex:${set}`);
    await Promise.allSettled(wanted.map(key => this.loadTextureOne(key)));
  }

  /** Reintenta lo que falló (o solo `id`: un modelo o una clave `decor:`/`tex:`). */
  async retryLoad(id?: string): Promise<void> {
    if (!this.isInitialized) return;
    const keys = id
      ? this.allKeys().filter(k => k === id)
      : this.allKeys().filter(k => !this.isLoaded(k));
    if (keys.length === 0) return;
    this.state.loadStatus.set('loading');
    this.clearLoadError();
    await this.load(keys);
  }

  /** Solo borra errores de carga: un `render-failed` o de WebGL sigue vigente. */
  private clearLoadError(): void {
    if (this.state.error()?.code === 'model-load-failed') {
      this.state.error.set(null);
    }
  }

  private async load(keys: string[]): Promise<void> {
    const generation = this.generation;
    keys.forEach(key => {
      this.failed.delete(key);
      if (!this.isLoaded(key)) this.modelProgress.set(key, 0);
    });
    this.publishProgress();

    const decor = keys.filter(k => k.startsWith('decor:'));
    const textures = keys.filter(k => k.startsWith('tex:'));
    const models = keys.filter(k => !k.includes(':'));
    await Promise.allSettled([
      ...models.map(key => this.loadOne(key as ModelId)),
      this.loadDecor(decor),
      this.loadTextures(textures),
    ]);
    if (generation !== this.generation) return;

    this.publishProgress();
    if (this.failed.size > 0) {
      const names = [...this.failed.keys()].map(key => this.label(key));
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

  /** Ejecuta `task` una sola vez por clave (llamadas concurrentes comparten la promesa). */
  private once(
    key: string,
    task: (generation: number) => Promise<void>
  ): Promise<void> {
    const running = this.pending.get(key);
    if (running) return running;
    const generation = this.generation;
    const promise = task(generation)
      .catch(error => {
        console.error(`Error loading ${key}:`, error);
        if (generation === this.generation) this.failed.set(key, error);
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  private setProgress(key: string, generation: number, fraction: number): void {
    if (generation !== this.generation) return;
    this.modelProgress.set(key, Math.min(fraction, 0.99));
    this.publishProgress();
  }

  /** Carga un modelo interactivo una sola vez. */
  private loadOne(id: ModelId): Promise<void> {
    if (this.models.has(id)) return Promise.resolve();
    const config: ModelConfiguration = MODEL_CONFIGURATIONS[id];
    return this.once(id, async generation => {
      const object = await this.modelLoaderService.loadModel(
        config,
        (loaded, total) =>
          this.setProgress(id, generation, total > 0 ? loaded / total : 0)
      );
      if (generation !== this.generation) {
        disposeObject3D(object);
        return;
      }
      this.scene.add(object);
      this.models.set(id, { object, info: config.metadata });
      this.objectIds.set(object, id);
      this.objectInteractionService.addObject(object, config.metadata);
      this.modelProgress.set(id, 1);
    });
  }

  /** Decoración: va al grupo `decor`, sin registrarse en la interacción y sin raycast. */
  private loadDecorOne(key: string): Promise<void> {
    const id = key.slice(6) as DecorId;
    if (this.decorLoaded.has(id)) return Promise.resolve();
    const config = DECOR_CONFIGURATIONS[id];
    return this.once(key, async generation => {
      const object = await this.modelLoaderService.loadModel(
        config,
        (loaded, total) =>
          this.setProgress(key, generation, total > 0 ? loaded / total : 0)
      );
      if (generation !== this.generation) {
        disposeObject3D(object);
        return;
      }
      disableRaycast(object);
      this.decorGroup ??= this.createDecorGroup();
      this.decorGroup.add(object);
      this.decorLoaded.add(id);
      this.modelProgress.set(key, 1);
    });
  }

  private createDecorGroup(): Group {
    const group = new Group();
    group.name = 'decor';
    this.scene.add(group);
    return group;
  }

  private loadTextureOne(key: string): Promise<void> {
    const set = key.slice(4) as RoomTextureSet;
    if (this.texturesLoaded.has(set)) return Promise.resolve();
    return this.once(key, async generation => {
      await this.roomBuilderService.loadTextures(set, fraction =>
        this.setProgress(key, generation, fraction)
      );
      if (generation !== this.generation) return;
      this.texturesLoaded.add(set);
      this.modelProgress.set(key, 1);
    });
  }

  /** Progreso agregado 0-100 sin dividir entre totales desconocidos. */
  private publishProgress(): void {
    const keys = this.allKeys();
    const sum = keys.reduce(
      (acc, key) => acc + (this.modelProgress.get(key) ?? 0),
      0
    );
    const percent = Math.round((sum / keys.length) * 100);
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
    const obstacles = [
      ...[...this.models.values()]
        .filter(other => other !== entry)
        .map(other => other.object),
      // La decoración (jarrón, reloj) también puede tapar el encuadre.
      ...(this.decorGroup?.children ?? []),
    ];
    // Frente de la pieza (+Z local en el mundo): el encuadre no depende de
    // dónde estaba la cámara.
    entry.object.updateWorldMatrix(true, false);
    const front = new Vector3(0, 0, 1).transformDirection(
      entry.object.matrixWorld
    );
    void this.cameraService.focusOn(entry.object, obstacles, front);
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
    // Solo depuración: en prod (`ngDevMode` falso) el cuerpo se elimina.
    const info =
      typeof ngDevMode !== 'undefined' && ngDevMode
        ? this.renderer?.info
        : undefined;
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
