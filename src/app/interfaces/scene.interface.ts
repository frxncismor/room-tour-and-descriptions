import { Euler, Object3D, Vector3 } from 'three';

export interface ObjectInfo {
  name: string;
  description: string;
  /** Datos secundarios (autoría, origen). */
  details?: string;
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
  /** Semilado (m) del frustum de la cámara de sombra. */
  shadowExtent?: number;
  /** Resolución (px) del mapa de sombra. */
  shadowMapSize?: number;
  shadowBias?: number;
  shadowNormalBias?: number;
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
  /** Sustituciones de material (p. ej. color del sofá, que no trae textura). */
  materialOverride?: MaterialOverride;
  /** Elevación extra sobre el suelo de la base del modelo (m). Por defecto 0. */
  yOffset?: number;
}

/** Punto en coordenadas de cliente (px), p. ej. un `PointerEvent`. */
export interface ScreenPoint {
  clientX: number;
  clientY: number;
}

/** Progreso de descarga de un modelo (bytes). `total` es 0 si se desconoce. */
export type LoadProgressCallback = (loaded: number, total: number) => void;

export interface InteractionResult {
  objectInfo: ObjectInfo | null;
  success: boolean;
  error?: string;
  /** Punto del suelo (validado y recortado) en clics de suelo. */
  floorPoint?: Vector3;
  /** Objeto 3D seleccionado en clics de mueble. */
  object?: Object3D;
}

/** Valores que sustituyen a los del material importado del modelo. */
export interface MaterialOverride {
  color?: number;
  roughness?: number;
  metalness?: number;
}
