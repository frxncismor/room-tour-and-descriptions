import { TestBed } from '@angular/core/testing';
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import {
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import { CameraService } from './camera.service';

describe('CameraService', () => {
  let service: CameraService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    service = TestBed.inject(CameraService);
    canvas = document.createElement('canvas');
    service.setRoomLimits(DEFAULT_SCENE_CONFIG.room.limits);
    service.initialize(DEFAULT_SCENE_CONFIG.camera, 16 / 9);
    service.setupControls(canvas);
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  it('clampToRoom keeps the camera and target inside the room', () => {
    service.getCamera().position.set(50, 1.7, -50);
    service.getTarget().set(-99, 1.3, 99);

    service.clampToRoom();

    const { minX, maxX, minZ, maxZ } = DEFAULT_SCENE_CONFIG.room.limits;
    const position = service.getCamera().position;
    expect(position.x).toBeLessThan(maxX);
    expect(position.z).toBeGreaterThan(minZ);
    expect(service.getTarget().x).toBeGreaterThan(minX);
    expect(service.getTarget().z).toBeLessThan(maxZ);
  });

  it('update() clamps a camera that drifted outside', () => {
    service.getCamera().position.set(30, 1.7, 30);
    service.update(16);
    expect(service.getCamera().position.x).toBeLessThan(
      DEFAULT_SCENE_CONFIG.room.limits.maxX
    );
  });

  it('teleportTo animates inside update(dt) without its own rAF', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const done = service.teleportTo(new Vector3(2, 0, 1));
    expect(service.isAnimating()).toBe(true);

    service.update(600);
    const mid = service.getCamera().position.clone();
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(2);
    expect(service.isAnimating()).toBe(true);

    service.update(1000);
    await expect(done).resolves.toBe(true);
    expect(service.isAnimating()).toBe(false);
    expect(service.getCamera().position.x).toBeCloseTo(2);
    expect(service.getCamera().position.z).toBeCloseTo(1);
    expect(service.getCamera().position.y).toBeCloseTo(1.7);
    expect(raf).not.toHaveBeenCalled();
  });

  it('a new teleport cancels the previous one (resolves false)', async () => {
    const first = service.teleportTo(new Vector3(2, 0, 1));
    const second = service.teleportTo(new Vector3(-2, 0, 1));
    await expect(first).resolves.toBe(false);
    service.update(5000);
    await expect(second).resolves.toBe(true);
    expect(service.getCamera().position.x).toBeCloseTo(-2);
  });

  it('cancelAnimation stops the move where it is', async () => {
    const done = service.teleportTo(new Vector3(2, 0, 1));
    service.update(300);
    const x = service.getCamera().position.x;
    service.cancelAnimation();
    await expect(done).resolves.toBe(false);
    service.update(5000);
    expect(service.getCamera().position.x).toBeCloseTo(x, 1);
  });

  it('teleportTo clamps targets outside the room', async () => {
    const done = service.teleportTo(new Vector3(100, 0, 0));
    service.update(5000);
    await done;
    expect(service.getCamera().position.x).toBeLessThan(
      DEFAULT_SCENE_CONFIG.room.limits.maxX
    );
  });

  it('respects prefers-reduced-motion by jumping at once', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    try {
      await expect(service.teleportTo(new Vector3(2, 0, 1))).resolves.toBe(
        true
      );
      expect(service.isAnimating()).toBe(false);
      expect(service.getCamera().position.x).toBeCloseTo(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('focusOn moves the target to the object and gets closer', async () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.position.set(0, 0.5, -6);
    mesh.updateMatrixWorld(true);
    const before = service.getCamera().position.distanceTo(mesh.position);

    const done = service.focusOn(mesh);
    service.update(5000);
    await expect(done).resolves.toBe(true);

    expect(service.getTarget().z).toBeCloseTo(-6, 0);
    expect(service.getCamera().position.distanceTo(mesh.position)).toBeLessThan(
      before
    );
  });

  it('reset returns to the initial position', async () => {
    void service.teleportTo(new Vector3(3, 0, 3));
    service.update(5000);
    const done = service.reset();
    service.update(5000);
    await expect(done).resolves.toBe(true);
    const initial = DEFAULT_SCENE_CONFIG.camera.initialPosition;
    expect(service.getCamera().position.x).toBeCloseTo(initial.x);
    expect(service.getCamera().position.z).toBeCloseTo(initial.z);
  });

  it('dispose cancels a running animation and is idempotent', async () => {
    const done = service.teleportTo(new Vector3(2, 0, 1));
    service.dispose();
    await expect(done).resolves.toBe(false);
    expect(() => service.dispose()).not.toThrow();
  });

  it('keeps the landscape fov untouched on wide screens', () => {
    expect(service.getCamera().fov).toBe(DEFAULT_SCENE_CONFIG.camera.fov);
    expect(service.getCamera().position.z).toBeCloseTo(
      DEFAULT_SCENE_CONFIG.camera.initialPosition.z
    );
  });

  describe('user input vs. own animations', () => {
    function press(key: string): void {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
    }

    beforeEach(() => {
      // jsdom has no layout: OrbitControls divides by clientHeight when panning.
      Object.defineProperty(canvas, 'clientHeight', { value: 800 });
      Object.defineProperty(canvas, 'clientWidth', { value: 1280 });
      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();
    });

    it('keyboard panning marks the view as touched so a resize keeps it', () => {
      service.update(16);
      const before = service.getCamera().position.clone();
      press('ArrowLeft');
      service.update(16);
      expect(service.getCamera().position.distanceTo(before)).toBeGreaterThan(
        0.005
      );
      const panned = service.getCamera().position.clone();
      service.setAspect(390 / 844);
      expect(service.getCamera().position.distanceTo(panned)).toBeLessThan(
        0.01
      );
    });

    it('own updates (damping, reframing) do not mark the view as touched', () => {
      service.update(16);
      service.setAspect(390 / 844);
      service.update(16);
      service.setAspect(16 / 9);
      expect(service.getCamera().position.y).toBeCloseTo(
        DEFAULT_SCENE_CONFIG.camera.initialPosition.y
      );
    });

    it('dragging during a teleport cancels it and hands control back', async () => {
      const done = service.teleportTo(new Vector3(3, 0, 3));
      service.update(300);
      expect(service.isAnimating()).toBe(true);
      const x = service.getCamera().position.x;

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerId: 1,
          pointerType: 'mouse',
          clientX: 10,
          clientY: 10,
        })
      );

      await expect(done).resolves.toBe(false);
      expect(service.isAnimating()).toBe(false);
      service.update(5000);
      expect(service.getCamera().position.x).toBeCloseTo(x, 1);
    });
  });

  describe('portrait framing (390x844)', () => {
    const aspect = 390 / 844;

    /** Cajas aproximadas de los 3 muebles (centro x/z de la config). */
    function furnitureBoxes(): Box3[] {
      const sizes: Record<string, { width: number; height: number }> = {
        sofa: { width: 2.2, height: 0.95 },
        pokerTable: { width: 1.4, height: 0.9 },
        bookshelf: { width: 1.4, height: 2 },
      };
      return Object.entries(MODEL_CONFIGURATIONS).map(([id, cfg]) => {
        const half = sizes[id].width / 2;
        return new Box3(
          new Vector3(cfg.position.x - half, 0, cfg.position.z - half),
          new Vector3(
            cfg.position.x + half,
            sizes[id].height,
            cfg.position.z + half
          )
        );
      });
    }

    /** Rango NDC (x, y) de las 8 esquinas de cada caja con la cámara actual. */
    function projectedExtent(): {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    } {
      const camera = service.getCamera();
      camera.lookAt(service.getTarget());
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      const extent = { minX: 9, maxX: -9, minY: 9, maxY: -9 };
      for (const box of furnitureBoxes()) {
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const p = new Vector3(x, y, z).project(camera);
              extent.minX = Math.min(extent.minX, p.x);
              extent.maxX = Math.max(extent.maxX, p.x);
              extent.minY = Math.min(extent.minY, p.y);
              extent.maxY = Math.max(extent.maxY, p.y);
            }
      }
      return extent;
    }

    function expectAllInView(): void {
      const e = projectedExtent();
      expect(e.minX).toBeGreaterThanOrEqual(-1);
      expect(e.maxX).toBeLessThanOrEqual(1);
      expect(e.minY).toBeGreaterThanOrEqual(-1);
      expect(e.maxY).toBeLessThanOrEqual(1);
    }

    /** Encuadre anterior (antes de FX1): cámara baja a ras de la sala. */
    function legacyHeightFraction(): number {
      service.initialize(DEFAULT_SCENE_CONFIG.camera, aspect);
      service.getCamera().position.set(0, 1.7, 7.7);
      service.getTarget().set(0, 1.36, 0);
      const e = projectedExtent();
      return (e.maxY - e.minY) / 2;
    }

    it('widens the fov (capped) and frames the 3 pieces inside the view', () => {
      service.setAspect(aspect);
      expect(service.getCamera().fov).toBeGreaterThan(
        DEFAULT_SCENE_CONFIG.camera.fov
      );
      expect(service.getCamera().fov).toBeLessThanOrEqual(90);
      service.initialize(DEFAULT_SCENE_CONFIG.camera, aspect);
      service.setupControls(canvas);
      expect(service.getCamera().position.z).toBeGreaterThan(
        DEFAULT_SCENE_CONFIG.camera.initialPosition.z
      );
      expectAllInView();
    });

    it('fills clearly more of the height than the old low framing and is vertically centred', () => {
      const before = legacyHeightFraction();
      service.initialize(DEFAULT_SCENE_CONFIG.camera, aspect);
      service.setupControls(canvas);
      const e = projectedExtent();
      const fraction = (e.maxY - e.minY) / 2;
      expect(fraction).toBeGreaterThan(before * 1.5);
      expect(Math.abs((e.maxY + e.minY) / 2)).toBeLessThan(0.25);
    });

    it.each([
      [390, 844],
      [360, 740],
      [430, 932],
    ])(
      'frames the strip tightly and centred at %ix%i (all 3 in view)',
      (width, height) => {
        service.initialize(DEFAULT_SCENE_CONFIG.camera, width / height);
        service.setupControls(canvas);
        expectAllInView();
        const e = projectedExtent();
        // The 3 pieces span ~8 m across but only ~2 m tall: at this aspect the
        // width is the limit, so the strip can fill ~16 % of the NDC height (box-based) at most.
        expect((e.maxY - e.minY) / 2).toBeGreaterThan(0.15);
        expect(Math.abs((e.maxY + e.minY) / 2)).toBeLessThan(0.1);
      }
    );

    it('desktop 1280x800 keeps the original framing', () => {
      service.initialize(DEFAULT_SCENE_CONFIG.camera, 1280 / 800);
      expect(
        service
          .getCamera()
          .position.distanceTo(DEFAULT_SCENE_CONFIG.camera.initialPosition)
      ).toBeLessThan(1e-6);
    });

    it('reset() frames the portrait view and a resize back restores the fov', async () => {
      service.setAspect(aspect);
      const done = service.reset();
      service.update(5000);
      await done;
      expectAllInView();
      service.setAspect(16 / 9);
      expect(service.getCamera().fov).toBe(DEFAULT_SCENE_CONFIG.camera.fov);
    });

    it('reframes on resize while the view is untouched, and keeps a user-moved view', () => {
      service.setAspect(aspect);
      const portraitPosition = service.getCamera().position.clone();
      expect(portraitPosition.y).toBeGreaterThan(2);
      service.setAspect(16 / 9);
      expect(service.getCamera().position.y).toBeCloseTo(
        DEFAULT_SCENE_CONFIG.camera.initialPosition.y
      );
      service.setAspect(aspect);
      expect(
        service.getCamera().position.distanceTo(portraitPosition)
      ).toBeLessThan(0.01);

      void service.teleportTo(new Vector3(2, 0, 1));
      service.update(5000);
      const moved = service.getCamera().position.clone();
      service.setAspect(16 / 9);
      expect(service.getCamera().position.distanceTo(moved)).toBeLessThan(0.01);
    });
  });
});
