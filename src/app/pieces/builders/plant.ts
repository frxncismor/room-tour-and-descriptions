import {
  BufferGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import type { PieceConfig } from '../pieces.config';
import { lathe } from './geometry';
import { BuildKit, PALETTE, Placer, standard } from './kit';

/** Hojas del ficus (spec A.2: 24). */
export const FICUS_LEAVES = 24;

/**
 * Qué se construye en la planta: el ficus procedural o, si no da la calidad
 * en las capturas (puerta de D-417), un jarrón con ramas secas.
 */
export const PLANT_STYLE: 'ficus' | 'vase' = 'ficus';

const POT_HEIGHT = 0.4;

/** Textura de hoja 32×64: verde profundo, nervio claro y venas finas. */
export function leafTexture(width = 32, height = 64): DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1) - 0.5;
      const v = y / (height - 1);
      const rib = Math.exp(-(u * u) / 0.0009);
      // Venas laterales oblicuas desde el nervio.
      const vein =
        Math.max(0, Math.cos((Math.abs(u) * 20 - v * 14) * Math.PI)) ** 8 * 0.5;
      const shade = 0.85 + 0.15 * (1 - v);
      const i = (y * width + x) * 4;
      const k = Math.min(1, 0.6 * shade + 0.55 * rib + 0.12 * vein);
      data[i] = Math.round(92 * k + 12);
      data[i + 1] = Math.round(138 * k + 16);
      data[i + 2] = Math.round(84 * k + 10);
      data[i + 3] = 255;
    }
  }
  const texture = new DataTexture(
    data,
    width,
    height,
    RGBAFormat,
    UnsignedByteType
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Hoja curva y puntiaguda: 5 tramos × 2 mitades (con nervio central hundido). */
export function leafGeometry(length: number, width: number): BufferGeometry {
  const rows = 5;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    // Contorno ovalado que acaba en punta, con la base algo estrecha.
    const half = (width / 2) * Math.sin(Math.PI * t ** 0.8) ** 0.85;
    // Caída hacia la punta y pliegue del nervio.
    const droop = -0.22 * length * t * t;
    const crease = 0.1 * half;
    for (const s of [-1, 0, 1]) {
      // El nervio central queda más bajo que los bordes.
      positions.push(s * half, droop + (s === 0 ? -crease : 0), t * length);
      uvs.push(0.5 + s * 0.5, t);
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < 2; c++) {
      const a = r * 3 + c;
      const b = a + 1;
      const d = a + 3;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Ficus de hoja grande: maceta torneada con borde, tierra, tronco fino algo
 * curvado y 24 hojas curvas dispuestas en espiral (ángulo áureo) que se
 * acortan hacia la copa. Materiales propios (`plantPot`, `bark`, `leaf`): sus
 * mallas fusionadas son los `visuals` de la pieza.
 */
export function buildPlant(kit: BuildKit, config: PieceConfig): void {
  if (PLANT_STYLE === 'vase') {
    buildBranchVase(kit, config);
    return;
  }
  const placer = new Placer(kit, config, 'tvWall');
  const [width, height] = config.size;
  const maxReach = width / 2;
  kit.material('plantPot', () => standard(0xc9bba3, 0.8));
  kit.material('bark', () => standard(0x4e3f31, 0.9));
  kit.material('leaf', () =>
    standard(0xffffff, 0.55, {
      map: kit.own(leafTexture()),
      side: DoubleSide,
      color: PALETTE.leaf === 0x4d7048 ? 0xc4dcc0 : 0xffffff,
    })
  );
  for (const material of ['plantPot', 'bark', 'leaf']) {
    kit.claim('plantFicus', 'tvWall', material);
  }

  placer.add(
    'plantPot',
    lathe(
      [
        [0.001, 0],
        [0.13, 0],
        [0.15, 0.03],
        [0.2, POT_HEIGHT - 0.06],
        [0.215, POT_HEIGHT - 0.03],
        [0.215, POT_HEIGHT],
        [0.195, POT_HEIGHT],
        [0.195, POT_HEIGHT - 0.04],
        [0.001, POT_HEIGHT - 0.04],
      ],
      14
    ),
    0,
    0,
    0
  );
  // Tronco: dos tramos con un quiebro suave.
  const trunkTop = height - 0.2;
  const lower = new CylinderGeometry(
    0.014,
    0.022,
    (trunkTop - POT_HEIGHT) * 0.55,
    6
  );
  placer.add(
    'bark',
    lower,
    0,
    POT_HEIGHT + (trunkTop - POT_HEIGHT) * 0.275,
    0,
    new Euler(0.03, 0, -0.03)
  );
  const upper = new CylinderGeometry(
    0.008,
    0.014,
    (trunkTop - POT_HEIGHT) * 0.5,
    6
  );
  placer.add(
    'bark',
    upper,
    -0.01,
    POT_HEIGHT + (trunkTop - POT_HEIGHT) * 0.74,
    0.01,
    new Euler(-0.04, 0, 0.05)
  );

  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < FICUS_LEAVES; i++) {
    const t = i / (FICUS_LEAVES - 1);
    const baseY = POT_HEIGHT + 0.12 + (trunkTop - POT_HEIGHT - 0.1) * t ** 0.95;
    const length = 0.4 - 0.14 * t;
    const leafWidth = length * 0.55;
    // Más abiertas abajo, más erguidas arriba; que no pasen del radio de A.2.
    const pitch = 1.05 - 0.55 * t;
    const reach = Math.min(length * Math.sin(pitch), maxReach - 0.03);
    const adjust = Math.asin(Math.min(1, reach / length));
    const yaw = i * golden;
    // La hoja crece hacia +Z local: se inclina `adjust` sobre la horizontal.
    placer.add(
      'leaf',
      leafGeometry(length, leafWidth),
      0.015 * Math.sin(yaw),
      baseY,
      0.015 * Math.cos(yaw),
      new Euler(-(Math.PI / 2 - adjust), yaw, 0, 'YXZ')
    );
  }
}

/** Alternativa: jarrón de cerámica con ramas secas (clon visual de `vase`). */
function buildBranchVase(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'tvWall');
  const [, height] = config.size;
  kit.material('plantPot', () => standard(0xc9bba3, 0.6));
  kit.material('bark', () => standard(0x4e3f31, 0.9));
  kit.claim('plantFicus', 'tvWall', 'plantPot');
  kit.claim('plantFicus', 'tvWall', 'bark');
  placer.add(
    'plantPot',
    lathe(
      [
        [0.001, 0],
        [0.12, 0],
        [0.2, 0.25],
        [0.14, 0.5],
        [0.07, 0.62],
        [0.08, 0.66],
      ],
      16
    ),
    0,
    0,
    0
  );
  for (let i = 0; i < 7; i++) {
    const yaw = i * 0.9;
    placer.add(
      'bark',
      new CylinderGeometry(0.004, 0.009, height - 0.55, 5),
      0.05 * Math.sin(yaw),
      0.62 + (height - 0.55) / 2,
      0.05 * Math.cos(yaw),
      new Euler(0.12 * Math.cos(yaw), 0, -0.12 * Math.sin(yaw))
    );
  }
}
