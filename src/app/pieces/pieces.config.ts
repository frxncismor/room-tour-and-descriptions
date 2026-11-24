import type { GroupId } from '../i18n/messages';
import type { ActionId, PieceId } from './piece-ids';
import { PIECE_IDS_WITH_ACTIONS } from './piece-ids';

/**
 * Las 35 piezas seleccionables de la sala (spec 004, A.2). Única fuente de
 * posiciones, rotaciones, tamaños y cajas de raycast («proxies»): ni los
 * builders ni la escena llevan números de colocación.
 *
 * Datos puros (tuplas y números, sin `three`) para poder importarlos desde un
 * chunk perezoso sin coste. Coordenadas de escena en metros, Y arriba, sala
 * 16 × 16 × 4 con x, z ∈ [-8, 8]. Rotación Y: pared verde 0, derecha (x = +8)
 * -π/2, frontal (z = +8) π, izquierda (x = -8) +π/2; con rotación Y = r el
 * frente de la pieza mira hacia (sin r, 0, cos r).
 */

/** Terna (x, y, z) en metros. */
export type Vec3 = readonly [number, number, number];

/** Origen de la pieza: ya estaba en la sala o es nueva de la ronda 4. */
export type PieceOrigin = 'existing' | 'new';

/** Cómo se apoya: suelo, colgada de una pared, del techo o sobre otra pieza. */
export type PieceMount = 'floor' | 'wall' | 'ceiling' | 'on';

/**
 * Qué recibe el clic: el propio objeto (mueble o glTF registrado, silueta
 * real) o sus cajas proxy invisibles (decoración fusionada o procedural).
 */
export type PickMode = 'object' | 'proxy';

/** Caja de raycast: centro en la escena, tamaño local y giro propio. */
export interface PieceProxy {
  position: Vec3;
  /** Ancho (a lo largo de la pared) × alto × fondo, antes de girar. */
  size: Vec3;
  rotationY: number;
}

export interface PieceConfig {
  id: PieceId;
  group: GroupId;
  /** Posición dentro de su grupo en la lista (empieza en 0). */
  order: number;
  origin: PieceOrigin;
  mount: PieceMount;
  pick: PickMode;
  /** Centro del volumen (spec A.2). */
  position: Vec3;
  rotationY: number;
  /** Ancho × alto × fondo (spec A.2), antes de girar. */
  size: Vec3;
  /** Dirección horizontal unitaria del frente (la mira el encuadre). */
  facing: Vec3;
  /** Cajas de raycast; la unión es la caja de encuadre. */
  proxies: readonly PieceProxy[];
  /** Acciones disponibles (vacío si la pieza no hace nada). */
  actions: readonly ActionId[];
  /**
   * Piezas que se usan juntas (sillón y mesita, escritorio y silla…): entre
   * piezas de un mismo clúster el pasillo mínimo no se exige.
   */
  cluster?: string;
}

/** Frente (x, 0, z) de una pieza girada `rotationY` sobre Y. */
const facingOf = (rotationY: number): Vec3 => [
  Math.abs(Math.sin(rotationY)) < 1e-9 ? 0 : Math.sin(rotationY),
  0,
  Math.abs(Math.cos(rotationY)) < 1e-9 ? 0 : Math.cos(rotationY),
];

const PI = Math.PI;

interface PieceInput {
  id: PieceId;
  group: GroupId;
  origin: PieceOrigin;
  mount: PieceMount;
  pick: PickMode;
  position: Vec3;
  rotationY: number;
  size: Vec3;
  proxies?: readonly Partial<PieceProxy>[];
  cluster?: string;
}

/**
 * Completa una definición: orden por grupo, frente, acciones (de
 * `PIECE_IDS_WITH_ACTIONS`) y un proxy único igual a la caja de la pieza si
 * no se dan cajas propias.
 */
