import { Euler, Vector3 } from 'three';

/**
 * Piezas procedurales de la decoración (spec 003, A.2 y B.3). Única fuente de
 * posiciones, medidas, colores e intensidades: el builder no lleva números.
 * Sistema de coordenadas de la sala: x, z ∈ [-8, 8], Y arriba.
 * Rotación Y: pared del fondo 0; derecha (x = +8) -π/2; izquierda (x = -8) +π/2.
 */

export type ArtId = 'spiraea' | 'felce' | 'osmunda' | 'pteris';
export type FabricId = 'linen' | 'linen-nor';

export interface DecorFrameConfig {
  /** Medidas exteriores del marco. */
  width: number;
  height: number;
  depth: number;
  /** Ancho de la moldura. */
  border: number;
  /** Ancho del paspartú (entre moldura y obra). */
  mat: number;
  frameColor: number;
  frameRoughness: number;
  matColor: number;
}

export interface DecorArtworkConfig {
  id: string;
  art: ArtId;
  /** Centro de la pieza. */
  position: Vector3;
  rotationY: number;
}

export interface DecorBrassConfig {
  color: number;
  metalness: number;
  roughness: number;
}

export interface DecorSconcesConfig {
  /** Centro de la placa de cada aplique. */
  positions: Vector3[];
  plateRadius: number;
  plateDepth: number;
  armLength: number;
  armRadius: number;
  shade: {
    radiusTop: number;
    radiusBottom: number;
    height: number;
    color: number;
    emissive: number;
    emissiveIntensity: number;
  };
  halo: {
    /** Desplazamiento del halo respecto a la placa. */
    offset: Vector3;
    diameter: number;
    color: number;
    opacity: number;
  };
}

export interface DecorWindowConfig {
  /** Centro del cristal. */
  position: Vector3;
  rotationY: number;
  glassWidth: number;
  glassHeight: number;
  /** Degradado de atardecer, de abajo a arriba. */
  glassFrom: number;
  glassTo: number;
  frame: {
    depth: number;
    bar: number;
    mullion: number;
    color: number;
    roughness: number;
  };
  sill: { length: number; thickness: number; depth: number };
  /** `offset`: distancia del halo por delante del cristal. */
  halo: { offset: number; diameter: number };
}

export interface DecorCurtainsConfig {
  /** Plano x de los paños (cara hacia la sala). */
  x: number;
  /** Centros z de cada paño. */
  panelZ: number[];
  panelWidth: number;
  /** Altura libre: de `bottom` a `bottom + panelHeight`. */
  bottom: number;
  panelHeight: number;
  foldAmplitude: number;
  foldPeriod: number;
  color: number;
  roughness: number;
  /** Vueltas de textura por metro (lino de 0,5 m por baldosa). */
  tileSize: number;
  rod: { x: number; y: number; zFrom: number; zTo: number; radius: number };
}

export interface DecorFloorLampConfig {
  /** Centro de la base, a nivel del suelo. */
  position: Vector3;
  baseRadius: number;
  baseHeight: number;
  rodRadius: number;
  rodTop: number;
  shade: {
    /** Radio inferior (boca) de la pantalla. */
    radius: number;
    /** Radio superior (la pantalla es un tronco de cono). */
    radiusTop: number;
    bottom: number;
    height: number;
    color: number;
    emissive: number;
    emissiveIntensity: number;
  };
}

export interface DecorCushionConfig {
  id: string;
  color: number;
  position: Vector3;
  rotation: Euler;
}

export interface DecorThrowConfig {
  id: string;
  color: number;
  position: Vector3;
  rotationY: number;
  width: number;
  depth: number;
  foldAmplitude: number;
  foldPeriod: number;
  /** Grosor de la tela (dos capas). */
  thickness: number;
  /** Altura de la cresta del doblez a lo largo. */
  creaseHeight: number;
  /** Caída de los bordes largos (como sobre el brazo o el puf). */
  drape: number;
  /** Largo de los flecos de los extremos (m). */
  fringe: number;
  /** Tono (0-1) de las franjas de borde frente al fondo de la manta. */
  stripeTone: number;
}

