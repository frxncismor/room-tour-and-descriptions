import { Euler, Vector3 } from 'three';
import { SceneConfiguration } from '../interfaces/scene.interface';

export const DEFAULT_SCENE_CONFIG: SceneConfiguration = {
  camera: {
    fov: 65,
    near: 0.1,
    far: 1000,
    initialPosition: new Vector3(0, 1.7, 3),
    initialHeight: 1.7,
  },
  room: {
    width: 16,
    height: 4,
    depth: 16,
    colors: {
      floor: 0xe0e0e0,
      mainWall: 0xf5e6d3,
      accentWall: 0x2c4a52,
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
      color: 0xffffff,
      intensity: 0.5,
    },
    directional: {
      color: 0xffffff,
      intensity: 0.8,
      position: new Vector3(5, 5, 5),
      castShadow: true,
    },
    spotlights: [],
  },
};

export const MODEL_CONFIGURATIONS = {
  sofa: {
    path: 'assets/models/sofa/scene.gltf',
    position: new Vector3(-3, 0.7, -3),
    scale: 1,
    rotation: new Euler(0, Math.PI / 4, 0),
    metadata: {
      name: 'Modern Sofa',
      description:
        'An elegant contemporary design sofa perfect for your living room.',
    },
  },
  pokerTable: {
    path: 'assets/models/poker_table/scene.gltf',
    position: new Vector3(3, 0.5, -3),
    scale: 1,
    rotation: new Euler(),
    metadata: {
      name: 'Poker Table',
      description:
        'Professional poker table for your games with friends and family.',
    },
  },
  bookshelf: {
    path: 'assets/models/bookshelf/scene.gltf',
    position: new Vector3(0, 1.2, -7.5),
    scale: 1,
    rotation: new Euler(),
    metadata: {
      name: 'Bookshelf',
      description:
        'Modern and spacious bookshelf to organize your books and decoration.',
    },
  },
};

export const UI_TEXT = {
  navigation: {
    title: 'Navigation',
    rotateView: 'Left click + drag to rotate the view',
    moveAround: 'Click on the floor to move around',
    viewDetails: 'Click on furniture to view details',
    gotIt: 'Got it',
  },
};
