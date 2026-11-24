import { TestBed } from '@angular/core/testing';
import { Vector3 } from 'three';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
import { CameraService } from '../services/camera.service';
import { SURFACE_IDS } from './piece-ids';
import {
  CEILING,
  ROOM_HEIGHT,
  ROOM_SIZE,
  SURFACES,
  WALLS,
  WallConfig,
} from './surfaces.config';

const vec = (v: readonly [number, number, number]) =>
  new Vector3(v[0], v[1], v[2]);

describe('surfaces.config', () => {
  it('defines the 5 surfaces of piece-ids, once each', () => {
    expect(Object.keys(SURFACES).sort()).toEqual([...SURFACE_IDS].sort());
    expect(WALLS.map(wall => wall.id)).toEqual([
      'wallGreen',
      'wallWindow',
      'wallTv',
      'wallDesk',
    ]);
    for (const id of SURFACE_IDS) {
      expect(SURFACES[id].id).toBe(id);
    }
  });

  it.each(WALLS.map(wall => [wall.id, wall] as const))(
    '%s: unit normal towards the room, 16 × 4 m, on the room limit',
    (_id, wall: WallConfig) => {
      const normal = vec(wall.normal);
      const along = vec(wall.along);
      const center = vec(wall.center);
      expect(normal.length()).toBeCloseTo(1, 9);
      expect(along.length()).toBeCloseTo(1, 9);
      expect(normal.dot(along)).toBeCloseTo(0, 9);
      expect(normal.y).toBe(0);
      // Hacia el interior: desde la pared al centro de la sala.
      const toRoom = new Vector3(0, center.y, 0).sub(center);
      expect(normal.dot(toRoom)).toBeCloseTo(ROOM_SIZE / 2, 9);
      expect(wall.width).toBe(ROOM_SIZE);
      expect(wall.height).toBe(ROOM_HEIGHT);
      expect(center.y).toBe(ROOM_HEIGHT / 2);
      expect(Math.abs(center.x) + Math.abs(center.z)).toBe(ROOM_SIZE / 2);
    }
  );

  it('the ceiling looks down and its pose looks up at most 30°', () => {
    expect(CEILING.normal).toEqual([0, -1, 0]);
    expect(CEILING.center[1]).toBe(ROOM_HEIGHT);
    const direction = vec(CEILING.pose.target)
      .sub(vec(CEILING.pose.position))
      .normalize();
    const pitch = (Math.asin(direction.y) * 180) / Math.PI;
    expect(pitch).toBeCloseTo(23, 6);
    expect(pitch).toBeLessThanOrEqual(30);
  });

  describe('matches CameraService (its walls are private constants)', () => {
    let camera: CameraService;

    beforeEach(() => {
      camera = TestBed.inject(CameraService);
      camera.setRoomLimits(DEFAULT_SCENE_CONFIG.room.limits);
      camera.initialize(DEFAULT_SCENE_CONFIG.camera, 16 / 9);
    });

    afterEach(() => camera.dispose());

    // 1 tramo (16:9) y 2 tramos (retrato 390 × 844).
    it.each([16 / 9, 390 / 844])(
      'every wall pose faces the configured normal and tramo axis (aspect %f)',
      aspect => {
        const tramos = camera.surfaceTramos(aspect);
        if (aspect > 1) expect(tramos).toBe(1);
        else expect(tramos).toBeGreaterThanOrEqual(2);
        for (const wall of WALLS) {
          const center = vec(wall.center);
          const normal = vec(wall.normal);
          const along = vec(wall.along);
          for (let tramo = 1; tramo <= tramos; tramo++) {
            const pose = camera.surfacePose(wall.id, tramo, aspect);
            const view = pose.position.clone().sub(pose.target).normalize();
            expect(view.distanceTo(normal)).toBeCloseTo(0, 6);
            const offset = pose.target.clone().sub(center);
            // El objetivo queda 0,5 m delante de la pared y centrado en el tramo.
            expect(offset.dot(normal)).toBeCloseTo(0.5, 6);
            const expectedAlong =
              -wall.width / 2 + (wall.width / tramos) * (tramo - 0.5);
            expect(offset.dot(along)).toBeCloseTo(expectedAlong, 6);
            // El mismo sentido de `along` lo usa para elegir el tramo.
            const point = center
              .clone()
              .addScaledVector(along, expectedAlong)
              .setY(1);
            expect(camera.surfaceTramoAt(wall.id, point, aspect)).toBe(tramo);
            expect(pose.tramoWidth).toBeCloseTo(wall.width / tramos, 9);
          }
        }
      }
    );

    it('the ceiling pose is the configured one', () => {
      const pose = camera.surfacePose('ceiling', 1, 16 / 9);
      expect(pose.position.distanceTo(vec(CEILING.pose.position))).toBeCloseTo(
        0,
        6
      );
      expect(pose.target.distanceTo(vec(CEILING.pose.target))).toBeCloseTo(
        0,
        6
      );
    });
  });
});
