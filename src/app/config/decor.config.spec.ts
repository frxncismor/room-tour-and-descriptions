import { DECOR3, DECOR3_LOAD_KEYS } from './decor.config';

describe('DECOR3', () => {
  it('tiene todas las piezas de la spec', () => {
    expect(DECOR3.artworks).toHaveLength(4);
    expect(DECOR3.sconces.positions).toHaveLength(2);
    expect(DECOR3.window.glassWidth).toBeGreaterThan(0);
    expect(DECOR3.curtains.panelZ).toHaveLength(2);
    expect(DECOR3.floorLamp.rodTop).toBeGreaterThan(0);
    expect(DECOR3.textiles.cushions).toHaveLength(2);
    expect(DECOR3.textiles.throw.width).toBeGreaterThan(0);
  });

  it('centra las láminas en el eje 1,60 ± 0,02 y los apliques a 1,70', () => {
    for (const art of DECOR3.artworks) {
      expect(Math.abs(art.position.y - 1.6)).toBeLessThanOrEqual(0.02);
    }
    for (const sconce of DECOR3.sconces.positions) {
      expect(sconce.y).toBeCloseTo(1.7, 5);
    }
  });

  it('no pone ninguna lámina en la pared frontal ni fuera de |x| ≤ 8', () => {
    for (const art of DECOR3.artworks) {
      expect(art.position.z).not.toBe(8);
      expect(Math.abs(art.position.x)).toBeLessThanOrEqual(8);
      expect(Math.abs(art.position.z)).toBeLessThanOrEqual(8);
    }
  });

  it('usa un marco único coherente: exterior = obra + paspartú + moldura', () => {
    const { width, height, border, mat } = DECOR3.frame;
    expect(width - 2 * (border + mat)).toBeCloseTo(0.5, 5);
    expect(height - 2 * (border + mat)).toBeCloseTo(0.7, 5);
  });

  it('el díptico deja 0,14 m entre marcos y A/B son simétricas respecto a x = 0', () => {
    const [a, b, c, d] = DECOR3.artworks;
    expect(a.position.x).toBeCloseTo(-b.position.x, 5);
    const gap = Math.abs(d.position.z - c.position.z) - DECOR3.frame.width;
    expect(gap).toBeCloseTo(0.14, 5);
  });

  it('los apliques son simétricos respecto a x = 0', () => {
    const [l, r] = DECOR3.sconces.positions;
    expect(l.x).toBeCloseTo(-r.x, 5);
  });

  it('lista las claves de carga art:* y fabric:* con ruta en assets/textures', () => {
    expect([...DECOR3_LOAD_KEYS].sort()).toEqual([
      'art:felce',
      'art:osmunda',
      'art:pteris',
      'art:spiraea',
      'fabric:linen',
      'fabric:linen-nor',
    ]);
    for (const key of DECOR3_LOAD_KEYS) {
      const dir = key.startsWith('art:') ? 'art' : 'fabric';
      expect(DECOR3.textures[key]).toMatch(
        new RegExp(`^assets/textures/${dir}/[a-z-]+\\.webp$`)
      );
    }
  });

  it('cada lámina referencia una clave de textura existente', () => {
    for (const art of DECOR3.artworks) {
      expect(DECOR3_LOAD_KEYS).toContain(`art:${art.art}`);
    }
  });
});
