import {
  CylinderGeometry,
  DoubleSide,
  Euler,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import type { PieceId } from '../piece-ids';
import type { PieceConfig } from '../pieces.config';
import { lathe } from './geometry';
import { BuildKit, PALETTE, Placer, brassMaterial, standard } from './kit';

/** Color cálido del halo y del charco de las lámparas. */
const LIGHT_COLOR = 0xffd9a0;

/** Pantalla con material propio, apagada (`emissiveIntensity` 0). */
function shadeMaterial(
  kit: BuildKit,
  id: PieceId,
  color: number
): MeshStandardMaterial {
  return kit.material(`${id}:shade`, () =>
    standard(color, 0.7, {
      side: DoubleSide,
      emissive: 0xffe2b0,
      emissiveIntensity: 0,
    })
  );
}

interface GlowSpec {
  x: number;
  y: number;
  z: number;
  size: number;
  rotationY?: number;
}

/**
 * Halo vertical (pared) y charco horizontal (mesa o suelo), aditivos, en
 * mallas y materiales propios `<id>:halo` y `<id>:pool`. Ocultos y con
 * opacidad 0: el runtime los enciende.
 */
function addGlows(
  kit: BuildKit,
  placer: Placer,
  id: PieceId,
  halo: GlowSpec,
  pool: GlowSpec
): void {
  placer.mesh(
    `${id}:halo`,
    new PlaneGeometry(halo.size, halo.size),
    kit.glowMaterial(`${id}:halo`, LIGHT_COLOR, 0),
    halo.x,
    halo.y,
    halo.z,
    { rotation: new Euler(0, halo.rotationY ?? 0, 0) }
  ).visible = false;
  placer.mesh(
    `${id}:pool`,
    new PlaneGeometry(pool.size, pool.size).rotateX(-Math.PI / 2),
    kit.glowMaterial(`${id}:pool`, LIGHT_COLOR, 0),
    pool.x,
    pool.y,
    pool.z
  ).visible = false;
}

/** Varilla cilíndrica entre dos puntos del plano YZ (brazos del flexo). */
function addRod(
  placer: Placer,
  from: Vector3,
  to: Vector3,
  radius: number
): void {
  const length = from.distanceTo(to);
  const middle = from.clone().add(to).multiplyScalar(0.5);
  const tilt = Math.atan2(to.z - from.z, to.y - from.y);
  placer.add(
    'brass',
    new CylinderGeometry(radius, radius, length, 6, 1),
    0,
    middle.y,
    middle.z,
    new Euler(tilt, 0, 0)
  );
}

/**
 * Flexo de cúpula (spec A.2): peana de latón torneada, brazo articulado de dos
 * tramos y pantalla de cúpula. Pantalla, halo (pared) y charco (mesa) son
 * mallas propias: `deskLamp:shade`, `deskLamp:halo`, `deskLamp:pool`.
 */
export function buildDeskLamp(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'work');
  const bottom = config.position[1] - config.size[1] / 2;
  brassMaterial(kit);
  placer.add(
    'brass',
    lathe(
      [
        [0.001, 0],
        [0.08, 0],
        [0.07, 0.014],
        [0.03, 0.02],
        [0.012, 0.03],
      ],
      10
    ),
    0,
    bottom,
    -0.09
  );
  const base = new Vector3(0, bottom + 0.03, -0.09);
  const joint = new Vector3(0, bottom + 0.3, -0.04);
  const head = new Vector3(0, bottom + 0.5, 0.02);
  addRod(placer, base, joint, 0.007);
  addRod(placer, joint, head, 0.007);
  placer.add(
    'brass',
    new CylinderGeometry(0.016, 0.016, 0.03, 8).rotateZ(Math.PI / 2),
    0,
    joint.y,
    joint.z
  );
  // Cúpula: casquete abierto por abajo, de ancho el de la caja de A.2.
  const domeRadius = config.size[0] / 2;
  const domeProfile: [number, number][] = [];
  for (let i = 4; i >= 0; i--) {
    const angle = (i / 4) * (Math.PI / 2) * 0.95;
    domeProfile.push([
      Math.max(domeRadius * Math.cos(angle), 0.001),
      0.15 * Math.sin(angle) * 1.05,
    ]);
  }
  placer.mesh(
    'deskLamp:shade',
    lathe(domeProfile, 12),
    shadeMaterial(kit, 'deskLamp', PALETTE.cream),
    0,
    bottom + 0.4,
    0.02
  );
  addGlows(
    kit,
    placer,
    'deskLamp',
    { x: 0, y: bottom + 0.55, z: -0.47, size: 1.5 },
    { x: 0, y: bottom + 0.003, z: 0.1, size: 0.8 }
  );
}

/**
 * Lámpara de lectura (spec A.2): pie de cerámica torneado, cuello de latón y
 * pantalla de tambor. `readingLamp:shade|halo|pool`; el charco cae sobre el
 * suelo (la alfombra del rincón) y el halo sobre la pared de la ventana.
 */
export function buildReadingLamp(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'reading');
  const bottom = config.position[1] - config.size[1] / 2;
  brassMaterial(kit);
  kit.material('ceramicCream', () => standard(0xd7cdb8, 0.45));
  placer.add(
    'ceramicCream',
    lathe(
      [
        [0.001, 0],
        [0.06, 0],
        [0.085, 0.1],
        [0.07, 0.19],
        [0.03, 0.26],
        [0.018, 0.3],
        [0.001, 0.3],
      ],
      12
    ),
    0,
    bottom,
    0
  );
  placer.add(
    'brass',
    new CylinderGeometry(0.008, 0.008, 0.08, 6),
    0,
    bottom + 0.34,
    0
  );
  placer.mesh(
    'readingLamp:shade',
    new CylinderGeometry(0.12, 0.15, 0.22, 16, 1, true),
    shadeMaterial(kit, 'readingLamp', PALETTE.cream),
    0,
    bottom + 0.44,
    0
  );
  addGlows(
    kit,
    placer,
    'readingLamp',
    { x: -1.43, y: 1.5, z: 0, size: 1.9, rotationY: Math.PI / 2 },
    { x: 0, y: 0.006, z: 0, size: 1.7 }
  );
}

/**
 * Halo y charco de la lámpara de pie (existente, de la decoración): el
 * runtime los enciende junto a su `PointLight`. Nacen ocultos y a 0.
 */
export function buildFloorLampGlow(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'music');
  addGlows(
    kit,
    placer,
    'floorLamp',
    { x: -0.78, y: 1.7, z: 0, size: 2.2, rotationY: Math.PI / 2 },
    { x: 0, y: 0.006, z: 0, size: 1.6 }
  );
}
