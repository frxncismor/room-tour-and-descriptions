import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { PieceConfig } from '../pieces.config';
import { chamferBox, lathe, squareTaper } from './geometry';
import { BuildKit, Placer, standard, walnutMaterial } from './kit';

/** Nombres que usa el runtime de acciones. */
export const TURNTABLE_PLATTER = 'turntable:platter';
export const TURNTABLE_ARM = 'turntable:arm';

const PLATTER_RADIUS = 0.135;
/** Grosor del plinto de nogal. */
const PLINTH = 0.04;

function meshIn(
  kit: BuildKit,
  group: Group,
  name: string,
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  rotation?: Euler
): Mesh {
  kit.geometry(geometry);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  if (rotation) mesh.rotation.copy(rotation);
  mesh.receiveShadow = true;
  mesh.raycast = () => undefined;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  group.add(mesh);
  kit.meshes.push(mesh);
  return mesh;
}

/**
 * Tocadiscos (spec A.2, B.1): plinto de nogal con patas, plato (`Group`
 * `turntable:platter`: base, disco con surcos y etiqueta), brazo con pivote
 * (`Group` `turntable:arm`, gira sobre Y) y fundas de discos apoyadas al lado.
 * El plato y el brazo son los únicos con matriz animable.
 */
export function buildTurntable(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'music');
  const [width, , depth] = config.size;
  const base = config.position[1] - config.size[1] / 2;
  const walnut = walnutMaterial(kit);
  const metal = kit.material('turntable:metal', () =>
    standard(0xb9b4aa, 0.35, { metalness: 0.7 })
  );
  const vinyl = kit.material('turntable:vinyl', () =>
    standard(0x101012, 0.32, { metalness: 0.2 })
  );
  const label = kit.material('turntable:label', () => standard(0xb5694a, 0.7));
  kit.material('bookA', () => standard(0xd9c8a6, 0.8));
  kit.material('bookB', () => standard(0xa4553a, 0.8));

  // Plinto con la tapa achaflanada, sobre cuatro patas bajas.
  placer.mesh(
    'turntable:plinth',
    chamferBox(width, PLINTH, depth, 0.006),
    walnut,
    0,
    base + 0.005 + PLINTH / 2,
    0,
    { visual: true }
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      placer.add(
        'turntable:metal',
        squareTaper(0.024, 0.02, 0.01),
        sx * (width / 2 - 0.03),
        base + 0.005,
        sz * (depth / 2 - 0.03)
      );
    }
  }

  const deck = base + 0.005 + PLINTH;
  // Plato: grupo giratorio con tres mallas.
  const platter = new Group();
  platter.name = TURNTABLE_PLATTER;
  const platterX = -0.04;
  platter.position.copy(placer.pointAt(platterX, deck, 0));
  meshIn(
    kit,
    platter,
    'turntable:platter-base',
    lathe(
      [
        [0.001, 0],
        [PLATTER_RADIUS + 0.004, 0],
        [PLATTER_RADIUS + 0.004, 0.012],
        [0.001, 0.012],
      ],
      24
    ),
    metal,
    0,
    0,
    0
  );
  meshIn(
    kit,
    platter,
    'turntable:disc',
    lathe(
      [
        [0.001, 0.0145],
        [PLATTER_RADIUS - 0.006, 0.0145],
        [PLATTER_RADIUS - 0.003, 0.0132],
      ],
      24
    ),
    vinyl,
    0,
    0,
    0
  );
  meshIn(
    kit,
    platter,
    'turntable:label',
    lathe(
      [
        [0.001, 0.015],
        [0.04, 0.015],
      ],
      20
    ),
    label,
    0,
    0,
    0
  );
  kit.zones.music.add(platter);
  kit.named.set(TURNTABLE_PLATTER, platter);
  kit.entry(config.id, 'music').parts[TURNTABLE_PLATTER] = platter;

  // Brazo: pivote en la esquina trasera, tubo con codo y cabezal.
  // La raíz lleva el giro de la pieza; el brazo (hijo) parte de rotación 0 y
  // gira sobre su pivote cuando el runtime lo apoya en el disco.
  const armRoot = new Group();
  armRoot.name = `${TURNTABLE_ARM}-root`;
  armRoot.position.copy(
    placer.pointAt(width / 2 - 0.045, deck, -depth / 2 + 0.05)
  );
  armRoot.rotation.y = config.rotationY;
  const arm = new Group();
  arm.name = TURNTABLE_ARM;
  armRoot.add(arm);
  meshIn(
    kit,
    arm,
    'turntable:arm-pivot',
    new CylinderGeometry(0.02, 0.024, 0.026, 10),
    metal,
    0,
    0.013,
    0
  );
  meshIn(
    kit,
    arm,
    'turntable:arm-tube',
    new CylinderGeometry(0.004, 0.004, 0.22, 6).rotateX(Math.PI / 2),
    metal,
    0,
    0.034,
    0.11
  );
  meshIn(
    kit,
    arm,
    'turntable:arm-head',
    new BoxGeometry(0.016, 0.01, 0.034),
    metal,
    0,
    0.03,
    0.23
  );
  kit.zones.music.add(armRoot);
  kit.named.set(TURNTABLE_ARM, arm);
  kit.entry(config.id, 'music').parts[TURNTABLE_ARM] = arm;

  // Fundas de discos apoyadas contra la pared, a la derecha del plinto.
  const sleeves: [string, number][] = [
    ['bookB', 0],
    ['bookA', 1],
    ['bookB', 2],
    ['bookA', 3],
    ['bookB', 4],
  ];
  const sleeveX = width / 2 + 0.1;
  const tilt = new Euler(-0.18, 0, 0);
  for (const [material, i] of sleeves) {
    placer.add(
      material,
      new BoxGeometry(0.006, 0.31, 0.31),
      sleeveX + i * 0.02,
      deck - PLINTH + 0.16,
      -0.08,
      tilt
    );
  }
}
