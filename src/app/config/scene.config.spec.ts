import { Box3, Vector3 } from 'three';
import {
  DECOR_CONFIGURATIONS,
  DEFAULT_SCENE_CONFIG,
  FLOOR_TEXTURES,
  MODEL_CONFIGURATIONS,
  RUG_TEXTURES,
  TRIM,
} from './scene.config';

describe('scene config (T-231)', () => {
  it('keeps decor and interactive pieces in separate maps', () => {
    const decor = Object.keys(DECOR_CONFIGURATIONS);
    const models = Object.keys(MODEL_CONFIGURATIONS);
    expect(decor.sort()).toEqual(['clock', 'vase']);
    expect(models.sort()).toEqual([
      'bookshelf',
      'landscapePainting',
      'pokerTable',
      'sofa',
      'succulent',
    ]);
    expect(decor.filter(id => models.includes(id))).toEqual([]);
  });

  it('decor pieces have no metadata (they are not inspectable)', () => {
    for (const config of Object.values(DECOR_CONFIGURATIONS)) {
      expect('metadata' in config).toBe(false);
      expect(config.path).toMatch(/^assets\/models\/\w+\/scene\.gltf$/);
    }
  });

  it('small decor pieces do not cast shadows (SC-204 frame time)', () => {
    expect(MODEL_CONFIGURATIONS.succulent.castShadow).toBe(false);
    expect(MODEL_CONFIGURATIONS.landscapePainting.castShadow).toBe(false);
    expect(DECOR_CONFIGURATIONS.vase.castShadow).toBe(false);
    expect(DECOR_CONFIGURATIONS.clock.castShadow).toBe(false);
  });

  it('every interactive piece carries only its id', () => {
    for (const [id, config] of Object.entries(MODEL_CONFIGURATIONS)) {
      expect(config.metadata).toEqual({ id });
    }
  });

  it('declares the texture sets and the trim', () => {
    expect(FLOOR_TEXTURES.diffuse).toBe('assets/textures/floor/diff.webp');
    expect(FLOOR_TEXTURES.normal).toBe('assets/textures/floor/nor.webp');
    expect(FLOOR_TEXTURES.arm).toBe('assets/textures/floor/arm.webp');
    expect(RUG_TEXTURES.diffuse).toBe('assets/textures/rug/diff.webp');
    expect(RUG_TEXTURES.normal).toBe('assets/textures/rug/nor.webp');
    expect(TRIM).toMatchObject({ height: 0.12, depth: 0.02, color: 0xf3ece1 });
  });
});

describe('warm lighting and 1.60 m axis (T-331)', () => {
  const { lighting, renderer, room } = DEFAULT_SCENE_CONFIG;

  it('has one point light, a hemisphere light and neutral tone mapping', () => {
    expect(lighting.point).toHaveLength(1);
    expect(lighting.hemisphere.intensity).toBeGreaterThan(0);
    expect(renderer.toneMapping).toBe('neutral');
    expect(renderer.exposure).toBeGreaterThanOrEqual(0.95);
    expect(renderer.exposure).toBeLessThanOrEqual(1.15);
  });

  it('only the sun casts shadows', () => {
    expect(lighting.directional.castShadow).toBe(true);
    expect(lighting.spotlights.some(s => s.castShadow)).toBe(false);
    expect(lighting.point.some(p => p.castShadow)).toBe(false);
  });

  it('uses warm colours (no pure white accent spots)', () => {
    for (const spot of lighting.spotlights) {
      expect(spot.color).not.toBe(0xffffff);
    }
    expect(room.colors.ceiling).toBe(0xf1e2cf);
    expect(RUG_TEXTURES.tint).toBe(0xffd9b3);
  });

  it('painting and clock are centred at 1.60 m (±0.02)', () => {
    const p = MODEL_CONFIGURATIONS.landscapePainting;
    const c = DECOR_CONFIGURATIONS.clock;
    expect(p.yOffset + SIZES['landscapePainting'].h / 2).toBeCloseTo(1.6, 1);
    expect(
      Math.abs(p.yOffset + SIZES['landscapePainting'].h / 2 - 1.6)
    ).toBeLessThanOrEqual(0.02);
    expect(
      Math.abs(c.yOffset + SIZES['clock'].h / 2 - 1.6)
    ).toBeLessThanOrEqual(0.02);
  });
});

/**
 * Medidas finales (m) de spec A.1 (ancho X, fondo Z, alto Y), ya con la escala
 * aplicada. T-250 las contrasta con las reales de T-214.
 */
const SIZES: Record<string, { w: number; d: number; h: number }> = {
  sofa: { w: 3.6, d: 1, h: 0.95 },
  pokerTable: { w: 1.33, d: 1.33, h: 0.95 },
  bookshelf: { w: 1.37, d: 0.58, h: 2.06 },
  landscapePainting: { w: 1.21, d: 0.04, h: 0.93 },
  clock: { w: 0.64, d: 0.06, h: 0.64 },
  succulent: { w: 0.37, d: 0.41, h: 0.59 },
  vase: { w: 0.48, d: 0.48, h: 0.68 },
};

/** Caja de una pieza: `position` es el centro X/Z y `yOffset` la altura de la base. */
function boxOf(
  id: string,
  position: Vector3,
  yOffset = 0,
  rotationY = 0
): Box3 {
  const { w, d, h } = SIZES[id];
  // AABB de una caja girada alrededor de Y.
  const c = Math.abs(Math.cos(rotationY));
  const s = Math.abs(Math.sin(rotationY));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  return new Box3(
    new Vector3(position.x - hx, yOffset, position.z - hz),
    new Vector3(position.x + hx, yOffset + h, position.z + hz)
  );
}

