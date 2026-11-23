import { Euler, Vector3 } from 'three';
import { SceneConfiguration } from '../interfaces/scene.interface';

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
    metadata: {
      name: 'Modern Sofa',
      description:
        'An elegant contemporary design sofa perfect for your living room.',
    },
  },
  pokerTable: {
    path: 'assets/models/poker_table/scene.gltf',
    position: new Vector3(3, 0, -3),
    scale: 1,
    rotation: new Euler(),
    yOffset: 0,
    metadata: {
      name: 'Poker Table',
      description:
        'Professional poker table for your games with friends and family.',
    },
  },
  bookshelf: {
    path: 'assets/models/bookshelf/scene.gltf',
    position: new Vector3(0, 0, -7.6),
    scale: 1,
    rotation: new Euler(),
    yOffset: 0,
    metadata: {
      name: 'Bookshelf',
      description:
        'Modern and spacious bookshelf to organize your books and decoration.',
    },
  },
};
