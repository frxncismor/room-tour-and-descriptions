import { Euler, Vector3 } from 'three';
import {
  DecorConfiguration,
  FloorTextures,
  RugTextures,
  SceneConfiguration,
  TrimConfiguration,
} from '../interfaces/scene.interface';
import { FURNITURE_TEXT } from './ui-text';

export const DEFAULT_SCENE_CONFIG: SceneConfiguration = {
  camera: {
    fov: 65,
    near: 0.1,
    far: 1000,
    initialPosition: new Vector3(0, 1.7, 4.5),
    initialHeight: 1.7,
  },
  room: {
    width: 16,
    height: 4,
    depth: 16,
    colors: {
      floor: 0xe0e0e0,
      mainWall: 0xf5e6d3,
      accentWall: 0x6f8f8c,
      secondaryWall: 0xe6d5c9,
      ceiling: 0xfaf4ec,
    },
    limits: {
      minX: -8,
      maxX: 8,
      minZ: -8,
      maxZ: 8,
    },
  },
  lighting: {
    ambient: {
      color: 0xfff6ec,
      intensity: 0.7,
    },
    directional: {
      color: 0xfff1de,
      intensity: 1.3,
      position: new Vector3(5, 6, 5),
      castShadow: true,
      shadowExtent: 10,
      shadowMapSize: 2048,
      shadowBias: -0.0004,
      shadowNormalBias: 0.03,
    },
    // Puntos de luz sin sombra: solo dan calidez y realzan la pared de acento.
    spotlights: [
      {
        color: 0xfff4e6,
        intensity: 10,
        position: new Vector3(0, 3.9, 0),
        target: new Vector3(0, 0, 0),
        angle: Math.PI / 3,
        penumbra: 0.7,
        decay: 1.5,
        distance: 8,
        castShadow: false,
      },
      {
        color: 0xffffff,
        intensity: 6,
        position: new Vector3(-4, 3.8, -7),
        target: new Vector3(-4, 0, -8),
        angle: Math.PI / 6,
        penumbra: 0.5,
        decay: 1.5,
        distance: 6,
        castShadow: false,
      },
      {
        color: 0xffffff,
        intensity: 6,
        position: new Vector3(4, 3.8, -7),
        target: new Vector3(4, 0, -8),
        angle: Math.PI / 6,
        penumbra: 0.5,
        decay: 1.5,
        distance: 6,
        castShadow: false,
      },
    ],
  },
};

export const MODEL_CONFIGURATIONS = {
  sofa: {
    path: 'assets/models/sofa/scene.gltf',
    position: new Vector3(-3, 0, -3),
    scale: 1,
    rotation: new Euler(0, Math.PI / 4, 0),
    yOffset: 0,
    materialOverride: { color: 0xa65f3a, roughness: 0.9, metalness: 0 },
    metadata: FURNITURE_TEXT.sofa,
  },
  pokerTable: {
    path: 'assets/models/poker_table/scene.gltf',
    position: new Vector3(3, 0, -3),
    scale: 1,
    rotation: new Euler(),
    yOffset: 0,
    metadata: FURNITURE_TEXT.pokerTable,
  },
  bookshelf: {
    path: 'assets/models/bookshelf/scene.gltf',
    position: new Vector3(0, 0, -7.6),
    scale: 1,
    rotation: new Euler(),
    yOffset: 0,
    metadata: FURNITURE_TEXT.bookshelf,
  },
  landscapePainting: {
    path: 'assets/models/landscape_painting/scene.gltf',
    position: new Vector3(-4, 0, -7.975),
    scale: 2,
    rotation: new Euler(),
    yOffset: 1.2,
    castShadow: false,
    mergeMeshes: true,
    metadata: FURNITURE_TEXT.landscapePainting,
  },
  succulent: {
    path: 'assets/models/succulent/scene.gltf',
    position: new Vector3(1.85, 0, -7.55),
    scale: 2.2,
    rotation: new Euler(0, Math.PI / 6, 0),
    yOffset: 0,
    mergeMeshes: true,
    metadata: FURNITURE_TEXT.succulent,
  },
};

/** Decoración real no interactiva: el clic y el hover la atraviesan. */
export const DECOR_CONFIGURATIONS = {
  clock: {
    label: 'Wall clock',
    path: 'assets/models/wall_clock/scene.gltf',
    position: new Vector3(4, 0, -7.95),
    scale: 2,
    rotation: new Euler(),
    yOffset: 1.38,
    castShadow: false,
    mergeMeshes: true,
  },
  vase: {
    label: 'Ceramic vase',
    path: 'assets/models/ceramic_vase/scene.gltf',
    position: new Vector3(-1.85, 0, -7.55),
    scale: 2.2,
    rotation: new Euler(),
    yOffset: 0,
    mergeMeshes: true,
  },
} satisfies Record<string, DecorConfiguration>;

export const FLOOR_TEXTURES: FloorTextures = {
  label: 'Floor texture',
  diffuse: 'assets/textures/floor/diff.webp',
  normal: 'assets/textures/floor/nor.webp',
  arm: 'assets/textures/floor/arm.webp',
  repeat: { x: 16 / 1.7, y: 16 / 1.7 },
  normalScale: 0.6,
};

export const RUG_TEXTURES: RugTextures = {
  label: 'Rug texture',
  diffuse: 'assets/textures/rug/diff.webp',
  normal: 'assets/textures/rug/nor.webp',
  tint: 0xf0e6d8,
  width: 4.2,
  depth: 3.0,
  center: { x: -1.5, y: -1.5 },
  y: 0.004,
  rotationY: Math.PI / 4,
  repeat: { x: 4.2 / 0.27, y: 3.0 / 0.27 },
};

export const TRIM: TrimConfiguration = {
  height: 0.12,
  depth: 0.02,
  color: 0xf3ece1,
  roughness: 0.8,
};
