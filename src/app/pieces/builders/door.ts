import { BoxGeometry, CylinderGeometry } from 'three';
import type { PieceConfig } from '../pieces.config';
import { chamferBox, profileFrame, rectOutline } from './geometry';
import { BuildKit, Placer, brassMaterial, standard } from './kit';

/** Ancho de las jambas y del dintel (m). */
const CASING = 0.08;
const HEAD = 0.09;

/**
 * Puerta de paneles decorativa (spec A.2, D-421): cerco (dos jambas y dintel
 * achaflanados), hoja rehundida con cuatro paneles de moldura y manilla de
 * latón con roseta. Pintura crema propia (`doorPaint`, solo de esta pieza:
 * su malla fusionada es el `visual` del contorno).
 */
export function buildDoor(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'tvWall');
  const [width, height, depth] = config.size;
  kit.material('doorPaint', () => standard(0xe3d8c2, 0.55));
  brassMaterial(kit);
  kit.claim('door', 'tvWall', 'doorPaint');

  const jambH = height - HEAD;
  for (const sx of [-1, 1]) {
    placer.add(
      'doorPaint',
      new BoxGeometry(CASING, jambH, depth * 0.85),
      sx * (width / 2 - CASING / 2),
      jambH / 2,
      -depth * 0.075
    );
  }
  placer.add(
    'doorPaint',
    chamferBox(width, HEAD, depth, 0.01),
    0,
    height - HEAD / 2,
    0
  );

  // Hoja rehundida respecto al cerco.
  const leafW = width - 2 * CASING;
  const leafH = jambH;
  const leafDepth = 0.04;
  const leafZ = depth / 2 - 0.01 - leafDepth / 2;
  placer.add(
    'doorPaint',
    new BoxGeometry(leafW, leafH, leafDepth),
    0,
    leafH / 2,
    leafZ
  );

  // Cuatro paneles con moldura en relieve.
  const frontZ = leafZ + leafDepth / 2;
  const panelW = (leafW - 3 * 0.08) / 2;
  const panelH = (leafH - 3 * 0.12 - 0.1) / 2;
  const profile = [
    { inset: 0, z: 0 },
    { inset: 0.012, z: 0.008 },
    { inset: 0.03, z: 0.008 },
    { inset: 0.04, z: 0.002 },
  ];
  for (const column of [-1, 1]) {
    for (const row of [0, 1]) {
      const cx = column * (panelW / 2 + 0.04);
      const cy = 0.12 + panelH / 2 + row * (panelH + 0.12) + (row ? 0.05 : 0);
      placer.add(
        'doorPaint',
        profileFrame(rectOutline(panelW, panelH), profile),
        cx,
        cy,
        frontZ
      );
    }
  }

  // Manilla: roseta y palanca de latón, en el lado del centro de la sala.
  const handleX = leafW / 2 - 0.08;
  const handleY = 0.98;
  placer.add(
    'brass',
    new CylinderGeometry(0.026, 0.026, 0.012, 10).rotateX(Math.PI / 2),
    handleX,
    handleY,
    frontZ + 0.006
  );
  placer.add(
    'brass',
    new CylinderGeometry(0.008, 0.008, 0.05, 6).rotateX(Math.PI / 2),
    handleX,
    handleY,
    frontZ + 0.03
  );
  placer.add(
    'brass',
    new BoxGeometry(0.12, 0.016, 0.016),
    handleX - 0.05,
    handleY,
    frontZ + 0.052
  );
}
