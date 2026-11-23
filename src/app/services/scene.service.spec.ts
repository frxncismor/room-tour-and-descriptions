import { TestBed } from '@angular/core/testing';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import {
  DECOR_CONFIGURATIONS,
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import { FURNITURE_TEXT } from '../config/ui-text';
import {
  DecorConfiguration,
  ModelConfiguration,
  ObjectInfo,
} from '../interfaces/scene.interface';
import { ModelLoaderService } from './model-loader.service';
import { ObjectInteractionService } from './object-interaction.service';
import { RoomBuilderService } from './room-builder.service';
import {
  MAX_CONSECUTIVE_FRAME_FAILURES,
  RENDERER_FACTORY,
  SceneRenderer,
  SceneService,
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
    expect(renderer.render).toHaveBeenCalledTimes(2);
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
    ).toEqual(Object.keys(MODEL_CONFIGURATIONS).sort());
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
    expect(state.error()?.message).toContain(FURNITURE_TEXT.pokerTable.name);
    expect(service.getObjectList()).toHaveLength(MODEL_COUNT - 1);
    expect(state.sceneReady()).toBe(true);

    failing.clear();
    await service.retryLoad();
    expect(state.loadStatus()).toBe('ready');
    expect(state.error()).toBeNull();
    expect(service.getObjectList()).toHaveLength(MODEL_COUNT);
  });

  it('error.retry() reloads the failed model', async () => {
    failing.add('sofa');
    service.initialize(canvas);
    await service.loadAll();
    failing.clear();
    state.error()?.retry?.();
    await vi.waitFor(() => expect(state.loadStatus()).toBe('ready'));
    expect(service.getObjectList()).toHaveLength(MODEL_COUNT);
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
    expect(state.selected()?.name).toBe(service.getObjectList()[0].name);

    service.clearSelection();
    expect(state.selected()).toBeNull();
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
    const info = { name: 'x' } as ObjectInfo;
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
    expect(service.getObjectList()).toHaveLength(MODEL_COUNT - 1);
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
      state.error.set({ code, message: 'x' });
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
      expect(ids).not.toContain('clock');
      expect(ids).not.toContain('vase');
      expect(ids.sort()).toEqual(Object.keys(MODEL_CONFIGURATIONS).sort());
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
        MODEL_COUNT + Object.keys(DECOR_CONFIGURATIONS).length
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
      expect(state.error()?.message).toContain('Floor texture');
      expect(state.sceneReady()).toBe(true);
      expect(service.getObjectList()).toHaveLength(MODEL_COUNT);

      textureLoad.mockImplementation(async () => new Texture());
      await service.retryLoad();
      expect(state.loadStatus()).toBe('ready');
      expect(state.error()).toBeNull();
    });

    it('retryLoad reloads a failed decor piece only', async () => {
      failing.add('clock');
      service.initialize(canvas);
      await service.loadAll();
      expect(state.error()?.message).toContain(
        DECOR_CONFIGURATIONS.clock.label
      );
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
});
