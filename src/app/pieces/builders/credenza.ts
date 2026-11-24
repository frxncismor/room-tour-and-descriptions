import { Box3, CylinderGeometry, Euler, Object3D, Vector3 } from 'three';
import type { PieceConfig } from '../pieces.config';
import { chamferBox, squareTaper } from './geometry';
import {
  BuildKit,
  Placer,
  brassMaterial,
  standard,
  walnutMaterial,
} from './kit';

/** Estrías de las puertas (spec A.2: 22). */
export const CREDENZA_FLUTES = 22;

const LEG_HEIGHT = 0.2;
const CARCASS_HEIGHT = 0.4;
const TOP_THICKNESS = 0.04;
/** Altura del jarrón clonado sobre el aparador (la caja de A.2 llega a 0,90 m). */
const VASE_HEIGHT = 0.26;

/** Libros de la izquierda: [material, ancho, alto, fondo, x, giro]. */
const BOOKS: readonly (readonly [
  string,
  number,
  number,
  number,
  number,
  number,
])[] = [
  ['bookA', 0.27, 0.034, 0.19, -0.66, 0.05],
  ['bookC', 0.25, 0.04, 0.18, -0.65, -0.04],
  ['bookB', 0.23, 0.03, 0.17, -0.66, 0.08],
  ['bookA', 0.2, 0.028, 0.15, -0.66, -0.06],
  ['bookB', 0.04, 0.2, 0.15, -0.36, 0],
  ['bookA', 0.035, 0.19, 0.14, -0.32, 0],
  ['bookC', 0.04, 0.21, 0.15, -0.28, 0],
];

/**
 * Aparador de nogal (spec A.2): tapa y cuerpo achaflanados, 22 estrías
 * redondeadas sobre el fondo de las puertas, patas cónicas con contera de
 * latón, libros y un clon del jarrón de la sala. Todo en la zona `tvWall`.
 */
export function buildCredenza(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'tvWall');
  const [width, , depth] = config.size;
  walnutMaterial(kit);
  brassMaterial(kit);
  kit.material('walnutDark', () => standard(0x3a2b21, 0.7));
  const bookColors: Record<string, number> = {
    bookA: 0xd9c8a6,
    bookB: 0xa4553a,
    bookC: 0x3f6b6a,
  };
  for (const [key, color] of Object.entries(bookColors)) {
    kit.material(key, () => standard(color, 0.8));
  }

  const carcassBottom = LEG_HEIGHT;
  const carcassTop = carcassBottom + CARCASS_HEIGHT;
  const topY = carcassTop + TOP_THICKNESS / 2;
  placer.add(
    'walnut',
    chamferBox(width, TOP_THICKNESS, depth, 0.008),
    0,
    topY,
    0
  );
  placer.add(
    'walnut',
    chamferBox(width - 0.08, CARCASS_HEIGHT, depth - 0.04, 0.006),
    0,
    carcassBottom + CARCASS_HEIGHT / 2,
    -0.005
  );

  // Fondo oscuro entre estrías y dos montantes que separan las tres puertas.
  const frontZ = (depth - 0.04) / 2 - 0.005;
  const span = width - 0.14;
  placer.add(
    'walnutDark',
    chamferBox(span, CARCASS_HEIGHT - 0.06, 0.006, 0.002),
    0,
    carcassBottom + CARCASS_HEIGHT / 2,
    frontZ - 0.012
  );
  for (const x of [-span / 6, span / 6]) {
    placer.add(
      'walnut',
      chamferBox(0.018, CARCASS_HEIGHT - 0.04, 0.02, 0.004),
      x,
      carcassBottom + CARCASS_HEIGHT / 2,
      frontZ - 0.002
    );
  }
  const pitch = span / CREDENZA_FLUTES;
  const radius = pitch * 0.46;
  for (let i = 0; i < CREDENZA_FLUTES; i++) {
    const x = -span / 2 + pitch * (i + 0.5);
    // Las estrías de los montantes quedan tapadas: se saltan.
    if (Math.abs(Math.abs(x) - span / 6) < pitch * 0.5) continue;
    placer.add(
      'walnut',
      new CylinderGeometry(radius, radius, CARCASS_HEIGHT - 0.07, 5, 1, true),
      x,
      carcassBottom + CARCASS_HEIGHT / 2,
      frontZ - 0.012,
      new Euler(0, Math.PI / 2, 0)
    );
  }

  // Patas cónicas con contera.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (width / 2 - 0.1);
      const z = sz * (depth / 2 - 0.09);
      placer.add(
        'walnut',
        squareTaper(0.055, 0.032, LEG_HEIGHT),
        x,
        LEG_HEIGHT / 2,
        z
      );
      placer.add(
        'brass',
        new CylinderGeometry(0.018, 0.017, 0.012, 8),
        x,
        0.006,
        z
      );
    }
  }

  // Libros sobre la tapa.
  const topSurface = carcassTop + TOP_THICKNESS;
  let stackY = topSurface;
  let lastX = Number.NaN;
  for (const [material, w, h, d, x, turn] of BOOKS) {
    if (x !== lastX) {
      lastX = x;
      stackY = topSurface;
    }
    if (h > 0.1) {
      // Libros de pie, apoyados en vertical.
      placer.add(
        material,
        chamferBox(w, h, d, 0.003),
        x,
        topSurface + h / 2,
        0.02
      );
      continue;
    }
    placer.add(
      material,
      chamferBox(w, h, d, 0.003),
      x,
      stackY + h / 2,
      0.0,
      new Euler(0, turn, 0)
    );
    stackY += h;
  }

  cloneVase(kit, placer, topSurface);
}

/** Clon del jarrón de la sala sobre el aparador (comparte geometría y material). */
function cloneVase(kit: BuildKit, placer: Placer, surfaceY: number): void {
  if (!kit.vase) return;
  const clone = kit.vase.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.setScalar(1);
  clone.updateMatrixWorld(true);
  const natural = new Box3().setFromObject(clone);
  const size = natural.getSize(new Vector3());
  if (size.y <= 0) return;
  const scale = VASE_HEIGHT / size.y;
  clone.scale.setScalar(scale);
  clone.updateMatrixWorld(true);
  const box = new Box3().setFromObject(clone);
  const center = box.getCenter(new Vector3());
  const anchor = new Vector3().setFromMatrixPosition(
    placer.matrix(0.68, surfaceY, 0.02)
  );
  clone.position.set(
    anchor.x - center.x,
    anchor.y - box.min.y,
    anchor.z - center.z
  );
  clone.name = 'credenza:vase';
  clone.traverse((object: Object3D) => {
    object.raycast = () => undefined;
  });
  clone.updateMatrixWorld(true);
  kit.zones.tvWall.add(clone);
  placer.part('credenza:vase', clone);
}