describe('placement (SC-203, T-236)', () => {
  const wallZ = DEFAULT_SCENE_CONFIG.room.limits.minZ;
  const CLEARANCE = 0.25;

  const furniture: Record<string, Box3> = {};
  const wall: Record<string, Box3> = {};
  const floorDecor: Record<string, Box3> = {};
  for (const id of ['sofa', 'pokerTable', 'bookshelf'] as const) {
    const c = MODEL_CONFIGURATIONS[id];
    furniture[id] = boxOf(id, c.position, c.yOffset, c.rotation.y);
  }
  {
    const p = MODEL_CONFIGURATIONS.landscapePainting;
    wall['landscapePainting'] = boxOf(
      'landscapePainting',
      p.position,
      p.yOffset,
      p.rotation.y
    );
    const s = MODEL_CONFIGURATIONS.succulent;
    floorDecor['succulent'] = boxOf(
      'succulent',
      s.position,
      s.yOffset,
      s.rotation.y
    );
    const c = DECOR_CONFIGURATIONS.clock;
    wall['clock'] = boxOf('clock', c.position, c.yOffset, c.rotation.y);
    const v = DECOR_CONFIGURATIONS.vase;
    floorDecor['vase'] = boxOf('vase', v.position, v.yOffset, v.rotation.y);
  }
  const pieces: Record<string, Box3> = { ...wall, ...floorDecor };

  const apart = (a: Box3, b: Box3, gap = 0) =>
    !a
      .clone()
      .expandByScalar(gap / 2)
      .intersectsBox(b.clone().expandByScalar(gap / 2));

  it('no new piece touches a piece of furniture or another new piece', () => {
    const entries = Object.entries(pieces);
    for (const [id, box] of entries) {
      for (const [other, otherBox] of Object.entries(furniture)) {
        expect(apart(box, otherBox), `${id} vs ${other}`).toBe(true);
      }
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        expect(
          apart(entries[i][1], entries[j][1]),
          `${entries[i][0]} vs ${entries[j][0]}`
        ).toBe(true);
      }
    }
  });

  it('floor pieces keep a visible clearance from furniture and the shelf is flanked', () => {
    for (const [id, box] of Object.entries(floorDecor)) {
      for (const [other, otherBox] of Object.entries(furniture)) {
        expect(apart(box, otherBox, CLEARANCE), `${id} vs ${other}`).toBe(true);
      }
    }
    expect(floorDecor['vase'].max.x).toBeLessThan(furniture['bookshelf'].min.x);
    expect(floorDecor['succulent'].min.x).toBeGreaterThan(
      furniture['bookshelf'].max.x
    );
  });

  it('floor pieces stand on y = 0 (±0.02) and inside the room', () => {
    const { minX, maxX, minZ, maxZ } = DEFAULT_SCENE_CONFIG.room.limits;
    for (const [id, box] of Object.entries(floorDecor)) {
      expect(Math.abs(box.min.y), id).toBeLessThanOrEqual(0.02);
      expect(box.min.x).toBeGreaterThanOrEqual(minX);
      expect(box.max.x).toBeLessThanOrEqual(maxX);
      expect(box.min.z).toBeGreaterThanOrEqual(minZ);
      expect(box.max.z).toBeLessThanOrEqual(maxZ);
    }
  });

  it('painting and clock hang 0.02–0.06 m from the back wall without crossing it', () => {
    for (const [id, box] of Object.entries(wall)) {
      const centre = (box.min.z + box.max.z) / 2;
      expect(centre - wallZ, id).toBeGreaterThanOrEqual(0.02);
      expect(centre - wallZ, id).toBeLessThanOrEqual(0.06);
      expect(box.min.z, id).toBeGreaterThanOrEqual(wallZ);
      // Colgados: la base queda por encima de los muebles y bajo el techo.
      expect(box.min.y, id).toBeGreaterThan(1);
      expect(box.max.y, id).toBeLessThan(DEFAULT_SCENE_CONFIG.room.height);
    }
  });

  it('the rug lies on the floor under the sofa and stays out of the table', () => {
    const { width, depth, center, y, rotationY } = RUG_TEXTURES;
    const c = Math.abs(Math.cos(rotationY));
    const s = Math.abs(Math.sin(rotationY));
    const hx = (width * c + depth * s) / 2;
    const hz = (width * s + depth * c) / 2;
    const rug = new Box3(
      new Vector3(center.x - hx, y, center.y - hz),
      new Vector3(center.x + hx, y, center.y + hz)
    );
    expect(rug.min.y).toBeLessThanOrEqual(0.01);
    expect(rug.intersectsBox(furniture['pokerTable'])).toBe(false);
    expect(rug.intersectsBox(furniture['sofa'])).toBe(true);
    const { minX, maxX, minZ, maxZ } = DEFAULT_SCENE_CONFIG.room.limits;
    expect(rug.min.x).toBeGreaterThanOrEqual(minX);
    expect(rug.max.x).toBeLessThanOrEqual(maxX);
    expect(rug.min.z).toBeGreaterThanOrEqual(minZ);
    expect(rug.max.z).toBeLessThanOrEqual(maxZ);
  });
});
