import {
  Injectable,
  InjectionToken,
  Injector,
  NgZone,
  inject,
} from '@angular/core';
import {
  ACESFilmicToneMapping,
  Box3,
  Frustum,
  BoxGeometry,
  Group,
  Matrix4,
  Material,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Decor3Config } from '../config/decor.config';
import {
  DECOR_CONFIGURATIONS,
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import { LocaleService } from '../i18n/locale.service';
import {
  ModelConfiguration,
  ObjectInfo,
  ScreenPoint,
  SelectedInfo,
} from '../interfaces/scene.interface';
import type { SelectableId as SelectableIdOf } from '../interfaces/scene.interface';
import {
  ActionId,
  ActionPieceId,
  PIECE_IDS,
  SURFACE_IDS,
  SurfaceId,
} from '../pieces/piece-ids';
import type { ActionResult } from '../pieces/piece-actions.runtime';
import { CameraService } from './camera.service';
import type { DecorBuild, DecorBuilderService } from './decor-builder.service';
import {
  ModelLoaderService,
  disableRaycast,
  disposeObject3D,
  freezeMatrices,
} from './model-loader.service';
import {
  ObjectInteractionService,
  PointerLike,
} from './object-interaction.service';
import { RoomBuilderService, RoomTextureSet } from './room-builder.service';
import type * as ScenePieces from './scene-pieces';
import { ViewerStateService } from './viewer-state.service';

/** Global de Angular: el build de producción lo fija a false y elimina el bloque. */
declare const ngDevMode: boolean | undefined;

export type ModelId = keyof typeof MODEL_CONFIGURATIONS;
type DecorId = keyof typeof DECOR_CONFIGURATIONS;

/** Claves de carga de la decoración 3 (`art:*` láminas, `fabric:*` lino). */
const isDecor3Key = (key: string): boolean =>
  key.startsWith('art:') || key.startsWith('fabric:');

/** Claves de carga de la decoración 3; coinciden con `DECOR3_LOAD_KEYS` (lo prueba el spec) y evitan importar su config en el bundle inicial. */
export const DECOR3_KEYS: readonly string[] = [
  'art:spiraea',
  'art:felce',
  'art:osmunda',
  'art:pteris',
  'fabric:linen',
  'fabric:linen-nor',
];

/** Claves de carga de las piezas (láminas E–H, glTF y construcción). */
export const PIECES_KEYS: readonly string[] = [
  'plate:e',
  'plate:f',
  'plate:g',
  'plate:h',
  'pieces:models',
  'pieces:build',
];
const isPiecesKey = (key: string): boolean =>
  key.startsWith('plate:') || key.startsWith('pieces:');

/**
 * Render bajo demanda (R8-I1): solo se dibuja con cámara en movimiento,
 * tween, contorno, animación del runtime o cambios. Si diera problemas, poner
 * `false`: se dibuja cada frame como antes.
 */
export const RENDER_ON_DEMAND = true;

const SURFACE_SET: ReadonlySet<string> = new Set(SURFACE_IDS);

/** R8-M4: con el tone mapping neutro el terracota del sofá sale naranja; se acerca al tono de la ronda 2. */
export const SOFA_SATURATION = 0.72;
export const SOFA_LIGHTNESS = 0.9;

/** Baja saturación y luminosidad del color de los materiales del sofá (solo del sofá). */
export function tameSofaColor(object: Object3D): void {
  const seen = new Set<Material>();
  const hsl = { h: 0, s: 0, l: 0 };
  object.traverse(child => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      const color = (material as MeshStandardMaterial).color;
      if (!color || seen.has(material)) continue;
      seen.add(material);
      color.getHSL(hsl);
      color.setHSL(hsl.h, hsl.s * SOFA_SATURATION, hsl.l * SOFA_LIGHTNESS);
    }
  });
}

