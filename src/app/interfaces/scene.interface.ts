import { Euler, Object3D, Vector3 } from 'three';
import type { FurnitureId } from '../i18n/messages';

export interface ObjectInfo {
  /** Id del mueble (clave de `MODEL_CONFIGURATIONS`). */
  id: FurnitureId;
}

export interface SceneConfiguration {
  camera: CameraConfiguration;
  room: RoomConfiguration;
  lighting: LightingConfiguration;
  renderer: RendererConfiguration;
}

/** Tone mapping del renderer: `neutral` (PBR Neutral de Khronos), `aces` o ninguno. */
export interface RendererConfiguration {
  toneMapping: 'neutral' | 'aces' | 'none';
  exposure: number;
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
  /** Luz de rebote: el color de «suelo» calienta la cara inferior del techo. */
  hemisphere: HemisphereLightConfig;
  spotlights: SpotlightConfig[];
  /** Luces puntuales sin sombra (lámpara de pie). */
  point: PointLightConfig[];
}

export interface HemisphereLightConfig {
  skyColor: number;
  groundColor: number;
  intensity: number;
}

export interface PointLightConfig {
  color: number;
  intensity: number;
  position: Vector3;
  distance: number;
  decay: number;
  castShadow: boolean;
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
  /** Si la pieza proyecta sombra (por defecto sí; cuadro y reloj no). */
  castShadow?: boolean;
  /** Funde por material las mallas estáticas tras cargar (menos draw calls). */
  mergeMeshes?: boolean;
}

/**
 * Pieza decorativa real, no interactiva: sin ficha ni entrada en la lista, y
 * con el raycast anulado.
 */
export type DecorConfiguration = Omit<ModelConfiguration, 'metadata'>;

/** Rutas y parámetros del suelo de madera (T-233). */
export interface FloorTextures {
  diffuse: string;
  normal: string;
  /** Mapa ARM (oclusión, rugosidad, metal): se usa el canal G como rugosidad. */
  arm: string;
  repeat: { x: number; y: number };
  normalScale: number;
}

/** Rutas, medidas y parámetros de la alfombra (T-233). */
export interface RugTextures {
  diffuse: string;
  normal: string;
  /** Tinte multiplicado por la textura. */
  tint: number;
  /** Ribete de otro tono alrededor del plano: color y ancho (m). */
  borderColor: number;
  borderWidth: number;
  /** Medidas del plano (m). */
  width: number;
  depth: number;
  /** Centro en el suelo (x, z). */
  center: { x: number; y: number };
  /** Elevación sobre el suelo (m). */
  y: number;
  rotationY: number;
  repeat: { x: number; y: number };
}

export interface TrimConfiguration {
  height: number;
  depth: number;
  color: number;
  roughness: number;
}

/** Punto en coordenadas de cliente (px), p. ej. un `PointerEvent`. */
export interface ScreenPoint {
  pointerType?: string;
  clientX: number;
  clientY: number;
}

/** Progreso de carga de un modelo en unidades de recurso (gltf, .bin, texturas); `total` crece al descubrirlos. */
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
