import { TestBed } from '@angular/core/testing';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  Raycaster,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { DECOR3, DECOR3_LOAD_KEYS } from '../config/decor.config';
import {
  DECOR_CONFIGURATIONS,
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import {
  DecorConfiguration,
  ModelConfiguration,
  ObjectInfo,
} from '../interfaces/scene.interface';
import { PIECE_IDS } from '../pieces/piece-ids';
import { LocaleService } from '../i18n/locale.service';
import { CameraService } from './camera.service';
import { ModelLoaderService } from './model-loader.service';
import { ObjectInteractionService } from './object-interaction.service';
import { RoomBuilderService } from './room-builder.service';
import {
  DECOR3_KEYS,
  MAX_CONSECUTIVE_FRAME_FAILURES,
  RENDERER_FACTORY,
  SceneRenderer,
  SceneService,
  SOFA_LIGHTNESS,
  SOFA_SATURATION,
  tameSofaColor,
} from './scene.service';
import { ViewerStateService } from './viewer-state.service';

/** Renderer falso que cuenta geometrías vivas como `renderer.info.memory`. */
function createStubRenderer(): SceneRenderer & {
  render: ReturnType<typeof vi.fn>;
} {
  const memory = { geometries: 0, textures: 0 };
  const known = new WeakSet<BufferGeometry>();
  return {
    info: {
      memory,
      render: { calls: 0, triangles: 0 },
    } as SceneRenderer['info'],
    shadowMap: { enabled: true } as SceneRenderer['shadowMap'],
    toneMapping: NoToneMapping,
    toneMappingExposure: 1,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    render: vi.fn((scene: Scene) => {
      scene.traverse(child => {
        const mesh = child as Mesh;
        if (!mesh.isMesh || known.has(mesh.geometry)) return;
        known.add(mesh.geometry);
        memory.geometries++;
        mesh.geometry.addEventListener('dispose', () => memory.geometries--);
      });
    }),
  } as unknown as SceneRenderer & { render: ReturnType<typeof vi.fn> };
}

function fakeModel(): Object3D {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  return group;
}

describe('SceneService', () => {
  let service: SceneService;
  let state: ViewerStateService;
  let renderer: ReturnType<typeof createStubRenderer>;
  let canvas: HTMLCanvasElement;
  let failing: Set<string>;
  let loadModel: ReturnType<typeof vi.fn>;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRaf: number;
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  const pathToId = (path: string) =>
    Object.entries({ ...MODEL_CONFIGURATIONS, ...DECOR_CONFIGURATIONS }).find(
      ([, c]) => c.path === path
    )?.[0] ?? '';
  const MODEL_COUNT = Object.keys(MODEL_CONFIGURATIONS).length;
  const OBJECT_COUNT = PIECE_IDS.length;
  const PIECE_MODEL_COUNT = 10;
  let textureLoad: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    failing = new Set();
    rafCallbacks = new Map();
    nextRaf = 1;
    rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(cb => {
        const id = nextRaf++;
        rafCallbacks.set(id, cb);
        return id;
      });
    cancelSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(id => {
        rafCallbacks.delete(id);
      });

    renderer = createStubRenderer();
    textureLoad = vi
      .spyOn(TextureLoader.prototype, 'loadAsync')
      .mockImplementation(async () => new Texture());
    loadModel = vi.fn(
      async (
        config: ModelConfiguration | DecorConfiguration,
        onProgress?: (loaded: number, total: number) => void
      ) => {
        onProgress?.(50, 100);
        if (failing.has(pathToId(config.path))) {
          throw new Error('boom');
        }
        onProgress?.(100, 100);
        return fakeModel();
      }
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: RENDERER_FACTORY, useValue: () => renderer },
        {
          // El `effect` real de LocaleService pide un rAF: aquí se simula.
          provide: LocaleService,
          useValue: {
            enablePieces: async () => true,
            pieceMessages: () => null,
          },
        },
        {
          provide: ModelLoaderService,
          useValue: { loadModel },
        },
      ],
    });
    service = TestBed.inject(SceneService);
    state = TestBed.inject(ViewerStateService);

    const container = document.createElement('div');
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
    document.body.appendChild(container);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    service.dispose();
    canvas.parentElement?.remove();
    vi.restoreAllMocks();
  });

  const runFrame = (time = 16) => {
    const [id, cb] = [...rafCallbacks.entries()][0];
    rafCallbacks.delete(id);
    cb(time);
  };

  it('initialize applies the configured tone mapping and exposure', () => {
    service.initialize(canvas);
    expect(renderer.toneMapping).toBe(NeutralToneMapping);
    expect(renderer.toneMappingExposure).toBe(
      DEFAULT_SCENE_CONFIG.renderer.exposure
    );
  });

  it('initialize starts one rAF loop and is idempotent', () => {
    service.initialize(canvas);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.initialize(canvas);
    expect(rafCallbacks.size).toBe(1);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
  });

  it('the loop renders each frame and keeps exactly one pending rAF', () => {
    service.initialize(canvas);
    runFrame(16);
    runFrame(32);
    // Render bajo demanda: el primer frame dibuja, el segundo (en reposo) no.
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(1);
  });

  it('getRenderStats reads renderer.info after a frame (zeros before)', () => {
    service.initialize(canvas);
    expect(service.getRenderStats()).toEqual({
      calls: 0,
      triangles: 0,
      textures: 0,
      geometries: 0,
    });
    renderer.render.mockImplementationOnce(() => {
      renderer.info.render.calls = 7;
      renderer.info.render.triangles = 1200;
      renderer.info.memory.textures = 3;
      renderer.info.memory.geometries = 5;
    });
    runFrame(16);
    expect(service.getRenderStats()).toEqual({
      calls: 7,
      triangles: 1200,
      textures: 3,
      geometries: 5,
    });
  });

  it('exposes window.__rtad.stats in dev mode and removes it on dispose', () => {
    service.initialize(canvas);
    const rtad = (window as unknown as { __rtad?: { stats: () => unknown } })
      .__rtad;
    expect(rtad?.stats()).toEqual(service.getRenderStats());
    service.dispose();
    expect((window as unknown as { __rtad?: unknown }).__rtad).toBeUndefined();
  });

  it('dispose cancels the rAF, is idempotent and resets state', () => {
    service.initialize(canvas);
    runFrame();
    service.dispose();
    expect(rafCallbacks.size).toBe(0);
    expect(cancelSpy).toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(() => service.dispose()).not.toThrow();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(state.sceneReady()).toBe(false);
  });

  it('initialize → dispose → initialize works and leaves one loop', () => {
    service.initialize(canvas);
    service.dispose();
    renderer = createStubRenderer();
    service.initialize(canvas);
    expect(rafCallbacks.size).toBe(1);
    runFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('after dispose there are no geometries in memory and no live rAF', async () => {
    service.initialize(canvas);
    await service.loadAll();
    runFrame();
    expect(renderer.info.memory.geometries).toBeGreaterThan(0);

    service.dispose();

    expect(renderer.info.memory.geometries).toBe(0);
    expect(renderer.info.memory.textures).toBe(0);
    expect(rafCallbacks.size).toBe(0);
    expect(rafSpy).toHaveBeenCalled();
  });

  it('pauses the loop while the document is hidden and resumes after', () => {
    service.initialize(canvas);
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(0);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(1);
  });

  it('does not touch signals inside the frame', () => {
    service.initialize(canvas);
    const sets = vi.spyOn(state.hovered, 'set');
    runFrame();
    runFrame();
    expect(sets).not.toHaveBeenCalled();
  });

  it('loadAll loads every model, reaches 100% and marks the canvas ready', async () => {
    service.initialize(canvas);
    await service.loadAll();

    expect(state.loadStatus()).toBe('ready');
    expect(state.loadProgress()).toBe(100);
    expect(state.error()).toBeNull();
    expect(state.sceneReady()).toBe(true);
    expect(canvas.getAttribute('data-ready')).toBe('true');
    expect(
      service
        .getObjectList()
        .map(o => o.id)
        .sort()
    ).toEqual([...PIECE_IDS].sort());
  });

  it('progress is finite and never decreases', async () => {
    const seen: number[] = [];
    service.initialize(canvas);
    const set = state.loadProgress.set.bind(state.loadProgress);
    vi.spyOn(state.loadProgress, 'set').mockImplementation(v => {
      seen.push(v);
      set(v);
    });
    await service.loadAll();
    expect(seen.every(Number.isFinite)).toBe(true);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('a partial failure keeps the other models and offers retry', async () => {
    failing.add('pokerTable');
    service.initialize(canvas);
    await service.loadAll();

    expect(state.loadStatus()).toBe('error');
    expect(state.error()?.code).toBe('model-load-failed');
    expect(state.error()?.params?.names).toEqual(['pokerTable']);
    expect(service.getObjectList()).toHaveLength(OBJECT_COUNT - 1);
    expect(state.sceneReady()).toBe(true);

    failing.clear();
    await service.retryLoad();
    expect(state.loadStatus()).toBe('ready');
    expect(state.error()).toBeNull();
    expect(service.getObjectList()).toHaveLength(OBJECT_COUNT);
  });

  it('error.retry() reloads the failed model', async () => {
    failing.add('sofa');
    service.initialize(canvas);
    await service.loadAll();
    failing.clear();
    state.error()?.retry?.();
    await vi.waitFor(() => expect(state.loadStatus()).toBe('ready'));
    expect(service.getObjectList()).toHaveLength(OBJECT_COUNT);
  });

  it('reports WebGL unavailable instead of throwing', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RENDERER_FACTORY,
          useValue: () => {
            throw new Error('no webgl');
          },
        },
        {
          provide: LocaleService,
          useValue: { enablePieces: async () => true },
        },
      ],
    });
    const svc = TestBed.inject(SceneService);
    const st = TestBed.inject(ViewerStateService);
    expect(() => svc.initialize(canvas)).not.toThrow();
    expect(st.error()?.code).toBe('webgl-unavailable');
    expect(st.loadStatus()).toBe('error');
    expect(rafCallbacks.size).toBe(0);
  });

  it('webglcontextlost sets the error and stops the loop; restored recovers', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(state.error()?.code).toBe('webgl-context-lost');
    expect(rafCallbacks.size).toBe(0);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(state.error()).toBeNull();
    expect(rafCallbacks.size).toBe(1);
  });

  it('selectObject sets the selection and focuses the camera; clearSelection undoes it', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const id = service.getObjectList()[0].id;

    service.selectObject(id);
    expect(state.selected()?.id).toBe(id);

    service.clearSelection();
    expect(state.selected()).toBeNull();
  });

  it('selectObject frames each piece from its front, with decor as obstacle', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const camera = TestBed.inject(CameraService);
    const focus = vi.spyOn(camera, 'focusOn').mockResolvedValue(true);

    const entry = (
      service as unknown as { models: Map<string, { object: Object3D }> }
    ).models.get('sofa')!;
    entry.object.rotation.y = Math.PI / 4;
    service.selectObject('sofa');

    const [object, obstacles, front] = focus.mock.calls[0];
    expect(obstacles).toContain(
      service.getScene().getObjectByName('decor')!.children[0]
    );
    expect(obstacles).not.toContain(object);
    // El sofá gira π/4: su frente (+Z local) mira a +X/+Z, no a la cámara previa.
    expect(front!.x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(front!.z).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it('selectObject counts the floor lamp, curtains and sconces as occlusion obstacles', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const focus = vi
      .spyOn(TestBed.inject(CameraService), 'focusOn')
      .mockResolvedValue(true);
    const { pieces } = (
      service as unknown as {
        decor3: { pieces: { id: string; kind: string; box: Box3 }[] };
      }
    ).decor3;
    const same = (a: Box3, b: Box3) =>
      a.min.distanceTo(b.min) < 1e-4 && a.max.distanceTo(b.max) < 1e-4;
    const blockers = pieces.filter(p =>
      ['lamp', 'curtain', 'sconce'].includes(p.kind)
    );
    expect(blockers.map(p => p.kind)).toEqual(
      expect.arrayContaining(['lamp', 'curtain', 'sconce'])
    );

    for (const { id } of service.getObjectList()) {
      focus.mockClear();
      service.selectObject(id);
      const boxes = (focus.mock.calls[0][1] ?? []).map(o =>
        new Box3().setFromObject(o)
      );
      for (const piece of blockers) {
        expect(
          boxes.some(b => same(b, piece.box)),
          `${id}: ${piece.id}`
        ).toBe(true);
      }
      // Los marcos de pared y los halos no estorban: no son obstáculos.
      const halo = pieces.find(p => p.kind === 'halo')!;
      expect(boxes.some(b => same(b, halo.box))).toBe(false);
    }
  });

  it('selectObject still works while the decor has not loaded', async () => {
    service.initialize(canvas);
    await service.loadAll();
    (service as unknown as { decorGroup: Group | null }).decorGroup = null;
    (service as unknown as { decor3: unknown }).decor3 = null;
    const focus = vi
      .spyOn(TestBed.inject(CameraService), 'focusOn')
      .mockResolvedValue(true);

    service.selectObject('bookshelf');

    expect(focus.mock.calls[0][1]).toHaveLength(
      MODEL_COUNT - 1 + PIECE_MODEL_COUNT
    );
  });

  it('handlePointerSelect teleports on a floor point', async () => {
    service.initialize(canvas);
    const interaction = TestBed.inject(ObjectInteractionService);
    vi.spyOn(interaction, 'handleClick').mockResolvedValue({
      objectInfo: null,
      success: true,
      floorPoint: new Vector3(2, 0, 1),
    });
    await service.handlePointerSelect({ clientX: 10, clientY: 10 });
    // Los deltas se limitan a 100 ms por frame.
    for (let i = 0; i <= 15; i++) runFrame(i * 100);
    expect(service.getCamera().position.x).toBeCloseTo(2, 0);
  });

  it('handlePointerSelect forwards pointerType so touch gets tolerance', async () => {
    service.initialize(canvas);
    const interaction = TestBed.inject(ObjectInteractionService);
    const handleClick = vi.spyOn(interaction, 'handleClick');
    await service.handlePointerSelect({
      clientX: 10,
      clientY: 10,
      pointerType: 'touch',
    });
    expect(handleClick.mock.calls[0][0]).toMatchObject({
      clientX: 10,
      clientY: 10,
      pointerType: 'touch',
    });
    await service.handlePointerSelect({ clientX: 10, clientY: 10 });
    expect(handleClick.mock.calls[1][0].pointerType).toBeUndefined();
  });

  it('the loop calls update on the interaction service every frame', () => {
    service.initialize(canvas);
    const interaction = TestBed.inject(ObjectInteractionService);
    const update = vi.spyOn(interaction, 'update');
    runFrame(16);
    runFrame(32);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(32);
  });

  it('initialize wires canvas, context and room limits into the interaction service', () => {
    const interaction = TestBed.inject(ObjectInteractionService);
    const setCanvas = vi.spyOn(interaction, 'setCanvas');
    const setContext = vi.spyOn(interaction, 'setContext');
    const setRoomLimits = vi.spyOn(interaction, 'setRoomLimits');
    service.initialize(canvas);
    expect(setCanvas).toHaveBeenCalledWith(canvas);
    expect(setContext).toHaveBeenCalledWith(
      service.getCamera(),
      service.getScene()
    );
    expect(setRoomLimits).toHaveBeenCalledWith(
      DEFAULT_SCENE_CONFIG.room.limits
    );
  });

  it('selectObject creates the F4a outline and clearSelection removes it', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const interaction = TestBed.inject(ObjectInteractionService);
    const entry = service.getObjectList()[0];

    service.selectObject(entry.id);
    expect(interaction.getSelected()).not.toBeNull();

    service.clearSelection();
    expect(interaction.getSelected()).toBeNull();
  });

  it('handlePointerMove calls setHover with NDC and onHoverChange sets hovered once', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const interaction = TestBed.inject(ObjectInteractionService);
    const setHover = vi.spyOn(interaction, 'setHover');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    } as DOMRect);
    service.handlePointerMove({ clientX: 50, clientY: 0 });
    expect(setHover).toHaveBeenCalledWith({ x: 0, y: 1 });
    service.handlePointerMove(null);
    expect(setHover).toHaveBeenLastCalledWith(null);

    const object = service
      .getScene()
      .children.find(c => c.type === 'Group' && c.name === '');
    const info: ObjectInfo = { id: 'sofa' };
    const set = vi.spyOn(state.hovered, 'set');
    const notify = interaction.onHoverChange!;
    notify({ object: object as Object3D, info });
    notify({ object: object as Object3D, info });
    expect(state.hovered()).not.toBeNull();
    expect(set).toHaveBeenCalledTimes(1);
    notify(null);
    expect(state.hovered()).toBeNull();
  });

  // ── I4: robustez del frame ──────────────────────────────────────────

  it('a single frame failure is tolerated and logged once', () => {
    service.initialize(canvas);
    renderer.render.mockImplementationOnce(() => {
      throw new Error('gl');
    });
    runFrame(16);
    expect(state.error()).toBeNull();
    expect(rafCallbacks.size).toBe(1);
    runFrame(32);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('stops the loop after N consecutive failures, publishes render-failed and retry resumes', () => {
    service.initialize(canvas);
    renderer.render.mockImplementation(() => {
      throw new Error('gl');
    });
    for (let i = 0; i < MAX_CONSECUTIVE_FRAME_FAILURES; i++) runFrame(16 * i);

    expect(rafCallbacks.size).toBe(0);
    expect(state.error()?.code).toBe('render-failed');
    expect(state.sceneReady()).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);

    renderer.render.mockReset();
    state.error()?.retry?.();
    expect(state.error()).toBeNull();
    expect(rafCallbacks.size).toBe(1);
    runFrame(500);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('a successful frame resets the failure streak', () => {
    service.initialize(canvas);
    const fail = () =>
      renderer.render.mockImplementationOnce(() => {
        throw new Error('gl');
      });
    for (let i = 0; i < MAX_CONSECUTIVE_FRAME_FAILURES - 1; i++) {
      fail();
      runFrame(16 * i);
    }
    runFrame(100); // éxito
    for (let i = 0; i < MAX_CONSECUTIVE_FRAME_FAILURES - 1; i++) {
      fail();
      runFrame(200 + 16 * i);
    }
    expect(state.error()).toBeNull();
    expect(rafCallbacks.size).toBe(1);
  });

  // ── M5 / M6 ────────────────────────────────────────────────────────

  it('handlePointerSelect clears the selection when the click fails', async () => {
    service.initialize(canvas);
    await service.loadAll();
    service.selectObject(service.getObjectList()[0].id);
    expect(state.selected()).not.toBeNull();
    const interaction = TestBed.inject(ObjectInteractionService);
    vi.spyOn(interaction, 'handleClick').mockResolvedValue({
      objectInfo: null,
      success: false,
      error: 'boom',
    });
    await service.handlePointerSelect({ clientX: 1, clientY: 1 });
    expect(state.selected()).toBeNull();
  });

  it('dispose releases the room built by RoomBuilderService', () => {
    const room = TestBed.inject(RoomBuilderService);
    const dispose = vi.spyOn(room, 'dispose');
    service.initialize(canvas);
    const scene = service.getScene();
    service.dispose();
    expect(dispose).toHaveBeenCalledWith(scene);
  });

  // ── M10: retryLoad, resize y listeners ──────────────────────────────

  it('retryLoad(id) reloads only that model', async () => {
    failing.add('sofa');
    failing.add('pokerTable');
    service.initialize(canvas);
    await service.loadAll();
    failing.clear();
    loadModel.mockClear();

    await service.retryLoad('sofa');
    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(loadModel.mock.calls[0][0].path).toBe(
      MODEL_CONFIGURATIONS.sofa.path
    );
    expect(service.getObjectList().map(o => o.id)).toContain('sofa');
    expect(service.getObjectList()).toHaveLength(OBJECT_COUNT - 1);
  });

  it('retryLoad does nothing before initialize or when everything is loaded', async () => {
    await service.retryLoad('sofa');
    expect(loadModel).not.toHaveBeenCalled();
    service.initialize(canvas);
    await service.loadAll();
    loadModel.mockClear();
    await service.retryLoad();
    expect(loadModel).not.toHaveBeenCalled();
  });

  it('loadAll and retryLoad only clear load errors, never render-failed or WebGL ones', async () => {
    service.initialize(canvas);
    failing.add('sofa');
    await service.loadAll();
    expect(state.error()?.code).toBe('model-load-failed');
    failing.clear();
    await service.retryLoad('sofa');
    expect(state.error()).toBeNull(); // un error de carga sí se limpia

    for (const code of ['render-failed', 'webgl-context-lost']) {
      state.error.set({ code });
      await service.loadAll();
      expect(state.error()?.code).toBe(code);
    }
  });

  describe('resize and pixel ratio', () => {
    const setDpr = (value: number) =>
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value,
      });

    afterEach(() => {
      setDpr(1);
      vi.unstubAllGlobals();
    });

    it('caps the pixel ratio at 2 and passes smaller ratios through', () => {
      setDpr(3);
      service.initialize(canvas);
      expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(2);
      service.dispose();
      renderer = createStubRenderer();
      setDpr(1.5);
      service.initialize(canvas);
      expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    });

    it('re-applies size and aspect when the container resizes, and disconnects on dispose', () => {
      let notify: () => void = () => undefined;
      const disconnect = vi.fn();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: () => void) {
            notify = cb;
          }
          observe = vi.fn();
          disconnect = disconnect;
        }
      );
      service.initialize(canvas);
      expect(renderer.setSize).toHaveBeenCalledTimes(1);
      notify();
      expect(renderer.setSize).toHaveBeenCalledTimes(2);

      service.dispose();
      expect(disconnect).toHaveBeenCalled();
    });

    it('removes the window resize listener on dispose (no ResizeObserver)', () => {
      vi.stubGlobal('ResizeObserver', undefined);
      service.initialize(canvas);
      expect(renderer.setSize).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('resize'));
      expect(renderer.setSize).toHaveBeenCalledTimes(2);

      const remove = vi.spyOn(window, 'removeEventListener');
      service.dispose();
      expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
      window.dispatchEvent(new Event('resize'));
      expect(renderer.setSize).toHaveBeenCalledTimes(2);
    });
  });

  // ── T-232 / T-234: decoración y texturas ────────────────────────────

  describe('decor and textures', () => {
    it('loadAll puts decor in a non-inspectable group', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const decor = service.getScene().getObjectByName('decor')!;
      expect(decor.children).toHaveLength(
        Object.keys(DECOR_CONFIGURATIONS).length
      );
      const ids = service.getObjectList().map(o => o.id);
      // El reloj y el jarrón son seleccionables por su caja proxy (ronda 4).
      expect(ids).toContain('clock');
      expect(ids).toContain('vase');
      expect(ids).toHaveLength(OBJECT_COUNT);
    });

    it('decor never receives raycast hits', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const decor = service.getScene().getObjectByName('decor')!;
      const ray = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
      expect(ray.intersectObject(decor, true)).toEqual([]);
      const interaction = TestBed.inject(ObjectInteractionService);
      for (const child of decor.children) {
        expect(interaction.getObjectInfo(child)).toBeUndefined();
      }
    });

    it('decor progress keys count and progress is monotone up to 100', async () => {
      const seen: number[] = [];
      service.initialize(canvas);
      const set = state.loadProgress.set.bind(state.loadProgress);
      vi.spyOn(state.loadProgress, 'set').mockImplementation(v => {
        seen.push(v);
        set(v);
      });
      await service.loadAll();
      expect(seen).toEqual([...seen].sort((a, b) => a - b));
      expect(seen.at(-1)).toBe(100);
      expect(loadModel).toHaveBeenCalledTimes(
        MODEL_COUNT +
          Object.keys(DECOR_CONFIGURATIONS).length +
          PIECE_MODEL_COUNT
      );
    });

    it('stays loading while a texture is slow', async () => {
      const releases: ((t: Texture) => void)[] = [];
      textureLoad.mockImplementation(
        () => new Promise<Texture>(resolve => releases.push(resolve))
      );
      service.initialize(canvas);
      const done = service.loadAll();
      await vi.waitFor(() => expect(loadModel).toHaveBeenCalled());
      await new Promise(r => setTimeout(r, 20));
      expect(state.loadStatus()).toBe('loading');
      expect(state.sceneReady()).toBe(false);
      expect(state.loadProgress()).toBeLessThan(100);
      textureLoad.mockImplementation(async () => new Texture());
      releases.forEach(release => release(new Texture()));
      await done;
      expect(state.loadStatus()).toBe('ready');
    });

    it('a failed texture keeps the scene usable, reports it and can retry', async () => {
      textureLoad.mockRejectedValue(new Error('404'));
      service.initialize(canvas);
      await service.loadAll();
      expect(state.loadStatus()).toBe('error');
      expect(state.error()?.code).toBe('model-load-failed');
      expect(state.error()?.params?.names).toContain('floor');
      expect(state.sceneReady()).toBe(true);
      expect(service.getObjectList()).toHaveLength(OBJECT_COUNT);

      textureLoad.mockImplementation(async () => new Texture());
      await service.retryLoad();
      expect(state.loadStatus()).toBe('ready');
      expect(state.error()).toBeNull();
    });

    it('retryLoad reloads a failed decor piece only', async () => {
      failing.add('clock');
      service.initialize(canvas);
      await service.loadAll();
      expect(state.error()?.params?.names).toEqual(['clock']);
      expect(
        service.getScene().getObjectByName('decor')!.children
      ).toHaveLength(Object.keys(DECOR_CONFIGURATIONS).length - 1);

      failing.clear();
      loadModel.mockClear();
      await service.retryLoad();
      expect(loadModel).toHaveBeenCalledTimes(1);
      expect(loadModel.mock.calls[0][0].path).toBe(
        DECOR_CONFIGURATIONS.clock.path
      );
      expect(state.loadStatus()).toBe('ready');
    });

    it('dispose releases decor geometries', async () => {
      service.initialize(canvas);
      await service.loadAll();
      runFrame();
      service.dispose();
      expect(renderer.info.memory.geometries).toBe(0);
      expect(service.getObjectList()).toEqual([]);
    });
  });

  // ── T-360…T-362: decoración 3 perezosa, errores por código, ids ─────

  describe('decor3 (lazy), error codes and ids', () => {
    const decor3Paths = Object.values(DECOR3.textures);

    it('keeps its static load keys in sync with DECOR3', () => {
      expect([...DECOR3_KEYS]).toEqual([...DECOR3_LOAD_KEYS]);
    });

    it('loadAll builds the decor3 group, counts art/fabric keys and reaches 100', async () => {
      const seen: number[] = [];
      service.initialize(canvas);
      const set = state.loadProgress.set.bind(state.loadProgress);
      vi.spyOn(state.loadProgress, 'set').mockImplementation(v => {
        seen.push(v);
        set(v);
      });
      await service.loadAll();

      expect(service.getScene().getObjectByName('decor3')).toBeDefined();
      for (const path of decor3Paths) {
        expect(
          (textureLoad.mock.calls as unknown[][]).map(c => c[0])
        ).toContain(path);
      }
      expect(seen).toEqual([...seen].sort((a, b) => a - b));
      expect(seen.at(-1)).toBe(100);
      expect(state.loadStatus()).toBe('ready');
      expect(service.getObjectList()).toHaveLength(OBJECT_COUNT);
    });

    it('stays loading until decor3 has finished', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const original = service['importDecorBuilder'].bind(service);
      vi.spyOn(
        service as unknown as { importDecorBuilder: () => unknown },
        'importDecorBuilder'
      ).mockImplementation(async () => {
        await gate;
        return original();
      });
      service.initialize(canvas);
      const done = service.loadAll();
      await new Promise(r => setTimeout(r, 20));
      expect(state.loadStatus()).toBe('loading');
      expect(state.sceneReady()).toBe(false);
      expect(state.loadProgress()).toBeLessThan(100);
      release();
      await done;
      expect(state.loadStatus()).toBe('ready');
    });

    it('decor3 meshes never receive raycast hits nor become interactive', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const decor3 = service.getScene().getObjectByName('decor3')!;
      let meshes = 0;
      decor3.traverse(child => {
        if ((child as Mesh).isMesh) {
          meshes++;
          const hits: unknown[] = [];
          child.raycast(new Raycaster(), hits as never);
          expect(hits).toEqual([]);
        }
      });
      expect(meshes).toBeGreaterThan(0);
      const interaction = TestBed.inject(ObjectInteractionService);
      expect(interaction.getObjectInfo(decor3)).toBeUndefined();
    });

    it('dispose frees each decor3 texture exactly once', async () => {
      const textures: Texture[] = [];
      textureLoad.mockImplementation(async () => {
        const texture = new Texture();
        textures.push(texture);
        return texture;
      });
      service.initialize(canvas);
      await service.loadAll();
      const decorTextures = textures.slice(-decor3Paths.length);
      const spies = decorTextures.map(t => vi.spyOn(t, 'dispose'));
      service.dispose();
      spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
      expect(service.getScene().getObjectByName('decor3')).toBeUndefined();
    });

    it('a rejected import warns by code, keeps the scene and retries', async () => {
      const spy = vi
        .spyOn(
          service as unknown as { importDecorBuilder: () => unknown },
          'importDecorBuilder'
        )
        .mockRejectedValue(new Error('chunk'));
      service.initialize(canvas);
      await service.loadAll();

      expect(state.loadStatus()).toBe('error');
      expect(state.error()?.code).toBe('model-load-failed');
      expect(state.error()?.params?.names?.sort()).toEqual([
        'fabric',
        'prints',
      ]);
      expect(state.sceneReady()).toBe(true);
      expect(service.getObjectList()).toHaveLength(OBJECT_COUNT);
      expect(service.getScene().getObjectByName('decor3')).toBeUndefined();

      spy.mockRestore();
      await service.retryLoad();
      expect(state.loadStatus()).toBe('ready');
      expect(state.error()).toBeNull();
      expect(service.getScene().getObjectByName('decor3')).toBeDefined();
    });

    it('a failed art texture builds with flat colour, names prints and retries', async () => {
      textureLoad.mockImplementation(async (path: string) => {
        if (path.includes('felce')) throw new Error('404');
        return new Texture();
      });
      service.initialize(canvas);
      await service.loadAll();
      expect(service.getScene().getObjectByName('decor3')).toBeDefined();
      expect(state.error()?.params?.names).toEqual(['prints']);

      textureLoad.mockImplementation(async () => new Texture());
      await service.retryLoad();
      expect(state.loadStatus()).toBe('ready');
      expect(state.error()).toBeNull();
      expect(
        service.getScene().getObjectsByProperty('name', 'decor3')
      ).toHaveLength(1);
    });

    it('model-load-failed carries ids in params.names, not labels', async () => {
      failing.add('pokerTable');
      failing.add('clock');
      textureLoad.mockImplementation(async (path: string) => {
        if (path.includes('/floor/')) throw new Error('404');
        return new Texture();
      });
      service.initialize(canvas);
      await service.loadAll();
      expect(state.error()?.params?.names?.sort()).toEqual([
        'clock',
        'floor',
        'pokerTable',
      ]);
    });

    it('selectObject publishes the ObjectInfo with its id', async () => {
      service.initialize(canvas);
      await service.loadAll();
      service.selectObject('sofa');
      expect(state.selected()?.id).toBe('sofa');
      expect(service.getObjectList()).toContainEqual({ id: 'sofa' });
    });
  });
  // ── Ronda 4: piezas, selección, sombras estáticas y render bajo demanda ──

  describe('pieces (spec 004)', () => {
    interface Internals {
      piecesBuild: {
        group: Group;
        named: (name: string) => Object3D | undefined;
      } | null;
      runtime: {
        missing: readonly string[];
        animating: boolean;
      } | null;
      pieceModels: Record<string, Object3D>;
      importPieces: () => Promise<unknown>;
    }
    const internals = () => service as unknown as Internals;
    const camera = () => TestBed.inject(CameraService);

    it('loads the 35 pieces, the E–H plates and their frames', async () => {
      service.initialize(canvas);
      await service.loadAll();
      expect(state.error()).toBeNull();
      expect(service.getObjectList()).toHaveLength(35);
      const paths = textureLoad.mock.calls.map(
        (c: unknown[]) => c[0] as string
      );
      for (const k of ['e', 'f', 'g', 'h']) {
        expect(paths).toContain(`assets/textures/art/${k}.webp`);
      }
      const frames = service.getScene().getObjectByName('plates-efgh')!;
      expect(frames.children).toHaveLength(4);
      expect(service.getScene().getObjectByName('pieces')).toBeDefined();
    });

    it('every animated part the runtime looks for exists in the builder output (PART)', async () => {
      service.initialize(canvas);
      await service.loadAll();
      // La pantalla de la lámpara de pie sigue en la decoración 003 (decor3): el runtime
      // no la encuentra y solo atenúa su halo, su charco y la luz.
      expect(internals().runtime?.missing).toEqual(['floorLamp:shade']);
      for (const name of [
        'tv:screen',
        'tv:halo',
        'monitor:screen',
        'turntable:platter',
        'turntable:arm',
        'deskLamp:shade',
        'readingLamp:shade',
        'floorLamp:halo',
      ]) {
        expect(internals().piecesBuild?.named(name), name).toBeDefined();
      }
    });

    it('no selectable piece ends up with a filled proxy hull (all 35)', async () => {
      service.initialize(canvas);
      await service.loadAll();
      vi.spyOn(camera(), 'focusOn').mockResolvedValue(true);
      const proxyGeometries = new Set<BufferGeometry>(
        (
          internals().piecesBuild?.group.getObjectByName('piece-proxies')
            ?.children ?? []
        ).map(p => (p as Mesh).geometry)
      );
      expect(proxyGeometries.size).toBeGreaterThan(0);
      const ids = service.getObjectList().map(o => o.id);
      expect(ids).toHaveLength(35);
      for (const id of ids) {
        service.selectObject(id);
        const outlines: Object3D[] = [];
        service.getScene().traverse(o => {
          if (o.name === '__selection-outline') outlines.push(o);
        });
        for (const outline of outlines) {
          for (const child of outline.children) {
            const mesh = child as Mesh;
            expect(
              mesh.isMesh && proxyGeometries.has(mesh.geometry),
              `${id}: hull over a proxy box`
            ).toBeFalsy();
          }
        }
      }
      service.clearSelection();
    });

    it('textile and book silhouettes write stencil only for their selected or hovered host (R8-M3)', async () => {
      service.initialize(canvas);
      await service.loadAll();
      vi.spyOn(camera(), 'focusOn').mockResolvedValue(true);
      const textile = () => {
        let stencil: boolean | undefined;
        service.getScene().traverse(o => {
          const m = o as Mesh;
          if (m.isMesh && m.name.startsWith('textile:')) {
            stencil = (m.material as { stencilWrite: boolean }).stencilWrite;
          }
        });
        return stencil;
      };
      // Sin selección ni hover: los textiles no recortan anillos ajenos.
      expect(textile()).toBe(false);
      service.selectObject('sofa');
      expect(textile()).toBe(true);
      service.selectObject('bookshelf');
      expect(textile()).toBe(false);
      service.clearSelection();
      expect(textile()).toBe(false);
    });

    it('a failing pieces chunk warns with retry and keeps the scene usable', async () => {
      const real = internals().importPieces.bind(service);
      internals().importPieces = () => Promise.reject(new Error('chunk'));
      service.initialize(canvas);
      await service.loadAll();
      expect(state.error()?.code).toBe('pieces-load-failed');
      expect(state.sceneReady()).toBe(true);
      expect(service.getObjectList()).toHaveLength(MODEL_COUNT);

      internals().importPieces = real;
      state.error()?.retry?.();
      await vi.waitFor(() => expect(state.loadStatus()).toBe('ready'));
      expect(state.error()).toBeNull();
      expect(service.getObjectList()).toHaveLength(35);
    });

    it('a failing piece model warns, keeps the rest and retries only that one', async () => {
      loadModel.mockImplementation(async (config: ModelConfiguration) => {
        if (config.path.includes('modern_arm_chair_01')) throw new Error('x');
        return fakeModel();
      });
      service.initialize(canvas);
      await service.loadAll();
      expect(state.error()?.code).toBe('pieces-load-failed');
      expect(Object.keys(internals().pieceModels)).not.toContain('armchair');
      expect(Object.keys(internals().pieceModels)).toContain('coffeeTable');
      // La pieza sigue en la lista y se puede encuadrar por su caja de la config.
      expect(service.getObjectList()).toHaveLength(35);

      loadModel.mockClear();
      loadModel.mockImplementation(async () => fakeModel());
      await service.retryLoad();
      expect(loadModel).toHaveBeenCalledTimes(1);
      expect(state.error()).toBeNull();
      expect(Object.keys(internals().pieceModels)).toContain('armchair');
    });

    it('selecting from the list only selects; a pointer click turns an off piece on', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const focus = vi.spyOn(camera(), 'focusOn').mockResolvedValue(true);

      service.selectObject('tv');
      expect(state.selected()).toEqual({ id: 'tv', kind: 'piece' });
      expect(state.selectedKind()).toBe('piece');
      // La TV arranca encendida (modo arte): elegir de la lista no la toca.
      expect(state.pieceState().tv.power).toBe(true);
      expect(focus).toHaveBeenCalled();

      // Con una pieza apagada, el clic la enciende y otro clic no la apaga.
      service.selectObject('readingLamp');
      expect(state.pieceState().readingLamp.power).toBe(false);
      service.selectObject('readingLamp', { pointer: true });
      expect(state.pieceState().readingLamp.power).toBe(true);
      service.selectObject('readingLamp', { pointer: true });
      expect(state.pieceState().readingLamp.power).toBe(true);
    });

    it('a click on a piece with actions goes through handlePointerSelect', async () => {
      service.initialize(canvas);
      await service.loadAll();
      vi.spyOn(camera(), 'focusOn').mockResolvedValue(true);
      vi.spyOn(
        TestBed.inject(ObjectInteractionService),
        'handleClick'
      ).mockResolvedValue({
        objectInfo: { id: 'readingLamp', kind: 'piece' },
        success: true,
      });
      await service.handlePointerSelect({ clientX: 1, clientY: 1 });
      expect(state.pieceState().readingLamp.power).toBe(true);
    });

    it('a wall click frames the wall by its nearest tramo and the sheet stays open', async () => {
      service.initialize(canvas);
      await service.loadAll();
      vi.spyOn(camera(), 'focusOn').mockResolvedValue(true);
      const focusSurface = vi
        .spyOn(camera(), 'focusSurface')
        .mockResolvedValue(true);
      vi.spyOn(camera(), 'surfaceTramos').mockReturnValue(3);
      vi.spyOn(camera(), 'surfaceTramoAt').mockReturnValue(2);
      service.selectObject('sofa');
      vi.spyOn(
        TestBed.inject(ObjectInteractionService),
        'handleClick'
      ).mockResolvedValue({
        objectInfo: { id: 'wallGreen', kind: 'surface' },
        success: true,
        surfacePoint: new Vector3(0, 2, -8),
      });
      await service.handlePointerSelect({ clientX: 1, clientY: 1 });
      expect(focusSurface).toHaveBeenCalledWith(
        'wallGreen',
        2,
        expect.any(Number)
      );
      expect(state.selected()).toEqual({ id: 'wallGreen', kind: 'surface' });
      expect(state.selectedKind()).toBe('surface');
      expect(state.surfaceTramo()).toEqual({ tramo: 2, count: 3 });
    });

    it('the list can view a wall or the ceiling (1 tramo)', () => {
      service.initialize(canvas);
      const focusSurface = vi
        .spyOn(camera(), 'focusSurface')
        .mockResolvedValue(true);
      service.selectObject('ceiling');
      expect(focusSurface).toHaveBeenCalledWith(
        'ceiling',
        1,
        expect.any(Number)
      );
      expect(state.surfaceTramo()?.count).toBe(1);
      service.clearSelection();
      expect(state.selected()).toBeNull();
      expect(state.surfaceTramo()).toBeNull();
    });

    it('registers the four walls and the ceiling as surfaces from the start', () => {
      service.initialize(canvas);
      const interaction = TestBed.inject(ObjectInteractionService);
      for (const id of [
        'wallGreen',
        'wallWindow',
        'wallTv',
        'wallDesk',
        'ceiling',
      ] as const) {
        expect(interaction.groupOf(id)).toHaveLength(1);
      }
    });

    it('proxies, glTF, the clock and the vase are registered', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const interaction = TestBed.inject(ObjectInteractionService);
      for (const id of PIECE_IDS) {
        expect(interaction.groupOf(id).length, id).toBeGreaterThan(0);
      }
      expect(interaction.groupOf('readingChair')).toHaveLength(2);
    });

    it('runPieceAction runs the action and reports the change', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const result = service.runPieceAction('monitor', 'power');
      expect(result.changed).toBe(true);
      expect(state.pieceState().monitor.power).toBe(true);
    });

    it('workOnScreen is null before the pieces load and names the plate with the TV on', async () => {
      expect(service.workOnScreen()).toBeNull();
      service.initialize(canvas);
      await service.loadAll();
      // Arranca encendida (modo arte): ya muestra una obra, también tras reiniciar.
      expect(state.pieceState().tv.power).toBe(true);
      expect(service.workOnScreen()).toEqual(expect.any(String));
      service.runPieceAction('tv', 'power');
      expect(service.workOnScreen()).toBeNull();
      service.runPieceAction('tv', 'power');
      expect(service.workOnScreen()).toEqual(expect.any(String));
    });
  });

  describe('static shadows and frozen matrices (R8-I1, T-490)', () => {
    it('turns the shadow map auto update off and asks for updates after each load', async () => {
      service.initialize(canvas);
      expect(renderer.shadowMap.autoUpdate).toBe(false);
      expect(renderer.shadowMap.needsUpdate).toBe(true);
      renderer.shadowMap.needsUpdate = false;
      await service.loadAll();
      expect(renderer.shadowMap.needsUpdate).toBe(true);
    });

    it('asks for a shadow update after loadPieces', async () => {
      service.initialize(canvas);
      await service.loadAll();
      renderer.shadowMap.needsUpdate = false;
      (
        service as unknown as { piecesLoaded: Set<string> }
      ).piecesLoaded.clear();
      await service.loadPieces();
      expect(renderer.shadowMap.needsUpdate).toBe(true);
    });

    it('keeps the new shadow casters within the budget (≤ 6)', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const pieces = service.getScene().getObjectByName('pieces')!;
      const frames = service.getScene().getObjectByName('plates-efgh')!;
      const { countCasters } = await import('./scene-pieces');
      expect(countCasters(pieces, frames)).toBeLessThanOrEqual(6);
      expect(countCasters(frames)).toBe(0);
    });

    it('freezes static matrices but not the turntable parts', async () => {
      service.initialize(canvas);
      await service.loadAll();
      const scene = service.getScene();
      expect(scene.getObjectByName('floor')!.matrixAutoUpdate).toBe(false);
      expect(scene.getObjectByName('pieces')!.matrixAutoUpdate).toBe(false);
      expect(scene.getObjectByName('plates-efgh')!.matrixAutoUpdate).toBe(
        false
      );
      expect(scene.getObjectByName('turntable:platter')!.matrixAutoUpdate).toBe(
        true
      );
      expect(scene.getObjectByName('turntable:arm')!.matrixAutoUpdate).toBe(
        true
      );
    });
  });

  describe('render on demand (R8-I1)', () => {
    const camera = () => TestBed.inject(CameraService);
    const idle = () => {
      // Deja pasar el primer render y el frame de la cámara (sin cambios).
      runFrame(16);
      runFrame(32);
      renderer.render.mockClear();
    };

    it('renders nothing while idle', () => {
      service.initialize(canvas);
      idle();
      for (let i = 0; i < 30; i++) runFrame(48 + i * 16);
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('resumes when the camera moves and stops again afterwards', () => {
      service.initialize(canvas);
      idle();
      service.getCamera().position.x += 0.5;
      runFrame(100);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      runFrame(116);
      expect(renderer.render).toHaveBeenCalledTimes(1);
    });

    it('renders every frame while a camera tween runs', () => {
      service.initialize(canvas);
      idle();
      vi.spyOn(camera(), 'isAnimating').mockReturnValue(true);
      runFrame(100);
      runFrame(116);
      expect(renderer.render).toHaveBeenCalledTimes(2);
    });

    it('draws the last step of a fade that ends in this frame (R9-M2)', () => {
      service.initialize(canvas);
      idle();
      const fake = {
        animating: true,
        dispose: () => undefined,
        update() {
          this.animating = false; // el último paso termina la animación
        },
      };
      (service as unknown as { runtime: unknown }).runtime = fake;
      runFrame(100);
      expect(fake.animating).toBe(false);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      runFrame(116);
      expect(renderer.render).toHaveBeenCalledTimes(1);
    });

    it('renders on hover changes, resize and piece state changes', async () => {
      service.initialize(canvas);
      await service.loadAll();
      idle();
      TestBed.inject(ObjectInteractionService).onHoverChange?.(null);
      runFrame(100);
      expect(renderer.render).toHaveBeenCalledTimes(1);

      (service as unknown as { handleResize: () => void }).handleResize();
      runFrame(116);
      expect(renderer.render).toHaveBeenCalledTimes(2);

      state.patchPiece('tv', { power: true });
      runFrame(132);
      expect(renderer.render).toHaveBeenCalledTimes(3);
    });

    describe('TV art-mode TICK', () => {
      beforeEach(() =>
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      );
      afterEach(() => vi.useRealTimers());

      it('does not render during two TICK cycles while the TV is out of frame', async () => {
        service.initialize(canvas);
        await service.loadAll();
        idle();
        expect(state.pieceState().tv.power).toBe(true);
        let frame = 100;
        for (let i = 0; i < 2 * 8; i++) {
          vi.advanceTimersByTime(1000);
          runFrame((frame += 1000));
        }
        expect(state.pieceState().tv.index).toBe(0);
        expect(renderer.render).not.toHaveBeenCalled();
      });

      it('renders the plate change when the TV is in frame', async () => {
        service.initialize(canvas);
        await service.loadAll();
        // De cara a la TV (pared +z), a 4 m.
        service.getCamera().position.set(0, 1.6, 3.5);
        camera().getTarget().set(0, 1.2, 8);
        idle();
        vi.advanceTimersByTime(8500);
        runFrame(9000);
        expect(state.pieceState().tv.index).toBe(1);
        expect(renderer.render).toHaveBeenCalled();
      });
    });

    it('keeps drawing while the outline pulses, then returns to 0 renders at idle after ~12 s (R9-M12)', async () => {
      service.initialize(canvas);
      await service.loadAll();
      vi.spyOn(camera(), 'focusOn').mockResolvedValue(true);
      service.selectObject('sofa');
      idle();
      runFrame(100);
      runFrame(116);
      expect(renderer.render).toHaveBeenCalledTimes(2);
      runFrame(5000);
      expect(renderer.render).toHaveBeenCalledTimes(3);
      runFrame(100 + 12000); // fija el contorno: último frame dibujado
      expect(renderer.render).toHaveBeenCalledTimes(4);
      for (let i = 1; i <= 30; i++) runFrame(100 + 12000 + i * 16);
      expect(renderer.render).toHaveBeenCalledTimes(4); // ya en reposo
      service.clearSelection();
      runFrame(13000);
      renderer.render.mockClear();
      runFrame(13016);
      expect(renderer.render).not.toHaveBeenCalled();
    });
  });

  describe('sofa colour (R8-M4)', () => {
    it('lowers saturation and lightness once per material and leaves others alone', () => {
      const shared = new MeshStandardMaterial({ color: 0xa65f3a });
      const sofa = new Group();
      sofa.add(
        new Mesh(new BoxGeometry(), shared),
        new Mesh(new BoxGeometry(), shared)
      );
      const other = new MeshStandardMaterial({ color: 0xa65f3a });
      const before = { h: 0, s: 0, l: 0 };
      shared.color.getHSL(before);
      tameSofaColor(sofa);
      const after = { h: 0, s: 0, l: 0 };
      shared.color.getHSL(after);
      expect(after.s).toBeCloseTo(before.s * SOFA_SATURATION, 2);
      expect(after.l).toBeCloseTo(before.l * SOFA_LIGHTNESS, 2);
      expect(after.h).toBeCloseTo(before.h, 2);
      expect(other.color.getHex()).toBe(0xa65f3a);
    });
  });
});
