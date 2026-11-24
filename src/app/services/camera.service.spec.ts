import { TestBed } from '@angular/core/testing';
import {
  Box3,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Ray,
  Vector3,
} from 'three';
import {
  DEFAULT_SCENE_CONFIG,
  MODEL_CONFIGURATIONS,
} from '../config/scene.config';
import { PIECES } from '../pieces/pieces.config';
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

  describe('focusOn occlusion', () => {
    const box = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = new Mesh(
        new BoxGeometry(sx, sy, sz),
        new MeshBasicMaterial()
      );
      mesh.position.set(x, y, z);
      mesh.updateMatrixWorld(true);
      return mesh;
    };

    const blocked = (blocker: Mesh, from: Vector3, to: Vector3): boolean => {
      const dir = to.clone().sub(from);
      const length = dir.length();
      const hit = new Ray(from.clone(), dir.normalize()).intersectBox(
        new Box3().setFromObject(blocker),
        new Vector3()
      );
      return hit !== null && hit.distanceTo(from) < length;
    };

    it('picks an unoccluded candidate when the default one is blocked', async () => {
      const target = box(0, 0.5, -3);
      service.getCamera().position.set(0, 1.7, 3);
      // Pared baja delante del objetivo: tapa el candidato por defecto.
      const blocker = box(0, 0.9, 0.2, 4, 2.2, 0.4);

      const done = service.focusOn(target, [blocker]);
      service.update(5000);
      await expect(done).resolves.toBe(true);

      const from = service.getCamera().position.clone();
      expect(blocked(blocker, from, new Vector3(0, 0.5, -3))).toBe(false);
      expect(service.getTarget().z).toBeCloseTo(-3, 0);
    });

    it('fits the focused object inside the visible area in portrait', async () => {
      service.setAspect(390 / 844);
      // Estantería ancha, como la del salón, a un lado de la sala.
      const target = box(3, 1, -2, 2.2, 2, 0.5);
      const done = service.focusOn(target);
      service.update(5000);
      await expect(done).resolves.toBe(true);

      const camera = service.getCamera();
      camera.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(target);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const ndc = new Vector3(x, y, z).project(camera);
            expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.9);
            expect(ndc.y).toBeLessThanOrEqual(0.9);
            // La ficha inferior ocupa ~30 % del alto.
            expect(ndc.y).toBeGreaterThanOrEqual(-0.4);
          }
    });

    it('frames a flat wall piece (1.21 x 0.93 x 0.04 at z = -7.975) from its front', async () => {
      const painting = box(-4, 1.66, -7.975, 1.21, 0.93, 0.04);
      service.getCamera().position.set(0, 1.7, 4.5);

      const done = service.focusOn(painting);
      service.update(5000);
      await expect(done).resolves.toBe(true);

      const camera = service.getCamera();
      expect(camera.position.z).toBeGreaterThan(-7);
      // Mira hacia el muro (-Z) con menos de 30° respecto de la normal del cuadro.
      const view = service.getTarget().clone().sub(camera.position).normalize();
      const angle = Math.acos(view.dot(new Vector3(0, 0, -1)));
      expect(angle).toBeLessThanOrEqual((30 * Math.PI) / 180);
      expect(service.getTarget().x).toBeCloseTo(-4, 0);
    });

    it('keeps a focused wall piece out of the description sheet column at 1280x800', async () => {
      service.setAspect(1280 / 800);
      const painting = box(-4, 1.66, -7.975, 1.21, 0.93, 0.04);
      service.getCamera().position.set(0, 1.7, 4.5);

      const done = service.focusOn(painting);
      service.update(5000);
      await expect(done).resolves.toBe(true);

      const camera = service.getCamera();
      camera.updateMatrixWorld(true);
      // Columna de la ficha: 392 px de 1280 -> NDC x >= 1 - 2 * 392 / 1280.
      const sheetStart = 1 - (2 * 392) / 1280;
      const bounds = new Box3().setFromObject(painting);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const ndc = new Vector3(x, y, z).project(camera);
            expect(ndc.x).toBeLessThanOrEqual(sheetStart + 1e-2);
            expect(ndc.x).toBeGreaterThanOrEqual(-1);
          }
    });

    it('views a flat wall piece almost head-on (<= 12 degrees)', async () => {
      service.setAspect(1280 / 800);
      const painting = box(-4, 1.66, -7.975, 1.21, 0.93, 0.04);
      service.getCamera().position.set(3, 1.7, -2);

      const done = service.focusOn(painting);
      service.update(5000);
      await expect(done).resolves.toBe(true);

      const camera = service.getCamera();
      const view = painting
        .getWorldPosition(new Vector3())
        .sub(camera.position)
        .setY(0)
        .normalize();
      const angle = Math.acos(view.dot(new Vector3(0, 0, -1)));
      expect(angle).toBeLessThanOrEqual((12 * Math.PI) / 180);
    });

    it('looks down at most 30 degrees at a small floor piece', async () => {
      service.setAspect(390 / 844);
      const plant = box(1.85, 0.3, -7.55, 0.4, 0.6, 0.4);
      service.getCamera().position.set(7, 3.8, -1.5);

      const done = service.focusOn(plant);
      service.update(5000);
      await expect(done).resolves.toBe(true);

      const camera = service.getCamera();
      const toPlant = plant.position.clone().sub(camera.position);
      const pitch = Math.atan2(-toPlant.y, Math.hypot(toPlant.x, toPlant.z));
      expect(pitch).toBeLessThanOrEqual((32 * Math.PI) / 180);
    });

    it('keeps the default candidate when nothing blocks it', async () => {
      const target = box(0, 0.5, -3);
      const faraway = box(4, 0.5, 0, 1, 1, 1);

      service.getCamera().position.set(0, 1.7, 3);
      void service.focusOn(target, [faraway]);
      service.update(5000);
      const withObstacle = service.getCamera().position.clone();

      service.getCamera().position.set(0, 1.7, 3);
      void service.focusOn(target);
      service.update(5000);

      expect(withObstacle.x).toBeCloseTo(service.getCamera().position.x, 5);
      expect(withObstacle.z).toBeCloseTo(service.getCamera().position.z, 5);
      expect(withObstacle.x).toBeCloseTo(0, 3);
    });
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

    it('keyboard panning during a teleport cancels the tween', async () => {
      const done = service.teleportTo(new Vector3(3, 0, 3));
      service.update(300);
      expect(service.isAnimating()).toBe(true);
      press('ArrowLeft');
      service.update(16);
      await expect(done).resolves.toBe(false);
      expect(service.isAnimating()).toBe(false);
    });

    it('reset does not mark the framed pose when panning cancelled it', async () => {
      service.teleportTo(new Vector3(3, 0, 3));
      service.update(2000);
      const done = service.reset();
      service.update(300);
      press('ArrowLeft');
      service.update(16);
      await expect(done).resolves.toBe(false);
      const panned = service.getCamera().position.clone();
      service.setAspect(390 / 844);
      expect(service.getCamera().position.distanceTo(panned)).toBeLessThan(
        0.01
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

    /** Piezas que el encuadre inicial debe abarcar (las piezas nuevas del muro del fondo quedan fuera: se ven al caminar). */
    const FRAMED = ['sofa', 'pokerTable', 'bookshelf'];

    /** Cajas aproximadas de los 3 muebles (centro x/z de la config). */
    function furnitureBoxes(): Box3[] {
      const sizes: Record<string, { width: number; height: number }> = {
        sofa: { width: 3.6, height: 0.95 },
        pokerTable: { width: 1.4, height: 0.9 },
        bookshelf: { width: 1.4, height: 2 },
        landscapePainting: { width: 1.21, height: 2.13 },
        succulent: { width: 0.4, height: 0.59 },
      };
      return Object.entries(MODEL_CONFIGURATIONS)
        .filter(([id]) => FRAMED.includes(id))
        .map(([id, cfg]) => {
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
      const position = service.getCamera().position;
      const heading = service.getTarget().clone().sub(position);
      // Diagonal: looks sideways as much as forward, from under the 4 m ceiling.
      expect(Math.abs(heading.x)).toBeGreaterThan(3);
      expect(Math.abs(heading.z)).toBeGreaterThan(2);
      expect(position.y).toBeLessThan(DEFAULT_SCENE_CONFIG.room.height);
      expect(heading.y).toBeLessThan(0);
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
      [360, 780],
      [430, 932],
    ])(
      'frames the 3 pieces diagonally, filling >= 35 % of the height at %ix%i',
      (width, height) => {
        service.initialize(DEFAULT_SCENE_CONFIG.camera, width / height);
        service.setupControls(canvas);
        expectAllInView();
        const e = projectedExtent();
        expect((e.maxY - e.minY) / 2).toBeGreaterThanOrEqual(0.35);
        expect(Math.abs((e.maxY + e.minY) / 2)).toBeLessThan(0.2);
        // Camera stays inside the room limits.
        const p = service.getCamera().position;
        const l = DEFAULT_SCENE_CONFIG.room.limits;
        expect(p.x).toBeLessThanOrEqual(l.maxX);
        expect(p.z).toBeGreaterThanOrEqual(l.minZ);
        expect(p.y).toBeLessThan(DEFAULT_SCENE_CONFIG.room.height);
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
  describe('focusOn with a preferred approach (chained selections)', () => {
    interface Piece {
      mesh: Mesh;
      front: Vector3;
    }
    const piece = (
      x: number,
      y: number,
      z: number,
      size: [number, number, number],
      rotY = 0
    ): Piece => {
      const mesh = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial());
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.updateMatrixWorld(true);
      return {
        mesh,
        front: new Vector3(Math.sin(rotY), 0, Math.cos(rotY)),
      };
    };
    const pieces: Record<string, Piece> = {
      sofa: piece(-3, 0.45, -3, [2.2, 0.9, 1], Math.PI / 4),
      poker: piece(3, 0.4, -3, [1.6, 0.8, 1.6]),
      shelf: piece(0, 1, -7.6, [2.2, 2, 0.5]),
      painting: piece(-4, 1.66, -7.975, [1.21, 0.93, 0.04]),
      succulent: piece(1.85, 0.3, -7.55, [0.4, 0.6, 0.4], Math.PI / 6),
    };
    const vase = piece(-1.85, 0.3, -7.55, [0.4, 0.6, 0.4]);
    const previousPoses = {
      initial: new Vector3(0, 1.7, 4.5),
      tealWall: new Vector3(-3, 1.7, -7.2),
      behindSofa: new Vector3(-6, 1.7, -5),
      highCorner: new Vector3(7, 3.8, -1.5),
      beside: new Vector3(7.2, 1.7, -7),
    };

    for (const [name, current] of Object.entries(pieces)) {
      for (const [poseName, pose] of Object.entries(previousPoses)) {
        it(`frames ${name} from its front and unobstructed coming from ${poseName}`, async () => {
          service.setAspect(1280 / 800);
          service.getCamera().position.copy(pose);
          const obstacles = [
            ...Object.entries(pieces)
              .filter(([other]) => other !== name)
              .map(([, p]) => p.mesh),
            vase.mesh,
          ];

          const done = service.focusOn(current.mesh, obstacles, current.front);
          service.update(5000);
          await expect(done).resolves.toBe(true);

          const from = service.getCamera().position.clone();
          const center = new Box3()
            .setFromObject(current.mesh)
            .getCenter(new Vector3());
          // En el lado frontal de la pieza.
          expect(
            from.clone().sub(center).setY(0).dot(current.front)
          ).toBeGreaterThan(0);
          for (const obstacle of obstacles) {
            const obstacleBox = new Box3().setFromObject(obstacle);
            // Ningún obstáculo entre la cámara y la pieza...
            const dir = center.clone().sub(from);
            const length = dir.length();
            const hit = new Ray(from.clone(), dir.normalize()).intersectBox(
              obstacleBox,
              new Vector3()
            );
            expect(hit === null || hit.distanceTo(from) >= length).toBe(true);
            // ...ni pegado a la cámara.
            expect(obstacleBox.distanceToPoint(from)).toBeGreaterThan(0.25);
          }
        });
      }
    }
  });

  describe('initial view is unchanged by the free-zoom limits', () => {
    it.each([
      ['1.6:1', 1.6, [0, 1.7, 4.5], [0, 1.36, 0]],
      ['2.2:1', 2.2, [0, 1.7, 4.5], [0, 1.36, 0]],
      ['portrait 390x844', 390 / 844, [7, 3.8, -1.5], [0, 0.5, -4.5]],
    ])('keeps the same pose at %s', (_name, aspect, position, target) => {
      service.initialize(DEFAULT_SCENE_CONFIG.camera, aspect as number);
      service.setupControls(canvas);
      for (let i = 0; i < 5; i++) service.update(16);
      const [px, py, pz] = position as number[];
      const [tx, ty, tz] = target as number[];
      expect(
        service.getCamera().position.distanceTo(new Vector3(px, py, pz))
      ).toBeLessThan(1e-3);
      expect(
        service.getTarget().distanceTo(new Vector3(tx, ty, tz))
      ).toBeLessThan(1e-3);
    });
  });

  describe('free zoom limits', () => {
    function controlsOf(): {
      minDistance: number;
      maxDistance: number;
      zoomToCursor: boolean;
    } {
      return (service as unknown as { controls: never }).controls;
    }

    it('allows 0.8 m up to 12 m', () => {
      expect(controlsOf().minDistance).toBe(0.8);
      expect(controlsOf().maxDistance).toBe(12);
    });

    it('keeps the portrait framing reachable (maxDistance above its distance)', () => {
      service.initialize(DEFAULT_SCENE_CONFIG.camera, 390 / 844);
      service.setupControls(canvas);
      const distance = service
        .getCamera()
        .position.distanceTo(service.getTarget());
      expect(controlsOf().maxDistance).toBeGreaterThanOrEqual(distance);
    });
  });

  describe('zoom to cursor', () => {
    function wheelAt(x: number, y: number, deltaY: number): void {
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          clientX: x,
          clientY: y,
          deltaY,
          bubbles: true,
          cancelable: true,
        })
      );
    }

    beforeEach(() => {
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 1280,
        bottom: 720,
        width: 1280,
        height: 720,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    it('is enabled', () => {
      expect(
        (service as unknown as { controls: { zoomToCursor: boolean } }).controls
          .zoomToCursor
      ).toBe(true);
    });

    it.each([
      ['bottom right', 1275, 715],
      ['top left', 5, 5],
      ['top right', 1275, 5],
    ])(
      'repeated zoom in towards the %s corner keeps camera and target in the room',
      (_name, x, y) => {
        service.initialize(DEFAULT_SCENE_CONFIG.camera, 1280 / 720);
        service.setupControls(canvas);
        const l = DEFAULT_SCENE_CONFIG.room.limits;
        for (let i = 0; i < 80; i++) {
          wheelAt(x, y, -120);
          service.update(16);
          const camera = service.getCamera().position;
          const target = service.getTarget();
          for (const p of [camera, target]) {
            expect(p.x).toBeGreaterThanOrEqual(l.minX + 0.5 - 1e-6);
            expect(p.x).toBeLessThanOrEqual(l.maxX - 0.5 + 1e-6);
            expect(p.z).toBeGreaterThanOrEqual(l.minZ + 0.5 - 1e-6);
            expect(p.z).toBeLessThanOrEqual(l.maxZ - 0.5 + 1e-6);
            expect(p.y).toBeGreaterThanOrEqual(0.3 - 1e-6);
            expect(p.y).toBeLessThanOrEqual(3.9 + 1e-6);
            expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
          }
          expect(camera.distanceTo(target)).toBeGreaterThanOrEqual(0.8 - 1e-6);
        }
      }
    );

    it('zooming out stays within 12 m and the room', () => {
      service.initialize(DEFAULT_SCENE_CONFIG.camera, 1280 / 720);
      service.setupControls(canvas);
      for (let i = 0; i < 80; i++) {
        wheelAt(640, 360, 120);
        service.update(16);
      }
      expect(
        service.getCamera().position.distanceTo(service.getTarget())
      ).toBeLessThanOrEqual(12 + 1e-6);
      expect(Math.abs(service.getCamera().position.x)).toBeLessThanOrEqual(7.5);
      expect(Math.abs(service.getCamera().position.z)).toBeLessThanOrEqual(7.5);
    });
  });

  describe('focusSurface', () => {
    type Wall = 'wallGreen' | 'wallWindow' | 'wallTv' | 'wallDesk';
    const WALLS: Wall[] = ['wallGreen', 'wallWindow', 'wallTv', 'wallDesk'];
    const NORMALS: Record<Wall, Vector3> = {
      wallGreen: new Vector3(0, 0, 1),
      wallWindow: new Vector3(1, 0, 0),
      wallTv: new Vector3(0, 0, -1),
      wallDesk: new Vector3(-1, 0, 0),
    };
    const ALONG: Record<Wall, Vector3> = {
      wallGreen: new Vector3(1, 0, 0),
      wallWindow: new Vector3(0, 0, -1),
      wallTv: new Vector3(-1, 0, 0),
      wallDesk: new Vector3(0, 0, 1),
    };
    const CENTER: Record<Wall, Vector3> = {
      wallGreen: new Vector3(0, 0, -8),
      wallWindow: new Vector3(-8, 0, 0),
      wallTv: new Vector3(0, 0, 8),
      wallDesk: new Vector3(8, 0, 0),
    };

    /** Cámara de prueba con la pose de la superficie y el fov que da el servicio. */
    function cameraAt(
      pose: { position: Vector3; target: Vector3 },
      aspect: number
    ): PerspectiveCamera {
      service.setAspect(aspect);
      const probe = service.getCamera().clone();
      probe.position.copy(pose.position);
      probe.lookAt(pose.target);
      probe.updateMatrixWorld(true);
      probe.updateProjectionMatrix();
      return probe;
    }

    function inFrustum(camera: PerspectiveCamera, point: Vector3): boolean {
      const ndc = point.clone().project(camera);
      return (
        Math.abs(ndc.x) <= 1 + 1e-6 && Math.abs(ndc.y) <= 1 + 1e-6 && ndc.z < 1
      );
    }

    it.each([
      [1.6, 1],
      [16 / 9, 1],
      [2.2, 1],
      [4 / 3, 2],
      [390 / 844, 3],
    ])(
      'splits a wall into the right number of tramos at aspect %f',
      (aspect, n) => {
        expect(service.surfaceTramos(aspect)).toBe(n);
      }
    );

    describe.each([
      ['1.6:1', 1.6],
      ['1.33:1', 4 / 3],
      ['0.46:1', 0.46],
      ['390x844', 390 / 844],
    ])('at %s', (_name, aspect) => {
      for (const wall of WALLS) {
        it(`${wall}: every tramo fits the frustum with a 0.4 m margin`, () => {
          const n = service.surfaceTramos(aspect);
          for (let tramo = 1; tramo <= n; tramo++) {
            const pose = service.surfacePose(wall, tramo, aspect);
            const probe = cameraAt(pose, aspect);
            const width = 16 / n;
            const mid = CENTER[wall]
              .clone()
              .addScaledVector(ALONG[wall], -8 + width * (tramo - 0.5));
            for (const side of [-1, 1]) {
              for (const top of [false, true]) {
                const corner = mid
                  .clone()
                  .addScaledVector(ALONG[wall], side * (width / 2 + 0.4));
                corner.y = top ? 4.4 : -0.4;
                expect(inFrustum(probe, corner)).toBe(true);
              }
            }
            const l = DEFAULT_SCENE_CONFIG.room.limits;
            expect(Math.abs(pose.position.x)).toBeLessThanOrEqual(l.maxX - 0.5);
            expect(Math.abs(pose.position.z)).toBeLessThanOrEqual(l.maxZ - 0.5);
            const wallPoint = pose.target
              .clone()
              .addScaledVector(NORMALS[wall], -0.5);
            expect(pose.position.distanceTo(wallPoint)).toBeLessThanOrEqual(
              9 + 1e-6
            );
            // Objetivo 0,5 m delante de la pared.
            expect(
              pose.target.clone().sub(CENTER[wall]).dot(NORMALS[wall])
            ).toBeCloseTo(0.5);
          }
        });
      }
    });

    it('chooses the tramo nearest to the pressed point', () => {
      const aspect = 4 / 3;
      const at = (id: Wall | 'ceiling', x: number, z: number): number =>
        service.surfaceTramoAt(id, new Vector3(x, 1, z), aspect);
      expect(at('wallGreen', -6, -8)).toBe(1);
      expect(at('wallGreen', 6, -8)).toBe(2);
      // La pared de la TV corre al revés (x decrece a lo largo de su eje).
      expect(at('wallTv', 6, 8)).toBe(1);
      expect(at('ceiling', 6, 1)).toBe(1);
    });

    it('ceiling: pitch <= 30 deg, camera in the room, (0; 4; 5.9) in the frustum', () => {
      for (const aspect of [1.6, 4 / 3, 390 / 844]) {
        const pose = service.surfacePose('ceiling', 1, aspect);
        const dir = pose.target.clone().sub(pose.position).normalize();
        const pitch = (Math.asin(dir.y) * 180) / Math.PI;
        expect(pitch).toBeGreaterThan(0);
        expect(pitch).toBeLessThanOrEqual(30);
        expect(pitch).toBeCloseTo(23, 1);
        expect(Math.abs(pose.position.x)).toBeLessThan(7.5);
        expect(Math.abs(pose.position.z)).toBeLessThan(7.5);
        expect(pose.position.y).toBeLessThan(4);
        expect(Math.abs(pose.target.z)).toBeLessThanOrEqual(7.5);
        expect(pose.target.y).toBeLessThanOrEqual(3.9);
        expect(inFrustum(cameraAt(pose, aspect), new Vector3(0, 4, 5.9))).toBe(
          true
        );
      }
    });

    it('animates to a wall within update() and holds the pose despite the polar limit', async () => {
      service.setAspect(1.6);
      const expected = service.surfacePose('wallTv', 1, 1.6);
      const done = service.focusSurface('wallTv', 1, 1.6);
      expect(service.isAnimating()).toBe(true);
      service.update(2000);
      await expect(done).resolves.toBe(true);
      for (let i = 0; i < 10; i++) service.update(16);
      expect(
        service.getCamera().position.distanceTo(expected.position)
      ).toBeLessThan(0.05);
      expect(service.getTarget().distanceTo(expected.target)).toBeLessThan(
        0.05
      );
    });

    it('animates to the ceiling and holds the upward pose', async () => {
      const expected = service.surfacePose('ceiling', 1, 16 / 9);
      const done = service.focusSurface('ceiling', 1, 16 / 9);
      service.update(2000);
      await expect(done).resolves.toBe(true);
      for (let i = 0; i < 10; i++) service.update(16);
      expect(
        service.getCamera().position.distanceTo(expected.position)
      ).toBeLessThan(0.05);
      expect(service.getTarget().distanceTo(expected.target)).toBeLessThan(
        0.05
      );
    });

    it('restores the normal polar limit after the next ordinary move', async () => {
      const polar = (): number =>
        (service as unknown as { controls: { maxPolarAngle: number } }).controls
          .maxPolarAngle;
      const normal = polar();
      const surface = service.focusSurface('ceiling', 1, 16 / 9);
      expect(polar()).toBeGreaterThan(normal);
      service.update(2000);
      await surface;
      const moved = service.teleportTo(new Vector3(1, 0, 1));
      service.update(2000);
      await moved;
      expect(polar()).toBe(normal);
    });

    it('respects prefers-reduced-motion: jumps with no transition', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      try {
        const expected = service.surfacePose('wallDesk', 1, 16 / 9);
        await expect(service.focusSurface('wallDesk', 1, 16 / 9)).resolves.toBe(
          true
        );
        expect(service.isAnimating()).toBe(false);
        expect(
          service.getCamera().position.distanceTo(expected.position)
        ).toBeLessThan(0.05);
        expect(service.getTarget().distanceTo(expected.target)).toBeLessThan(
          0.05
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
  describe('every piece framed from the front (fx9)', () => {
    const MAX_OFF_AXIS_DEG = 45; // tope de ángulo respecto al frente (R9-I2)
    const MAX_PITCH_DEG = 35; // tope de focusOn (30°) + holgura del clamp a la sala
    const viewports = [
      { name: '16:10', aspect: 1280 / 800 },
      { name: '390x844', aspect: 390 / 844 },
    ];

    /** Caja de la pieza (unión de sus proxies), como la que encuadra SceneService. */
    function pieceBox(config: (typeof PIECES)[number]): Box3 {
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
        union.union(
          new Box3(center.clone().sub(half), center.clone().add(half))
        );
      }
      return union;
    }

    for (const viewport of viewports) {
      for (const config of PIECES) {
        it(`${config.id} at ${viewport.name}: not from above and fully in view`, async () => {
          service.setAspect(viewport.aspect);
          service.getCamera().position.set(0, 1.7, 4.5);
          const box = pieceBox(config);
          const center = box.getCenter(new Vector3());
          const mesh = new Mesh(
            new BoxGeometry(
              box.max.x - box.min.x,
              box.max.y - box.min.y,
              box.max.z - box.min.z
            ),
            new MeshBasicMaterial()
          );
          mesh.position.copy(center);
          mesh.updateMatrixWorld(true);

          // Las demás piezas tapan, como en la escena (la silla delante del monitor).
          const obstacles = PIECES.filter(
            other => other.id !== config.id
          ).flatMap(other =>
            other.proxies.map(proxy => {
              const b = pieceBox({ ...other, proxies: [proxy] });
              const m = new Mesh(
                new BoxGeometry(
                  b.max.x - b.min.x,
                  b.max.y - b.min.y,
                  b.max.z - b.min.z
                ),
                new MeshBasicMaterial()
              );
              b.getCenter(m.position);
              m.updateMatrixWorld(true);
              return m;
            })
          );
          const done = service.focusOn(
            mesh,
            obstacles,
            new Vector3(...config.facing)
          );
          service.update(5000);
          await expect(done).resolves.toBe(true);

          const camera = service.getCamera();
          // R9-I2: la cámara queda cerca del eje del frente (no de canto ni por detrás).
          const off = new Vector3(
            camera.position.x - center.x,
            0,
            camera.position.z - center.z
          ).normalize();
          const front = new Vector3(...config.facing).setY(0).normalize();
          const angle =
            (Math.acos(Math.min(1, off.dot(front))) * 180) / Math.PI;
          expect(angle).toBeLessThanOrEqual(MAX_OFF_AXIS_DEG);
          const horizontal = Math.hypot(
            camera.position.x - center.x,
            camera.position.z - center.z
          );
          const pitch =
            (Math.atan2(camera.position.y - center.y, horizontal) * 180) /
            Math.PI;
          expect(pitch).toBeLessThanOrEqual(MAX_PITCH_DEG);

          camera.lookAt(service.getTarget());
          camera.updateMatrixWorld(true);
          camera.updateProjectionMatrix();
          for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
              for (const z of [box.min.z, box.max.z]) {
                const ndc = new Vector3(x, y, z).project(camera);
                expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
                expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
                expect(ndc.z).toBeLessThan(1);
              }
        });
      }
    }
  });
});