export interface DecorTextilesConfig {
  roughness: number;
  tileSize: number;
  normalScale: number;
  /** Relieve del lino en la manta (más marcado que en cortinas y cojines). */
  throwNormalScale: number;
  /** Factor sobre el tinte de cojines y manta (compensa el lino oscuro). */
  brightness: number;
  cushionSize: number;
  cushionThickness: number;
  cushionPuff: number;
  /** Radio de esquinas y aristas del cojín (≤ cushionThickness / 2). */
  cushionCorner: number;
  cushions: DecorCushionConfig[];
  throw: DecorThrowConfig;
}

/** Una balda con sus tramos de libros (de x a x, en el marco de la estantería) y un jarrón opcional. */
export interface DecorBookTierConfig {
  /** Cara superior de la balda (m, en la escena). */
  top: number;
  /** Alto máximo útil sobre la balda. */
  maxHeight: number;
  runs: { from: number; to: number; lean?: number }[];
  /** Posición X de un jarrón/bote, o ausente. */
  jar?: number;
  /** Libros tumbados (pila) a partir de esta X. */
  stack?: { x: number; count: number };
}

export interface DecorBooksConfig {
  /** Centro de la estantería en Z y fondo útil de las baldas. */
  zCenter: number;
  depth: number;
  /** Paleta apagada (sRGB) de los lomos. */
  palette: number[];
  jarColor: number;
  tiers: DecorBookTierConfig[];
}

export interface Decor3Config {
  frame: DecorFrameConfig;
  artworks: DecorArtworkConfig[];
  brass: DecorBrassConfig;
  sconces: DecorSconcesConfig;
  window: DecorWindowConfig;
  curtains: DecorCurtainsConfig;
  floorLamp: DecorFloorLampConfig;
  textiles: DecorTextilesConfig;
  /** Libros y bote sobre las baldas de la estantería (R8-M4). */
  books: DecorBooksConfig;
  /** Ruta de cada textura por clave de carga (`art:<id>` / `fabric:<id>`). */
  textures: Record<string, string>;
}

const FRAME_Y = 1.6;

