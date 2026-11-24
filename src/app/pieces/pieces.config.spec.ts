import { TestBed } from '@angular/core/testing';
import { Box3, Frustum, Matrix4, Vector3 } from 'three';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
import { GROUP_IDS } from '../i18n/messages';
import { CameraService } from '../services/camera.service';
import { PIECE_IDS, PIECE_IDS_WITH_ACTIONS, PieceId } from './piece-ids';
import {
  AXIS_Y,
  PIECES,
  PIECES_BY_ID,
  PieceConfig,
  PieceProxy,
} from './pieces.config';
import { WALLS } from './surfaces.config';

/** Caja alineada con los ejes que envuelve una caja local girada sobre Y. */
const worldBox = (proxy: PieceProxy): Box3 => {
  const [w, h, d] = proxy.size;
  const cos = Math.abs(Math.cos(proxy.rotationY));
  const sin = Math.abs(Math.sin(proxy.rotationY));
  const half = new Vector3(
    (cos * w + sin * d) / 2,
    h / 2,
    (sin * w + cos * d) / 2
  );
  const center = new Vector3(...proxy.position);
  return new Box3(center.clone().sub(half), center.clone().add(half));
};

/** Contacto de apoyo (lámpara sobre mesa, plato sobre aparador): ≤ 1 cm. */
const CONTACT = 0.01;
/** Pasillo mínimo entre piezas de pie (m) y holgura a pared de lo colgado (m). */
const MIN_AISLE = 0.9;
const WALL_GAP_MIN = 0.02 - 1e-9;
const WALL_GAP_MAX = 0.06 + 1e-9;
const ROOM = new Box3(new Vector3(-8, -0.01, -8), new Vector3(8, 4.01, 8));

/** Solape (m) a lo largo de cada eje; positivo en los tres = intersección. */
const overlap = (a: Box3, b: Box3): Vector3 =>
  new Vector3(
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y),
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z)
  );

const intersects = (a: Box3, b: Box3): boolean => {
  const o = overlap(a, b);
  return o.x > CONTACT && o.y > CONTACT && o.z > CONTACT;
};

/** Distancia horizontal (m) entre las huellas de dos cajas; 0 si se tocan. */
const footprintGap = (a: Box3, b: Box3): number => {
  const gx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0);
  const gz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0);
  return Math.hypot(gx, gz);
};

const boxesOf = (piece: PieceConfig): Box3[] => piece.proxies.map(worldBox);
const newPieces = PIECES.filter(piece => piece.origin === 'new');
const existingPieces = PIECES.filter(piece => piece.origin === 'existing');

describe('pieces.config: inventory', () => {
  it('has the 35 ids of piece-ids, each once', () => {
    const ids = PIECES.map(piece => piece.id);
    expect(ids).toHaveLength(35);
    expect(new Set(ids).size).toBe(35);
    expect([...ids].sort()).toEqual([...PIECE_IDS].sort());
    for (const id of PIECE_IDS) {
      expect(PIECES_BY_ID[id].id).toBe(id);
    }
  });

  it('spreads them over the 6 groups of the list (8·8·6·7·5·1)', () => {
    const counts = GROUP_IDS.map(
      group => PIECES.filter(piece => piece.group === group).length
    );
    expect(counts).toEqual([8, 8, 6, 7, 5, 1]);
    for (const group of GROUP_IDS) {
      const orders = PIECES.filter(piece => piece.group === group).map(
        piece => piece.order
      );
      expect(orders).toEqual(orders.map((_, index) => index));
    }
  });

  it('splits into 21 new pieces and 14 existing ones', () => {
    expect(newPieces).toHaveLength(21);
    expect(existingPieces).toHaveLength(14);
  });

  it('every piece has a raycast target: the object itself or proxy boxes', () => {
    for (const piece of PIECES) {
      expect(piece.proxies.length).toBeGreaterThan(0);
      expect(['object', 'proxy']).toContain(piece.pick);
      for (const proxy of piece.proxies) {
        expect(proxy.size.every(side => side > 0)).toBe(true);
      }
    }
  });

  it('has the actions of piece-ids and none elsewhere', () => {
    for (const piece of PIECES) {
      const expected =
        (PIECE_IDS_WITH_ACTIONS as Partial<Record<PieceId, readonly string[]>>)[
          piece.id
        ] ?? [];
      expect([...piece.actions]).toEqual([...expected]);
    }
  });

  it('keeps prints and the mirror on the 1,60 m axis and the TV at 1,40 m', () => {
    const axisIds: PieceId[] = [
      'printSpiraea',
      'printFelce',
      'printNook',
      'printRight',
      'printsFront',
      'diptych',
      'archMirror',
    ];
    for (const id of axisIds) {
      for (const proxy of PIECES_BY_ID[id].proxies) {
        expect(Math.abs(proxy.position[1] - AXIS_Y)).toBeLessThanOrEqual(0.02);
      }
    }
    expect(PIECES_BY_ID.tv.position[1]).toBe(1.4);
    expect(PIECES_BY_ID.tv.position[0]).toBe(0);
  });

  it('puts the TV wall on x = 0 symmetry (prints ±2,75, door/mirror ±5,6)', () => {
    const [left, right] = PIECES_BY_ID.printsFront.proxies;
    expect(left.position[0]).toBeCloseTo(-right.position[0], 9);
    expect(Math.abs(right.position[0])).toBe(2.75);
    expect(PIECES_BY_ID.door.position[0]).toBe(5.6);
    expect(PIECES_BY_ID.archMirror.position[0]).toBe(-5.6);
  });

  it('faces are unit horizontal vectors that follow the rotation', () => {
    for (const piece of PIECES) {
      const [x, y, z] = piece.facing;
      expect(y).toBe(0);
      expect(Math.hypot(x, z)).toBeCloseTo(1, 9);
      expect(x).toBeCloseTo(Math.sin(piece.rotationY), 9);
      expect(z).toBeCloseTo(Math.cos(piece.rotationY), 9);
    }
  });

  it('wall pieces face away from the wall they hang on', () => {
    for (const piece of PIECES.filter(p => p.mount === 'wall')) {
      const wall = WALLS.reduce((best, candidate) => {
        const distance = (w: (typeof WALLS)[number]) =>
          Math.abs(
            (piece.position[0] - w.center[0]) * w.normal[0] +
              (piece.position[2] - w.center[2]) * w.normal[2]
          );
        return distance(candidate) < distance(best) ? candidate : best;
      });
      const dot =
        piece.facing[0] * wall.normal[0] + piece.facing[2] * wall.normal[2];
      expect({ id: piece.id, dot: Math.round(dot) }).toEqual({
        id: piece.id,
        dot: 1,
      });
    }
  });
});