const buildPieces = (inputs: readonly PieceInput[]): PieceConfig[] => {
  const counters: Partial<Record<GroupId, number>> = {};
  const actionsOf = PIECE_IDS_WITH_ACTIONS as Partial<
    Record<PieceId, readonly ActionId[]>
  >;
  return inputs.map(input => {
    const order = counters[input.group] ?? 0;
    counters[input.group] = order + 1;
    const proxies = (
      input.proxies ?? [{ position: input.position, size: input.size }]
    ).map(
      (proxy): PieceProxy => ({
        position: proxy.position ?? input.position,
        size: proxy.size ?? input.size,
        rotationY: proxy.rotationY ?? input.rotationY,
      })
    );
    return {
      id: input.id,
      group: input.group,
      order,
      origin: input.origin,
      mount: input.mount,
      pick: input.pick,
      position: input.position,
      rotationY: input.rotationY,
      size: input.size,
      facing: facingOf(input.rotationY),
      proxies,
      actions: actionsOf[input.id] ?? [],
      ...(input.cluster ? { cluster: input.cluster } : {}),
    };
  });
};

/** Alto del eje de láminas y espejo (spec A.1.2). */
export const AXIS_Y = 1.6;

/**
 * Orden: el de la lista (grupos en `GROUP_IDS`, piezas en el de la tabla
 * A.2). Los números de A.2 se respetan; las desviaciones están anotadas en
 * el informe de la pista (puerta z 7,95 y espejo y 1,60).
 */