/** Acción principal de una pieza con acciones (la que dispara el clic). */
const PRIMARY_ACTION: Readonly<Record<ActionPieceId, ActionId>> = {
  tv: 'power',
  monitor: 'power',
  deskLamp: 'power',
  readingLamp: 'power',
  floorLamp: 'power',
  turntable: 'spin',
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
  /** Decoración 3 (láminas, apliques, ventana, textiles): chunk perezoso. */
  private decor3: DecorBuild | null = null;
  private readonly decor3Loaded = new Set<string>();
  /** Progreso 0-1 por clave: `<modelo>`, `decor:<id>` o `tex:<set>`. */
  private readonly modelProgress = new Map<string, number>();
  private readonly failed = new Map<string, unknown>();
  private readonly pending = new Map<string, Promise<void>>();

  /** Texturas de las láminas A–D (del builder de decoración 3). */
  private artTextures = new Map<string, Texture>();
  private readonly decorObjects = new Map<DecorId, Object3D>();
  private plateTextures: Partial<Record<ScenePieces.PlateKey, Texture>> = {};
  private readonly piecesLoaded = new Set<string>();
  private pieceModels: Record<string, Object3D> = {};
  private pieceSpecs: ScenePieces.PieceModelSpec[] = [];
  private piecesBuild: ScenePieces.PiecesBuild | null = null;
  private plateFrames: { group: Group; dispose: () => void } | null = null;
  private runtime: ScenePieces.PieceActionsRuntime | null = null;
  private pieceConfigs: typeof ScenePieces.PIECES | null = null;

  // Render bajo demanda.
  private needsRender = true;
  private readonly lastCameraPosition = new Vector3(Infinity, 0, 0);
  private readonly lastCameraQuaternion = new Quaternion();
  private lastPieceState: unknown = null;

  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly rendererFactory = inject(RENDERER_FACTORY);
  private readonly cameraService = inject(CameraService);
  private readonly modelLoaderService = inject(ModelLoaderService);
  private readonly objectInteractionService = inject(ObjectInteractionService);
  private readonly roomBuilderService = inject(RoomBuilderService);
  private readonly state = inject(ViewerStateService);
  private readonly locale = inject(LocaleService);

  // Referencias estables para poder quitar los listeners en dispose().
  private readonly onWindowResize = () => this.handleResize();
  private readonly onVisibilityChange = () => {
    if (document.hidden) {
      this.stopLoop();
    } else {
      this.requestRender();
      this.startLoop();
    }
  };
  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.stopLoop();
    this.state.sceneReady.set(false);
    this.state.error.set({
      code: 'webgl-context-lost',
    });
  };
  private readonly onContextRestored = () => {
    if (this.state.error()?.code === 'webgl-context-lost') {
      this.state.error.set(null);
    }
    this.state.sceneReady.set(this.state.loadStatus() !== 'loading');
    this.requestRender(true);
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
      });
      return;
    }

    // Sombras estáticas (R8-I1): se recalculan solo con `needsUpdate`.
    this.renderer.shadowMap.autoUpdate = false;
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
    // Paredes y techo: seleccionables desde el primer frame.
    const surfaces = this.roomBuilderService.surfaces(this.scene);
    for (const id of SURFACE_IDS) {
      const object = surfaces[id];
      if (object) interaction.registerSurface(object, id);
    }
    // La sala es estática: matrices congeladas (las luces siguen igual).
    freezeMatrices(
      this.scene,
      object => !(object as Mesh).isMesh && !(object as Group).isGroup
    );
    interaction.onHoverChange = hover => {
      const id = hover
        ? (this.objectIds.get(hover.object) ??
          (hover.info.kind === 'surface' ? null : hover.info.id))
        : null;
      if (this.state.hovered() !== id) this.state.hovered.set(id);
      this.syncSilhouettes();
      this.requestRender();
    };

    this.applySize();
    this.addListeners(canvas);
    this.isInitialized = true;
    this.requestRender(true);
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

    // El builder es dueño de sus texturas: se liberan aquí, una sola vez, y
    // antes de recorrer la escena (el grupo queda vacío).
    this.disposePieces();
    this.decor3?.group.removeFromParent();
    this.decor3?.dispose();
    this.decor3 = null;
    this.decor3Loaded.clear();
    this.artTextures = new Map();
    this.decorObjects.clear();
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
      // R9-M2: `update` apaga `animating` en el último paso; ese paso también se dibuja.
      const wasAnimating = this.runtime?.animating === true;
      if (wasAnimating) this.runtime?.update(delta / 1000);
      if (this.shouldRender(wasAnimating)) {
        this.renderer?.render(this.scene, this.cameraService.getCamera());
        this.needsRender = false;
      }
      this.frameFailures = 0;
    } catch (error) {
      this.onFrameError(error);
    }
  };

  private readonly viewFrustum = new Frustum();
  private readonly viewMatrix = new Matrix4();

  /** ¿Entra la pantalla de la TV en el frustum de la cámara? (sin ella, sí: no se pausa). */
  private isTvInView(screen: Object3D | undefined): boolean {
    if (!screen) return true;
    const camera = this.cameraService.getCamera();
    camera.updateMatrixWorld();
    this.viewMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.viewFrustum.setFromProjectionMatrix(this.viewMatrix);
    return this.viewFrustum.intersectsBox(new Box3().setFromObject(screen));
  }

  /** Pide un frame (y, con `shadows`, recalcular las sombras estáticas). */
  private requestRender(shadows = false): void {
    this.needsRender = true;
    if (shadows && this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  /** ¿Hay algo que dibujar? En reposo no se renderiza (R8-I1). */
  private shouldRender(wasAnimating = false): boolean {
    if (!RENDER_ON_DEMAND) return true;
    const camera = this.cameraService.getCamera();
    const moved =
      !camera.position.equals(this.lastCameraPosition) ||
      !camera.quaternion.equals(this.lastCameraQuaternion);
    if (moved) {
      this.lastCameraPosition.copy(camera.position);
      this.lastCameraQuaternion.copy(camera.quaternion);
    }
    const pieceState = this.state.pieceState();
    const stateChanged = pieceState !== this.lastPieceState;
    this.lastPieceState = pieceState;
    return (
      this.needsRender ||
      moved ||
      stateChanged ||
      this.cameraService.isAnimating() ||
      wasAnimating ||
      this.runtime?.animating === true ||
      // El contorno de la selección pulsa (~12 s; luego queda fijo).
      this.objectInteractionService.isPulsing()
    );
  }

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
    this.requestRender();
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
    this.requestRender();
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
    return ['floor', 'rug'];
  }

  /** Todas las piezas que cuentan en la carga: modelos, decoración y texturas. */
  private allKeys(): string[] {
    return [
      ...this.modelIds(),
      ...this.decorIds().map(id => `decor:${id}`),
      ...this.textureSets().map(set => `tex:${set}`),
      ...DECOR3_KEYS,
      ...PIECES_KEYS,
    ];
  }

  private isLoaded(key: string): boolean {
    if (key.startsWith('decor:')) {
      return this.decorLoaded.has(key.slice(6) as DecorId);
    }
    if (key.startsWith('tex:')) {
      return this.texturesLoaded.has(key.slice(4) as RoomTextureSet);
    }
    if (isDecor3Key(key)) return this.decor3Loaded.has(key);
    if (isPiecesKey(key)) return this.piecesLoaded.has(key);
    return this.models.has(key as ModelId);
  }

  /** Id del activo que nombra el aviso (`params.names`): mueble o `AssetLabelId`. */
  private assetId(key: string): string {
    if (key.startsWith('decor:')) return key.slice(6);
    if (key.startsWith('tex:')) return key.slice(4);
    if (key.startsWith('art:')) return 'prints';
    if (key.startsWith('fabric:')) return 'fabric';
    return key;
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
    const code = this.state.error()?.code;
    if (code === 'model-load-failed' || code === 'pieces-load-failed') {
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
    const decor3 = keys.filter(isDecor3Key);
    const pieces = keys.filter(isPiecesKey);
    const models = keys.filter(k => !k.includes(':'));
    await Promise.allSettled([
      ...models.map(key => this.loadOne(key as ModelId)),
      this.loadDecor(decor),
      this.loadTextures(textures),
      this.loadDecor3(decor3),
      // Después de los anteriores: espera su decoración (jarrón, láminas, alfombra).
      pieces.length > 0 ? this.loadPieces() : Promise.resolve(),
    ]);
    if (generation !== this.generation) return;

    this.publishProgress();
    if (this.failed.size > 0) {
      const failedKeys = [...this.failed.keys()];
      const assets = failedKeys.filter(key => !isPiecesKey(key));
      this.state.loadStatus.set('error');
      this.state.error.set(
        assets.length > 0
          ? {
              code: 'model-load-failed',
              params: {
                names: [...new Set(assets.map(key => this.assetId(key)))],
              },
              retry: () => void this.retryLoad(),
            }
          : {
              code: 'pieces-load-failed',
              retry: () => void this.retryLoad(),
            }
      );
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
      if (id === 'sofa') tameSofaColor(object);
      this.scene.add(object);
      this.models.set(id, { object, info: config.metadata });
      this.objectIds.set(object, id);
      this.objectInteractionService.addObject(object, config.metadata);
      this.modelProgress.set(id, 1);
      this.requestRender(true);
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
      this.decorObjects.set(id, object);
      this.decorLoaded.add(id);
      this.modelProgress.set(key, 1);
      this.requestRender(true);
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
      this.requestRender();
    });
  }

  /** Chunk perezoso del builder; aparte para poder sustituirlo en los tests. */
  private async importDecorBuilder(): Promise<{
    DecorBuilderService: typeof DecorBuilderService;
    config: Decor3Config;
  }> {
    const [builder, { DECOR3 }] = await Promise.all([
      import('./decor-builder.service'),
      import('../config/decor.config'),
    ]);
    return { DecorBuilderService: builder.DecorBuilderService, config: DECOR3 };
  }

  /**
   * Decoración 3: importa el builder (chunk aparte), carga las texturas `art:*`
   * y `fabric:*` y construye el grupo `decor3`, sin raycast. Un fallo no
   * bloquea: la pieza queda en color plano y se avisa (la reintenta `retryLoad`).
   * Al reintentar se recarga todo el conjunto: el builder libera sus texturas.
   */
  async loadDecor3(keys?: string[]): Promise<void> {
    const wanted = keys?.length ? keys : [...DECOR3_KEYS];
    if (this.decor3 && wanted.every(key => this.decor3Loaded.has(key))) return;
    const all = [...DECOR3_KEYS];
    await this.once('decor3', async generation => {
      const loaded = new Map<string, Texture>();
      let owned = false;
      const fail = (reason: unknown, failedKeys: readonly string[]) => {
        console.error('Error loading decor3:', reason);
        if (generation === this.generation) {
          failedKeys.forEach(key => this.failed.set(key, reason));
        }
      };
      all.forEach(key => this.failed.delete(key));
      try {
        const { DecorBuilderService, config } = await this.importDecorBuilder();
        if (generation !== this.generation) return;

        const loader = new TextureLoader();
        const results = await Promise.allSettled(
          all.map(async key => {
            const texture = await loader.loadAsync(
              config.textures[key],
              event => {
                if (event.lengthComputable && event.total > 0) {
                  this.setProgress(key, generation, event.loaded / event.total);
                }
              }
            );
            loaded.set(key, texture);
          })
        );
        if (generation !== this.generation) {
          loaded.forEach(texture => texture.dispose());
          return;
        }
        results.forEach((result, i) => {
          if (result.status === 'rejected') fail(result.reason, [all[i]]);
        });

        const build = this.injector
          .get(DecorBuilderService)
          .build(config, Object.fromEntries(loaded));
        owned = true; // desde aquí las texturas son del builder
        disableRaycast(build.group);
        this.decor3?.group.removeFromParent();
        this.decor3?.dispose();
        this.scene.add(build.group);
        this.decor3 = build;
        this.syncSilhouettes();
        this.artTextures = new Map(
          [...loaded].filter(([key]) => key.startsWith('art:'))
        );
        this.requestRender(true);
        this.decor3Loaded.clear();
        loaded.forEach((_, key) => {
          this.decor3Loaded.add(key);
          this.modelProgress.set(key, 1);
        });
      } catch (error) {
        // Import rechazado o fallo al construir: la escena sigue sin decoración 3.
        if (!owned) loaded.forEach(texture => texture.dispose());
        fail(error, all);
      }
    });
  }

  /** Chunk perezoso de las piezas; aparte para poder sustituirlo en los tests. */
  private importPieces(): Promise<typeof ScenePieces> {
    return import('./scene-pieces');
  }

  /**
   * Piezas: importa el chunk (builders, runtime, audio), carga las láminas E–H
   * y los glTF nuevos, construye lo procedural, lo registra en la interacción y
   * engancha el runtime de acciones. Un fallo no tumba la escena: queda el
   * aviso con reintento (constitución V) y se usa lo que sí cargó.
   */
  async loadPieces(): Promise<void> {
    if (!this.isInitialized || PIECES_KEYS.every(k => this.piecesLoaded.has(k)))
      return;
    await this.once('pieces', async generation => {
      const fail = (key: string, reason: unknown) => {
        console.error(`Error loading ${key}:`, reason);
        if (generation === this.generation) this.failed.set(key, reason);
      };
      PIECES_KEYS.forEach(key => this.failed.delete(key));
      let mod: typeof ScenePieces;
      try {
        mod = await this.importPieces();
        await this.locale.enablePieces();
      } catch (error) {
        PIECES_KEYS.forEach(key => fail(key, error));
        return;
      }
      if (generation !== this.generation) return;
      this.pieceConfigs = mod.PIECES;

      // Láminas E–H (progreso por clave: nunca retrocede).
      const missingPlates = (
        Object.keys(mod.PLATE_TEXTURES) as ScenePieces.PlateKey[]
      ).filter(key => !this.plateTextures[key]);
      if (missingPlates.length > 0) {
        const plates = await mod.loadPlateTextures((key, fraction) =>
          this.setProgress(key, generation, fraction)
        );
        if (generation !== this.generation) {
          Object.values(plates.textures).forEach(t => t?.dispose());
          return;
        }
        Object.assign(this.plateTextures, plates.textures);
        for (const key of Object.keys(plates.textures)) {
          this.piecesLoaded.add(key);
          this.modelProgress.set(key, 1);
        }
        plates.failed.forEach((key, i) => fail(key, plates.reasons[i]));
      }

      // glTF nuevos (solo los que faltan al reintentar).
      const builder = this.injector.get(mod.PiecesBuilderService);
      this.pieceSpecs = mod.allModelSpecs();
      const todo = this.pieceSpecs.filter(spec => !this.pieceModels[spec.id]);
      if (todo.length > 0) {
        const result = await builder.loadModels(
          this.modelLoaderService,
          todo,
          (loaded, total) =>
            this.setProgress(
              'pieces:models',
              generation,
              total > 0 ? loaded / total : 0
            )
        );
        if (generation !== this.generation) {
          Object.values(result.models).forEach(disposeObject3D);
          return;
        }
        Object.assign(this.pieceModels, result.models);
        if (result.error) {
          fail('pieces:models', result.error);
        }
      }
      if (this.pieceSpecs.every(spec => this.pieceModels[spec.id])) {
        this.piecesLoaded.add('pieces:models');
        this.modelProgress.set('pieces:models', 1);
      }

      // Lo que la construcción necesita de la decoración y de la alfombra.
      await Promise.allSettled(
        ['decor3', 'decor:vase', 'decor:clock', 'tex:rug']
          .map(key => this.pending.get(key))
          .filter((p): p is Promise<void> => !!p)
      );
      if (generation !== this.generation) return;

      try {
        if (!this.piecesBuild) this.buildPieces(mod, builder);
        // Los glTF que llegan en un reintento se añaden a una escena ya montada.
        this.addPieceModels(mod);
        this.piecesLoaded.add('pieces:build');
        this.modelProgress.set('pieces:build', 1);
        this.requestRender(true);
      } catch (error) {
        fail('pieces:build', error);
      }
    });
  }

  private buildPieces(
    mod: typeof ScenePieces,
    builder: ScenePieces.PiecesBuilderService
  ): void {
    const textures: Record<string, Texture> =
      this.roomBuilderService.rugTextures();
    const mirrorArt = this.artTextures.get('art:osmunda');
    if (mirrorArt) textures['mirror:art'] = mirrorArt.clone();
    let build: ScenePieces.PiecesBuild;
    try {
      build = builder.build(mod.PIECES, textures, {
        ...(this.decorObjects.get('vase')
          ? { vase: this.decorObjects.get('vase') }
          : {}),
        ...(mod.asWebGLRenderer(this.renderer)
          ? { renderer: mod.asWebGLRenderer(this.renderer) }
          : {}),
      });
    } catch (error) {
      Object.values(textures).forEach(texture => texture.dispose());
      throw error;
    }
    const frames = mod.buildPlateFrames(this.plateTextures);
    const plates = mod.buildPlates(this.artTextures, this.plateTextures);
    const runtime = new mod.PieceActionsRuntime({
      state: this.state,
      messages: () => this.locale.pieceMessages(),
      plates,
      floorLight: mod.findFloorLight(this.scene),
      // El `AudioContext` se crea dentro del gesto (`start()`); el chunk ya está cargado.
      audio: new mod.TurntableAudio(),
      onWake: () => this.requestRender(),
      tvVisible: () => this.isTvInView(build.named('tv:screen')),
      // Sin `AudioContext` el botón vuelve a apagado: la ficha lo explica.
      onAudioError: () => this.state.audioError.set('audio-unavailable'),
    });
    runtime.attach(build.group);
    const animated = new Set<Object3D | undefined>([
      build.named('turntable:platter'),
      build.named('turntable:arm'),
    ]);
    freezeMatrices(build.group, object => animated.has(object));
    this.scene.add(build.group, frames.group);
    this.piecesBuild = build;
    this.plateFrames = frames;
    this.runtime = runtime;
    mod.registerProxyPieces(this.objectInteractionService, build, {
      clock: this.decorObjects.get('clock'),
      vase: this.decorObjects.get('vase'),
      floorLampShade: this.decor3?.group.getObjectByName('floorLamp:shade'),
    });
  }

  /** Añade a la escena los glTF cargados que aún no estén y los registra. */
  private addPieceModels(mod: typeof ScenePieces): void {
    const build = this.piecesBuild;
    if (!build) return;
    const added: Record<string, Object3D> = {};
    for (const spec of this.pieceSpecs) {
      const model = this.pieceModels[spec.id];
      if (!model || model.parent) continue;
      this.scene.add(model);
      added[spec.id] = model;
    }
    if (Object.keys(added).length > 0) {
      mod.registerModelPieces(
        this.objectInteractionService,
        added,
        this.pieceSpecs
      );
    }
  }

  private disposePieces(): void {
    this.runtime?.dispose();
    this.runtime = null;
    this.piecesBuild?.group.removeFromParent();
    this.piecesBuild?.dispose();
    this.piecesBuild = null;
    this.plateFrames?.group.removeFromParent();
    this.plateFrames?.dispose();
    this.plateFrames = null;
    Object.values(this.pieceModels).forEach(model => {
      model.removeFromParent();
      disposeObject3D(model);
    });
    this.pieceModels = {};
    this.pieceSpecs = [];
    Object.values(this.plateTextures).forEach(texture => texture?.dispose());
    this.plateTextures = {};
    this.piecesLoaded.clear();
    this.pieceConfigs = null;
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

  /** Los ids seleccionables ahora: muebles cargados y, con las piezas, el resto. */
  getObjectList(): { id: string }[] {
    const withPieces = this.piecesLoaded.has('pieces:build');
    return PIECE_IDS.filter(id =>
      id in MODEL_CONFIGURATIONS ? this.models.has(id as ModelId) : withPieces
    ).map(id => ({ id }));
  }

  /**
   * Selecciona por id (mueble, pieza o pared/techo): abre su ficha y encuadra.
   * `pointer`: el origen es un clic o toque sobre la pieza; solo entonces se
   * ejecuta su acción principal si está apagada (decisión 7). Desde la lista o
   * el teclado solo se selecciona.
   */
  selectObject(id: string, options: { pointer?: boolean } = {}): void {
    if (SURFACE_SET.has(id)) {
      this.viewSurface(id as SurfaceId);
      return;
    }
    const entry = this.models.get(id as ModelId);
    if (entry) {
      this.objectInteractionService.selectObject(entry.object);
      this.state.selected.set(entry.info);
      this.syncSilhouettes();
      this.state.selectedKind.set('furniture');
      this.state.surfaceTramo.set(null);
      this.requestRender();
      const obstacles = this.focusObstacles(entry.object);
      // Frente de la pieza (+Z local en el mundo): el encuadre no depende de
      // dónde estaba la cámara.
      entry.object.updateWorldMatrix(true, false);
      const front = new Vector3(0, 0, 1).transformDirection(
        entry.object.matrixWorld
      );
      void this.cameraService.focusOn(entry.object, obstacles, front);
      return;
    }
    this.selectPiece(id, options.pointer === true);
  }

  /** Pieza nueva o decorativa: caja unión de sus proxies y frente de la config. */
  private selectPiece(id: string, pointer: boolean): void {
    const config = this.pieceConfigs?.find(piece => piece.id === id);
    if (!config || !this.piecesLoaded.has('pieces:build')) return;
    const interaction = this.objectInteractionService;
    const group = interaction.groupOf(id as SelectableIdOf);
    if (group.length > 0) interaction.selectObject(group[0]);
    else interaction.clearSelection();
    this.state.selected.set({ id: config.id, kind: 'piece' } as SelectedInfo);
    this.syncSilhouettes();
    this.state.selectedKind.set('piece');
    this.state.surfaceTramo.set(null);

    const frame = this.frameProxy(config);
    const front = new Vector3(...config.facing);
    const own = new Set<Object3D>(group);
    void this.cameraService.focusOn(frame, this.focusObstacles(...own), front);

    // Acción principal: solo con puntero y la pieza apagada.
    const actionId = PRIMARY_ACTION[id as ActionPieceId];
    if (pointer && actionId && this.runtime) {
      const state = this.state.pieceState()[id as ActionPieceId];
      const off = actionId === 'spin' ? !state.spin : !state.power;
      if (off) this.runtime.run(id as ActionPieceId, actionId);
    }
    this.requestRender();
  }

  /** Caja (sin dibujar) con la unión de los proxies de la config, para el encuadre. */
  private frameProxy(config: {
    proxies: readonly {
      position: readonly [number, number, number];
      size: readonly [number, number, number];
      rotationY: number;
    }[];
  }): Object3D {
    const union = new Box3();
    for (const proxy of config.proxies) {
      const [w, h, d] = proxy.size;
      const cos = Math.abs(Math.cos(proxy.rotationY));
      const sin = Math.abs(Math.sin(proxy.rotationY));
      const half = new Vector3(
        (w * cos + d * sin) / 2,
        h / 2,
        (w * sin + d * cos) / 2
      );
      const center = new Vector3(...proxy.position);
      union.union(new Box3(center.clone().sub(half), center.clone().add(half)));
    }
    const size = union.getSize(new Vector3());
    const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z));
    union.getCenter(mesh.position);
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  /** Lo que puede tapar un encuadre: muebles, decoración y glTF nuevos (salvo `except`). */
  private focusObstacles(...except: Object3D[]): Object3D[] {
    return [
      ...[...this.models.values()]
        .map(other => other.object)
        .filter(object => !except.includes(object)),
      // La decoración (jarrón, reloj) también puede tapar el encuadre.
      ...(this.decorGroup?.children ?? []),
      ...Object.values(this.pieceModels).filter(
        object => !except.includes(object)
      ),
      // Lámpara de pie, cortinas y apliques (decoración 3), solo para la oclusión.
      ...this.decor3Obstacles(),
    ];
  }

  /**
   * Encuadra una pared (tramo `tramo`, por defecto el más cercano a `point`)
   * o el techo y abre su ficha. No cierra una ficha abierta: la sustituye.
   */
  viewSurface(id: SurfaceId, tramo?: number, point?: Vector3): void {
    if (!this.isInitialized) return;
    const aspect = this.containerAspect();
    const count = this.cameraService.surfaceTramos(aspect);
    const wanted =
      tramo ??
      (point ? this.cameraService.surfaceTramoAt(id, point, aspect) : 1);
    const clamped = Math.min(Math.max(1, wanted), id === 'ceiling' ? 1 : count);
    this.objectInteractionService.clearSelection();
    this.state.selected.set({ id, kind: 'surface' });
    this.syncSilhouettes();
    this.state.selectedKind.set('surface');
    this.state.surfaceTramo.set({
      tramo: clamped,
      count: id === 'ceiling' ? 1 : count,
    });
    void this.cameraService.focusSurface(id, clamped, aspect);
    this.requestRender();
  }

  /** Va al tramo `tramo` de la pared encuadrada (botones de la ficha). */
  focusSurfaceTramo(tramo: number): void {
    const id = this.state.selected();
    if (id?.kind === 'surface') this.viewSurface(id.id, tramo);
  }

  /** Av Pág / Re Pág: tramo siguiente o anterior (acotado) de la pared encuadrada. */
  stepSurfaceSection(delta: number): void {
    const current = this.state.surfaceTramo();
    if (current) this.focusSurfaceTramo(current.tramo + delta);
  }

  /** Obra que muestra la TV ahora (línea «En pantalla» de la ficha); `null` si no hay. */
  workOnScreen(): string | null {
    return this.runtime?.workOnScreen ?? null;
  }

  /** Alias de `runPieceAction` para la ficha. */
  runAction(id: ActionPieceId, action: ActionId): ActionResult {
    return this.runPieceAction(id, action);
  }

  /** Ejecuta una acción de la ficha (botón): TV, monitor, lámparas, tocadiscos. */
  runPieceAction(id: ActionPieceId, action: ActionId): ActionResult {
    const result = this.runtime?.run(id, action) ?? {
      changed: false,
      announcement: null,
    };
    if (result.changed) this.requestRender();
    return result;
  }

  /**
   * Obstáculos de la decoración 3 para el encuadre: una caja por pieza alta
   * (lámpara, cortinas, apliques). Las mallas fusionadas abarcan toda la sala,
   * así que no sirven; estas cajas no están en la escena (no hay raycast).
   */
  private decor3Obstacles(): Object3D[] {
    const proxies: Object3D[] = [];
    for (const { kind, box } of this.decor3?.pieces ?? []) {
      if (!['lamp', 'curtain', 'sconce'].includes(kind) || box.isEmpty()) {
        continue;
      }
      const size = box.getSize(new Vector3());
      const proxy = new Mesh(new BoxGeometry(size.x, size.y, size.z));
      box.getCenter(proxy.position);
      proxies.push(proxy);
    }
    return proxies;
  }

  /**
   * R8-M3: los textiles y los libros solo escriben stencil (cuentan como parte
   * de la silueta de su mueble) cuando ese mueble está seleccionado o con hover;
   * con otro objeto contorneado recortarían su anillo.
   */
  private syncSilhouettes(): void {
    const build = this.decor3;
    if (!build) return;
    const active = (host: 'sofa' | 'bookshelf') =>
      this.state.selected()?.id === host || this.state.hovered() === host;
    build.setSilhouette('sofa', active('sofa'));
    build.setSilhouette('bookshelf', active('bookshelf'));
  }

  clearSelection(): void {
    this.objectInteractionService.clearSelection();
    this.state.selected.set(null);
    this.syncSilhouettes();
    this.state.selectedKind.set(null);
    this.state.surfaceTramo.set(null);
    this.requestRender();
  }

  resetView(): void {
    void this.cameraService.reset();
    this.requestRender();
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

    this.requestRender();
    const info = result.objectInfo;
    if (result.floorPoint) {
      this.state.selected.set(null);
      this.syncSilhouettes();
      this.state.selectedKind.set(null);
      this.state.surfaceTramo.set(null);
      void this.cameraService.teleportTo(result.floorPoint);
    } else if (info?.kind === 'surface') {
      // Una pared con la ficha abierta encuadra y la ficha sigue abierta (decisión 5).
      this.viewSurface(info.id, undefined, result.surfacePoint);
    } else if (info) {
      this.selectObject(info.id, { pointer: true });
    } else {
      // Sin acierto (o fallo del raycast) no debe quedar una ficha abierta.
      this.clearSelection();
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
