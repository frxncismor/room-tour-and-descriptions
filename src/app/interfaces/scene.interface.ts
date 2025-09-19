import { Euler, Vector3 } from 'three';

export interface ObjectInfo {
  name: string;
  description: string;
}

export interface SceneConfiguration {
  camera: CameraConfiguration;
  room: RoomConfiguration;
  lighting: LightingConfiguration;
}

export interface CameraConfiguration {
  fov: number;
  near: number;
  far: number;
  initialPosition: Vector3;
  initialHeight: number;
}

export interface RoomConfiguration {
  width: number;
  height: number;
  depth: number;
  colors: RoomColors;
  limits: RoomLimits;
}

export interface RoomColors {
  floor: number;
  mainWall: number;
  accentWall: number;
  secondaryWall: number;
  ceiling: number;
}

export interface RoomLimits {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LightingConfiguration {
  ambient: AmbientLightConfig;
  directional: DirectionalLightConfig;
  spotlights: SpotlightConfig[];
}

export interface AmbientLightConfig {
  color: number;
  intensity: number;
}

export interface DirectionalLightConfig {
  color: number;
  intensity: number;
  position: Vector3;
  castShadow: boolean;
}

export interface SpotlightConfig {
  color: number;
  intensity: number;
  position: Vector3;
  target: Vector3;
  angle: number;
  penumbra: number;
  decay: number;
  distance: number;
  castShadow: boolean;
}

export interface ModelConfiguration {
  path: string;
  position: Vector3;
  scale: number;
  rotation: Euler;
  metadata: ObjectInfo;
}

export interface InteractionResult {
  objectInfo: ObjectInfo | null;
  success: boolean;
  error?: string;
}
