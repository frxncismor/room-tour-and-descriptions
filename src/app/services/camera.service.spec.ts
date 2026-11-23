import { TestBed } from '@angular/core/testing';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
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
});
