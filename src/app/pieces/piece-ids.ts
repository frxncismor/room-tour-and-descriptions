/**
 * Ids de las piezas y superficies seleccionables (spec 004, A.2 y C.2).
 * Solo tipos y constantes de ids: sin lógica ni dependencias, para que
 * cualquier módulo (inicial o perezoso) pueda importarlo sin coste.
 */

/**
 * Las 35 piezas de la sala (tabla A.2): los 5 muebles de siempre, los 6
 * elementos decorativos que pasan a ser seleccionables y las piezas nuevas.
 */
export const PIECE_IDS = [
  // Pared verde
  'sofa',
  'roundTable',
  'bookshelf',
  'landscapePainting',
  'succulent',
  'clock',
  'vase',
  'printSpiraea',
  'printFelce',
  'sconcesBack',
  // Pared de la ventana
  'window',
  'floorLamp',
  'readingChair',
  'readingLamp',
  'sideboard',
  'turntable',
  'bookcaseLeft',
  'printNook',
  // Pared de la tele
  'tv',
  'credenza',
  'printsFront',
  'plantFicus',
  'door',
  'archMirror',
  // Pared del escritorio
  'diptych',
  'tallCabinet',
  'printRight',
  'desk',
  'monitor',
  'deskLamp',
  'displayShelves',
  // Suelo y asientos
  'cushionsThrow',
  'armchair',
  'coffeeTable',
  // Techo
  'pendant',
] as const;

export type PieceId = (typeof PIECE_IDS)[number];

/** Paredes y techo: se pulsan para encuadrarlos (spec C.2). */
export const SURFACE_IDS = [
  'wallGreen',
  'wallWindow',
  'wallTv',
  'wallDesk',
  'ceiling',
] as const;

export type SurfaceId = (typeof SURFACE_IDS)[number];

/**
 * Acciones de las piezas interactivas (spec B.1):
 * `power` enciende/apaga (TV, monitor, lámparas), `next` pasa a la
 * siguiente lámina de la TV, `spin` pone o para el disco y `sound` activa
 * el sonido del tocadiscos.
 */
export const ACTION_IDS = ['power', 'next', 'spin', 'sound'] as const;

export type ActionId = (typeof ACTION_IDS)[number];

/** Qué acciones tiene cada pieza interactiva (el resto no tiene ninguna). */
export const PIECE_IDS_WITH_ACTIONS = {
  tv: ['power', 'next'],
  monitor: ['power'],
  deskLamp: ['power'],
  readingLamp: ['power'],
  floorLamp: ['power'],
  turntable: ['spin', 'sound'],
} as const satisfies Partial<Record<PieceId, readonly ActionId[]>>;

/** Pieza que tiene acciones. */
export type ActionPieceId = keyof typeof PIECE_IDS_WITH_ACTIONS;