export const DECOR3: Decor3Config = {
  frame: {
    width: 0.69,
    height: 0.89,
    depth: 0.03,
    border: 0.025,
    mat: 0.07,
    frameColor: 0x1f1b18,
    frameRoughness: 0.6,
    matColor: 0xf4efe6,
  },
  artworks: [
    // A y B: muro del fondo; C y D: díptico en la pared derecha (0,14 m entre marcos).
    {
      id: 'art-a',
      art: 'spiraea',
      position: new Vector3(-6.35, FRAME_Y, -7.95),
      rotationY: 0,
    },
    {
      id: 'art-b',
      art: 'felce',
      position: new Vector3(6.35, FRAME_Y, -7.95),
      rotationY: 0,
    },
    {
      id: 'art-c',
      art: 'osmunda',
      position: new Vector3(7.95, FRAME_Y, -5.915),
      rotationY: -Math.PI / 2,
    },
    {
      id: 'art-d',
      art: 'pteris',
      position: new Vector3(7.95, FRAME_Y, -5.085),
      rotationY: -Math.PI / 2,
    },
  ],
  brass: { color: 0xa8823f, metalness: 0.6, roughness: 0.45 },
  sconces: {
    positions: [new Vector3(-1.85, 1.7, -7.93), new Vector3(1.85, 1.7, -7.93)],
    plateRadius: 0.06,
    plateDepth: 0.02,
    armLength: 0.14,
    armRadius: 0.012,
    shade: {
      radiusTop: 0.06,
      radiusBottom: 0.09,
      height: 0.22,
      color: 0xffe2b0,
      emissive: 0xffe2b0,
      emissiveIntensity: 0.6,
    },
    halo: {
      offset: new Vector3(0, 0, -0.055),
      diameter: 1.8,
      color: 0xffd9a0,
      opacity: 0.35,
    },
  },
  window: {
    position: new Vector3(-7.99, 1.8, -5),
    rotationY: Math.PI / 2,
    glassWidth: 1.5,
    glassHeight: 1.7,
    glassFrom: 0xe9bb86,
    glassTo: 0xfbe5bd,
    frame: {
      depth: 0.05,
      bar: 0.06,
      mullion: 0.03,
      color: 0xfbf7ef,
      roughness: 0.7,
    },
    sill: { length: 1.7, thickness: 0.04, depth: 0.12 },
    halo: { offset: 0.005, diameter: 2.4 },
  },
  curtains: {
    x: -7.8,
    panelZ: [-6.05, -3.95],
    panelWidth: 0.8,
    bottom: 0.03,
    panelHeight: 2.77,
    foldAmplitude: 0.04,
    foldPeriod: 0.13,
    color: 0xb3c1a3,
    roughness: 1,
    tileSize: 0.5,
    rod: { x: -7.88, y: 2.85, zFrom: -6.5, zTo: -3.5, radius: 0.0125 },
  },
  floorLamp: {
    position: new Vector3(-7.2, 0, -7.2),
    baseRadius: 0.15,
    baseHeight: 0.02,
    rodRadius: 0.0125,
    rodTop: 1.3,
    shade: {
      radius: 0.21,
      radiusTop: 0.15,
      bottom: 1.3,
      height: 0.3,
      color: 0xf3e1c0,
      emissive: 0xffcf94,
      emissiveIntensity: 0.8,
    },
  },
  textiles: {
    roughness: 1,
    tileSize: 0.5,
    normalScale: 0.8,
    throwNormalScale: 1.6,
    brightness: 1.45,
    cushionSize: 0.45,
    cushionThickness: 0.12,
    cushionPuff: 0.045,
    cushionCorner: 0.055,
    // Colocación fina (T-343) con la AABB REAL del sofá cargado (ver SOFA_REAL
    // en decor-builder.service.spec.ts). Medidas en el marco del sofá (x ancho,
    // z fondo, +z hacia la sala; el sofá gira π/4 en (-3, -3)): asiento a
    // 0,585 m, cojines de respaldo inclinados 45° con su frente en z ≈ -0,70 y
    // -0,88; asiento libre entre z -0,70 y el borde delantero (-0,22).
    // Los cojines se apoyan en el asiento reclinados contra el respaldo
    // (41°) y la manta cae sobre el borde delantero del asiento.
    cushions: [
      {
        id: 'cushion-cream',
        color: 0xfff4e0,
        position: new Vector3(-3.933, 0.8, -3.156),
        rotation: new Euler(-0.72, Math.PI / 4 + 0.06, 0, 'YXZ'),
      },
      {
        id: 'cushion-sage',
        color: 0x9fbab2,
        position: new Vector3(-2.66, 0.8, -4.64),
        rotation: new Euler(-0.72, Math.PI / 4 - 0.08, 0, 'YXZ'),
      },
    ],
    throw: {
      id: 'throw',
      color: 0xe6d2ab,
      position: new Vector3(-2.894, 0.6, -3.601),
      rotationY: Math.PI / 4 + 0.06,
      width: 0.95,
      depth: 0.75,
      foldAmplitude: 0.012,
      foldPeriod: 0.38,
      thickness: 0.035,
      creaseHeight: 0.015,
      drape: 0.1,
      fringe: 0.045,
      stripeTone: 0.62,
    },
  },
  // Baldas del bookshelf medidas en el glTF: caras superiores a 0,05 / 0,59 /
  // 1,12 / 1,65 m; interior de x -0,87 a 0,87 y de z -7,746 a -7,403.
  books: {
    zCenter: -7.575,
    depth: 0.22,
    palette: [
      0x7a4a36, 0x9a7b4b, 0x4f6552, 0x35505f, 0xa65f49, 0xc2a67a, 0x6d5a7a,
    ],
    jarColor: 0xa9b8a0,
    tiers: [
      {
        top: 0.59,
        maxHeight: 0.4,
        runs: [{ from: -0.8, to: -0.3, lean: 0.18 }],
        stack: { x: 0.35, count: 4 },
      },
      {
        top: 1.12,
        maxHeight: 0.4,
        runs: [{ from: 0.1, to: 0.78 }],
        jar: -0.55,
      },
      {
        top: 1.65,
        maxHeight: 0.4,
        runs: [
          { from: -0.8, to: -0.15, lean: 0.14 },
          { from: 0.45, to: 0.78 },
        ],
      },
    ],
  },
  textures: {
    'art:spiraea': 'assets/textures/art/spiraea.webp',
    'art:felce': 'assets/textures/art/felce.webp',
    'art:osmunda': 'assets/textures/art/osmunda.webp',
    'art:pteris': 'assets/textures/art/pteris.webp',
    'fabric:linen': 'assets/textures/fabric/linen.webp',
    'fabric:linen-nor': 'assets/textures/fabric/linen-nor.webp',
  },
};

/** Claves de carga (`art:<id>`, `fabric:<id>`) que cuentan en el progreso. */
export const DECOR3_LOAD_KEYS: readonly string[] = Object.keys(DECOR3.textures);
