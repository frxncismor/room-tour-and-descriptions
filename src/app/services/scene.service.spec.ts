import { TestBed } from '@angular/core/testing';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
  Vector3,
} from 'three';
import { MODEL_CONFIGURATIONS } from '../config/scene.config';
import { ModelConfiguration } from '../interfaces/scene.interface';
import { ModelLoaderService } from './model-loader.service';
import { ObjectInteractionService } from './object-interaction.service';
import { RENDERER_FACTORY, SceneRenderer, SceneService } from './scene.service';
import { ViewerStateService } from './viewer-state.service';

/** Renderer falso que cuenta geometrías vivas como `renderer.info.memory`. */
function createStubRenderer(): SceneRenderer & {
  render: ReturnType<typeof vi.fn>;
} {
  const memory = { geometries: 0, textures: 0 };
  const known = new WeakSet<BufferGeometry>();
  return {
    info: { memory } as SceneRenderer['info'],
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
    Object.entries(MODEL_CONFIGURATIONS).find(
      ([, c]) => c.path === path
    )?.[0] ?? '';

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
    loadModel = vi.fn(
      async (
        config: ModelConfiguration,
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
          useValue: { loadModel, dispose: vi.fn() },
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
    expect(state.error()?.message).toContain('Poker Table');
    expect(service.getObjectList()).toHaveLength(2);
    expect(state.sceneReady()).toBe(true);

    failing.clear();
    await service.retryLoad();
    expect(state.loadStatus()).toBe('ready');
    expect(state.error()).toBeNull();
    expect(service.getObjectList()).toHaveLength(3);
  });

  it('error.retry() reloads the failed model', async () => {
    failing.add('sofa');
    service.initialize(canvas);
    await service.loadAll();
    failing.clear();
    state.error()?.retry?.();
    await vi.waitFor(() => expect(state.loadStatus()).toBe('ready'));
    expect(service.getObjectList()).toHaveLength(3);
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

  it('handlePointerMove forwards NDC to setHover and onHoverChange sets hovered once', async () => {
    service.initialize(canvas);
    await service.loadAll();
    const interaction = TestBed.inject(ObjectInteractionService) as unknown as {
      setHover: (ndc: unknown) => void;
      onHoverChange: (h: { object: Object3D } | null) => void;
    };
    interaction.setHover = vi.fn();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    } as DOMRect);
    service.handlePointerMove({ clientX: 50, clientY: 0 });
    expect(interaction.setHover).toHaveBeenCalledWith({ x: 0, y: 1 });
    service.handlePointerMove(null);
    expect(interaction.setHover).toHaveBeenLastCalledWith(null);

    const object = service.getScene().children.find(c => c.type === 'Group');
    const set = vi.spyOn(state.hovered, 'set');
    interaction.onHoverChange({ object: object as Object3D });
    interaction.onHoverChange({ object: object as Object3D });
    expect(state.hovered()).not.toBeNull();
    expect(set).toHaveBeenCalledTimes(1);
    interaction.onHoverChange(null);
    expect(state.hovered()).toBeNull();
  });
});