export const PIECES: readonly PieceConfig[] = buildPieces([
  // ───────────────────────── Pared verde ─────────────────────────
  {
    id: 'landscapePainting',
    group: 'greenWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'object',
    position: [-4, 1.6, -7.97],
    rotationY: 0,
    size: [1.21, 0.93, 0.07],
  },
  {
    id: 'bookshelf',
    group: 'greenWall',
    origin: 'existing',
    mount: 'floor',
    pick: 'object',
    position: [0, 1.07, -7.6],
    rotationY: 0,
    size: [1.83, 2.13, 0.39],
  },
  {
    id: 'succulent',
    group: 'greenWall',
    origin: 'existing',
    mount: 'floor',
    pick: 'object',
    position: [1.85, 0.3, -7.55],
    rotationY: PI / 6,
    size: [0.37, 0.59, 0.37],
  },
  {
    id: 'clock',
    group: 'greenWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'proxy',
    position: [4, 1.6, -7.95],
    rotationY: 0,
    size: [0.64, 0.64, 0.06],
  },
  {
    id: 'vase',
    group: 'greenWall',
    origin: 'existing',
    mount: 'floor',
    pick: 'proxy',
    position: [-1.85, 0.34, -7.55],
    rotationY: 0,
    size: [0.48, 0.68, 0.48],
  },
  {
    id: 'printSpiraea',
    group: 'greenWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'proxy',
    position: [-6.35, AXIS_Y, -7.95],
    rotationY: 0,
    size: [0.69, 0.89, 0.03],
  },
  {
    id: 'printFelce',
    group: 'greenWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'proxy',
    position: [6.35, AXIS_Y, -7.95],
    rotationY: 0,
    size: [0.69, 0.89, 0.03],
  },
  {
    id: 'sconcesBack',
    group: 'greenWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'proxy',
    position: [0, 1.7, -7.93],
    rotationY: 0,
    size: [3.7, 0.3, 0.14],
    // Dos apliques: una caja por cada uno (x = ±1,85).
    proxies: [
      { position: [-1.85, 1.7, -7.93], size: [0.3, 0.3, 0.14] },
      { position: [1.85, 1.7, -7.93], size: [0.3, 0.3, 0.14] },
    ],
  },

  // ─────────────────────── Pared de la ventana ───────────────────────
  {
    id: 'window',
    group: 'windowWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'proxy',
    position: [-7.85, 1.45, -5],
    rotationY: PI / 2,
    size: [3, 2.9, 0.2],
  },
  {
    id: 'floorLamp',
    group: 'windowWall',
    origin: 'existing',
    mount: 'floor',
    pick: 'proxy',
    position: [-7.2, 0.82, -7.2],
    rotationY: 0,
    size: [0.45, 1.65, 0.45],
  },
  {
    id: 'readingChair',
    group: 'windowWall',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [-6.35, 0.59, 3.9],
    rotationY: 1.27,
    size: [1.01, 1.17, 1.19],
    cluster: 'reading',
    // Sillón (caja de A.2) y mesita (0,55 × 0,55 × 0,45) bajo la lámpara.
    proxies: [
      {},
      {
        position: [-6.55, 0.275, 5.2],
        size: [0.55, 0.55, 0.45],
        rotationY: 0,
      },
    ],
  },
  {
    id: 'readingLamp',
    group: 'windowWall',
    origin: 'new',
    mount: 'on',
    pick: 'proxy',
    position: [-6.55, 0.83, 5.2],
    rotationY: 0,
    size: [0.3, 0.55, 0.3],
    cluster: 'reading',
  },
  {
    id: 'sideboard',
    group: 'windowWall',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [-7.69, 0.33, 0.9],
    rotationY: PI / 2,
    size: [1.03, 0.65, 0.61],
    cluster: 'music',
  },
  {
    id: 'turntable',
    group: 'windowWall',
    origin: 'new',
    mount: 'on',
    pick: 'proxy',
    position: [-7.66, 0.69, 0.9],
    rotationY: PI / 2,
    size: [0.43, 0.08, 0.35],
    cluster: 'music',
  },
  {
    id: 'bookcaseLeft',
    group: 'windowWall',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [-7.8, 1.07, 6.9],
    rotationY: PI / 2,
    size: [1.83, 2.13, 0.39],
    cluster: 'reading',
  },
  {
    id: 'printNook',
    group: 'windowWall',
    origin: 'new',
    mount: 'wall',
    pick: 'proxy',
    position: [-7.95, AXIS_Y, 3.2],
    rotationY: PI / 2,
    size: [0.69, 0.89, 0.03],
  },

  // ───────────────────────── Pared de la tele ─────────────────────────
  {
    id: 'tv',
    group: 'tvWall',
    origin: 'new',
    mount: 'wall',
    pick: 'proxy',
    // 1,50 × 0,86 de marco: ≈ 1,6 m de diagonal útil (16:9 con 4 cm de moldura).
    position: [0, 1.43, 7.96],
    rotationY: PI,
    size: [1.5, 0.86, 0.04],
  },
  {
    id: 'credenza',
    group: 'tvWall',
    origin: 'new',
    mount: 'floor',
    pick: 'proxy',
    // y 0,45 (A.2: 0,40): con alto 0,90 la caja bajaba 5 cm bajo el suelo.
    position: [0, 0.45, 7.74],
    rotationY: PI,
    size: [2, 0.9, 0.5],
  },
  {
    id: 'printsFront',
    group: 'tvWall',
    origin: 'new',
    mount: 'wall',
    pick: 'proxy',
    position: [0, AXIS_Y, 7.95],
    rotationY: PI,
    size: [4.6, 0.89, 0.03],
    // Dos láminas (E y F) a ±1,95 del centro, junto a la tele.
    proxies: [
      { position: [-1.95, AXIS_Y, 7.95], size: [0.69, 0.89, 0.03] },
      { position: [1.95, AXIS_Y, 7.95], size: [0.69, 0.89, 0.03] },
    ],
  },
  {
    id: 'plantFicus',
    group: 'tvWall',
    origin: 'new',
    mount: 'floor',
    pick: 'proxy',
    position: [-3.8, 0.88, 7.3],
    rotationY: 0,
    size: [0.9, 1.75, 0.9],
  },
  {
    id: 'door',
    group: 'tvWall',
    origin: 'new',
    mount: 'wall',
    pick: 'proxy',
    // z 7,95 (A.2: 7,97): con 7,97 la hoja de 6 cm tocaba la pared (SC-412
    // pide 0,02–0,06 m).
    position: [5.6, 1.05, 7.95],
    rotationY: PI,
    size: [1.08, 2.1, 0.06],
  },
  {
    id: 'archMirror',
    group: 'tvWall',
    origin: 'new',
    mount: 'wall',
    pick: 'proxy',
    // y 1,60 (A.2: 1,45): va en el eje de 1,60 m (A.1.2). Ya no es un espejo
    // gris sin reflejo, sino una lámina de arco (5:7 en la ventana): 0,8 × 1,16.
    position: [-5.6, AXIS_Y, 7.96],
    rotationY: PI,
    size: [0.8, 1.16, 0.03],
  },

  // ────────────────────── Pared del escritorio ──────────────────────
  {
    id: 'diptych',
    group: 'deskWall',
    origin: 'existing',
    mount: 'wall',
    pick: 'proxy',
    position: [7.95, AXIS_Y, -5.5],
    rotationY: -PI / 2,
    size: [1.52, 0.89, 0.03],
  },
  {
    id: 'tallCabinet',
    group: 'deskWall',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [7.63, 1.28, 0],
    rotationY: -PI / 2,
    size: [1, 2.57, 0.73],
  },
  {
    id: 'printRight',
    group: 'deskWall',
    origin: 'new',
    mount: 'wall',
    pick: 'proxy',
    position: [7.95, AXIS_Y, 1.3],
    rotationY: -PI / 2,
    size: [0.69, 0.89, 0.03],
  },
  {
    id: 'desk',
    group: 'deskWall',
    origin: 'new',
    mount: 'floor',
    pick: 'proxy',
    position: [7.62, 0.38, 3.5],
    rotationY: -PI / 2,
    size: [1.5, 0.75, 0.7],
    cluster: 'desk',
    // Mesa, silla (0,64 × 1,26 × 0,66, de cara a la mesa) y estante.
    proxies: [
      {},
      {
        position: [6.75, 0.63, 3.5],
        size: [0.64, 1.26, 0.66],
        rotationY: PI / 2,
      },
      { position: [7.87, 1.7, 3.5], size: [1.3, 0.05, 0.24] },
    ],
  },
  {
    id: 'monitor',
    group: 'deskWall',
    origin: 'new',
    mount: 'on',
    pick: 'proxy',
    position: [7.68, 1.02, 3.5],
    rotationY: -PI / 2,
    size: [0.63, 0.45, 0.14],
    cluster: 'desk',
  },
  {
    id: 'deskLamp',
    group: 'deskWall',
    origin: 'new',
    mount: 'on',
    pick: 'proxy',
    position: [7.52, 1.03, 2.95],
    rotationY: -PI / 2,
    size: [0.3, 0.55, 0.34],
    cluster: 'desk',
  },
  {
    id: 'displayShelves',
    group: 'deskWall',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [7.78, 0.78, 6.25],
    rotationY: -PI / 2,
    size: [1.08, 1.56, 0.37],
  },

  // ───────────────────────── Suelo y asientos ─────────────────────────
  {
    id: 'sofa',
    group: 'floor',
    origin: 'existing',
    mount: 'floor',
    pick: 'object',
    position: [-3, 0.67, -3],
    rotationY: PI / 4,
    size: [3.9, 1.33, 3.6],
  },
  {
    id: 'cushionsThrow',
    group: 'floor',
    origin: 'existing',
    mount: 'on',
    pick: 'proxy',
    position: [-3.3, 0.7, -3.9],
    rotationY: 0,
    size: [2, 0.5, 1.6],
  },
  {
    id: 'pokerTable',
    group: 'floor',
    origin: 'existing',
    mount: 'floor',
    pick: 'object',
    position: [3, 0.55, -3],
    rotationY: 0,
    size: [1.3, 1.09, 1.3],
  },
  {
    id: 'armchair',
    group: 'floor',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [1.85, 0.51, 5.7],
    rotationY: -0.63,
    size: [0.82, 1.02, 0.99],
    cluster: 'tv',
  },
  {
    id: 'coffeeTable',
    group: 'floor',
    origin: 'new',
    mount: 'floor',
    pick: 'object',
    position: [0.15, 0.2, 5.9],
    rotationY: PI / 2,
    size: [0.6, 0.39, 1.2],
    cluster: 'tv',
  },

  // ───────────────────────────── Techo ─────────────────────────────
  {
    id: 'pendant',
    group: 'ceiling',
    origin: 'new',
    mount: 'ceiling',
    pick: 'object',
    position: [0.15, 3.52, 5.9],
    rotationY: 0,
    size: [0.43, 0.95, 0.43],
  },
]);

/** Piezas por id. */
export const PIECES_BY_ID: Readonly<Record<PieceId, PieceConfig>> =
  Object.fromEntries(PIECES.map(piece => [piece.id, piece])) as Record<
    PieceId,
    PieceConfig
  >;
