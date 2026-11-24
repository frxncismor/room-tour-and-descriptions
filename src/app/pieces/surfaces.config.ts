import type { GroupId } from '../i18n/messages';
import type { SurfaceId } from './piece-ids';
import type { Vec3 } from './pieces.config';

/**
 * Paredes y techo seleccionables (spec 004, C.2). Datos puros: el encuadre lo
 * calcula `CameraService`, que lleva sus propias constantes de pared; el spec
 * de este archivo comprueba que ambas coinciden.
 */

/** Lado de la sala y alto (m). */
export const ROOM_SIZE = 16;
export const ROOM_HEIGHT = 4;

export interface WallConfig {
  id: Exclude<SurfaceId, 'ceiling'>;
  /** Grupo de la lista al que pertenece («Ver pared»). */
  group: GroupId;
  /** Centro del plano de la pared (a media altura). */
  center: Vec3;
  /** Normal unitaria, hacia el interior de la sala. */
  normal: Vec3;
  /** Eje unitario a lo largo de la pared (sentido de los tramos 1…n). */
  along: Vec3;
  width: number;
  height: number;
}

export interface CeilingConfig {
  id: 'ceiling';
  group: GroupId;
  /** Normal unitaria, hacia el interior (abajo). */
  normal: Vec3;
  /** Centro del plano del techo. */
  center: Vec3;
  width: number;
  depth: number;
  /** Pose fija: desde el centro, 23° hacia arriba y hacia la tele (+z). */
  pose: { position: Vec3; target: Vec3 };
}

export const WALLS: readonly WallConfig[] = [
  {
    id: 'wallGreen',
    group: 'greenWall',
    center: [0, ROOM_HEIGHT / 2, -8],
    normal: [0, 0, 1],
    along: [1, 0, 0],
    width: ROOM_SIZE,
    height: ROOM_HEIGHT,
  },
  {
    id: 'wallWindow',
    group: 'windowWall',
    center: [-8, ROOM_HEIGHT / 2, 0],
    normal: [1, 0, 0],
    along: [0, 0, -1],
    width: ROOM_SIZE,
    height: ROOM_HEIGHT,
  },
  {
    id: 'wallTv',
    group: 'tvWall',
    center: [0, ROOM_HEIGHT / 2, 8],
    normal: [0, 0, -1],
    along: [-1, 0, 0],
    width: ROOM_SIZE,
    height: ROOM_HEIGHT,
  },
  {
    id: 'wallDesk',
    group: 'deskWall',
    center: [8, ROOM_HEIGHT / 2, 0],
    normal: [-1, 0, 0],
    along: [0, 0, 1],
    width: ROOM_SIZE,
    height: ROOM_HEIGHT,
  },
];

/** Cámara de ojos de la sala (m) y distancia al objetivo de la pose del techo. */
const CEILING_EYE_HEIGHT = 1.7;
const CEILING_PITCH = (23 * Math.PI) / 180;
const CEILING_DISTANCE = 5;

export const CEILING: CeilingConfig = {
  id: 'ceiling',
  group: 'ceiling',
  normal: [0, -1, 0],
  center: [0, ROOM_HEIGHT, 0],
  width: ROOM_SIZE,
  depth: ROOM_SIZE,
  pose: {
    position: [0, CEILING_EYE_HEIGHT, 0],
    target: [
      0,
      CEILING_EYE_HEIGHT + Math.sin(CEILING_PITCH) * CEILING_DISTANCE,
      Math.cos(CEILING_PITCH) * CEILING_DISTANCE,
    ],
  },
};

/** Las 5 superficies por id. */
export const SURFACES: Readonly<Record<SurfaceId, WallConfig | CeilingConfig>> =
  {
    wallGreen: WALLS[0],
    wallWindow: WALLS[1],
    wallTv: WALLS[2],
    wallDesk: WALLS[3],
    ceiling: CEILING,
  };