describe('pieces.config: static placement (SC-412)', () => {
  it('keeps every new piece inside the room', () => {
    for (const piece of newPieces) {
      for (const box of boxesOf(piece)) {
        expect(ROOM.containsBox(box), piece.id).toBe(true);
      }
    }
  });

  it('has no overlaps between pieces (new vs new and new vs existing)', () => {
    const clashes: string[] = [];
    for (const a of newPieces) {
      for (const b of PIECES) {
        if (a.id >= b.id && b.origin === 'new') continue;
        if (a.id === b.id) continue;
        for (const boxA of boxesOf(a)) {
          for (const boxB of boxesOf(b)) {
            if (intersects(boxA, boxB)) clashes.push(`${a.id} × ${b.id}`);
          }
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('keeps prints, mirror, door and TV 0,02–0,06 m from their wall', () => {
    const hung: PieceId[] = [
      'printNook',
      'printRight',
      'printsFront',
      'archMirror',
      'door',
      'tv',
    ];
    for (const id of hung) {
      for (const box of boxesOf(PIECES_BY_ID[id])) {
        const gaps = [
          box.min.x + 8,
          8 - box.max.x,
          box.min.z + 8,
          8 - box.max.z,
        ];
        const gap = Math.min(...gaps);
        expect(gap, id).toBeGreaterThanOrEqual(WALL_GAP_MIN);
        expect(gap, id).toBeLessThanOrEqual(WALL_GAP_MAX);
      }
    }
  });

  it('leaves aisles of at least 0,9 m between floor pieces of different clusters', () => {
    const standing = PIECES.filter(
      piece => piece.mount === 'floor' && piece.origin === 'new'
    );
    const others = PIECES.filter(piece => piece.mount === 'floor');
    const tight: string[] = [];
    for (const a of standing) {
      for (const b of others) {
        if (a.id === b.id) continue;
        if (a.cluster && a.cluster === b.cluster) continue;
        for (const boxA of boxesOf(a)) {
          for (const boxB of boxesOf(b)) {
            const gap = footprintGap(boxA, boxB);
            if (gap < MIN_AISLE - 1e-9) {
              tight.push(`${a.id} × ${b.id}: ${gap.toFixed(2)} m`);
            }
          }
        }
      }
    }
    expect(tight).toEqual([]);
  });
});

describe('pieces.config: initial views stay untouched (SC-400, FR-404)', () => {
  let camera: CameraService;

  beforeEach(() => {
    camera = TestBed.inject(CameraService);
    camera.setRoomLimits(DEFAULT_SCENE_CONFIG.room.limits);
  });

  afterEach(() => camera.dispose());

  /** Frustum real de la vista inicial con el aspecto dado. */
  const initialFrustum = (aspect: number): Frustum => {
    camera.initialize(DEFAULT_SCENE_CONFIG.camera, aspect);
    camera.setupControls(document.createElement('canvas'));
    const view = camera.getCamera();
    view.lookAt(camera.getTarget());
    view.updateMatrixWorld(true);
    return new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(
        view.projectionMatrix,
        view.matrixWorldInverse
      )
    );
  };

  // Escritorio 1,6 y 2,2 (ultraancha) y retrato 390 × 844.
  it.each([
    ['desktop 1.6:1', 1.6],
    ['ultrawide 2.2:1', 2.2],
    ['portrait 390×844', 390 / 844],
  ])('no new piece falls in the %s frustum', (_name, aspect) => {
    const frustum = initialFrustum(aspect);
    const visible: string[] = [];
    for (const piece of newPieces) {
      for (const box of boxesOf(piece)) {
        if (frustum.intersectsBox(box)) visible.push(piece.id);
      }
    }
    expect(visible).toEqual([]);
  });

  it('the check does see the existing pieces (guard against a vacuous test)', () => {
    const frustum = initialFrustum(1.6);
    const seen = existingPieces.filter(piece =>
      boxesOf(piece).some(box => frustum.intersectsBox(box))
    );
    expect(seen.map(piece => piece.id)).toContain('bookshelf');
  });
});
