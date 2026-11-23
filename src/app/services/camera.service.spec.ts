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

  describe('portrait framing (390x844)', () => {
    const aspect = 390 / 844;

    /** Cajas aproximadas de los 3 muebles (centro x/z de la config). */
    function furnitureBoxes(): Box3[] {
      const sizes: Record<string, number> = {
        sofa: 3,
        pokerTable: 1.8,
        bookshelf: 1.4,
      };
      return Object.entries(MODEL_CONFIGURATIONS).map(([id, cfg]) => {
        const half = sizes[id] / 2;
        return new Box3(
          new Vector3(cfg.position.x - half, 0, cfg.position.z - half),
          new Vector3(cfg.position.x + half, 1.5, cfg.position.z + half)
        );
      });
    }

    function expectAllInView(): void {
      const camera = service.getCamera();
      camera.lookAt(0, DEFAULT_SCENE_CONFIG.camera.initialHeight * 0.8, 0);
      camera.updateMatrixWorld(true);
      for (const box of furnitureBoxes()) {
        for (const x of [box.min.x, box.max.x]) {
          // Extremos laterales a la profundidad del centro (el sofá va girado 45°).
          const z = (box.min.z + box.max.z) / 2;
          const p = new Vector3(x, 0.5, z).project(camera);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
        }
      }
    }

    it('widens the fov (capped) and steps back so the 3 pieces fit', () => {
      service.setAspect(aspect);
      expect(service.getCamera().fov).toBeGreaterThan(
        DEFAULT_SCENE_CONFIG.camera.fov
      );
      expect(service.getCamera().fov).toBeLessThanOrEqual(90);
      service.initialize(DEFAULT_SCENE_CONFIG.camera, aspect);
      expect(service.getCamera().position.z).toBeGreaterThan(
        DEFAULT_SCENE_CONFIG.camera.initialPosition.z
      );
      expectAllInView();
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
  });
});
