import type {
  ActionId,
  ActionPieceId,
  PieceId,
  SurfaceId,
} from '../pieces/piece-ids';

/** Idiomas de la interfaz. */
export type Locale = 'en' | 'es';

export const LOCALES: readonly Locale[] = ['en', 'es'];

export const DEFAULT_LOCALE: Locale = 'en';

/** Autónimos del selector: no se traducen (WCAG 2.5.3). */
export const LOCALE_OPTIONS: readonly {
  locale: Locale;
  short: string;
  label: string;
}[] = [
  { locale: 'en', short: 'EN', label: 'EN, English' },
  { locale: 'es', short: 'ES', label: 'ES, Español' },
];

/** Ids de los muebles interactivos (claves de `MODEL_CONFIGURATIONS`). */
export type FurnitureId =
  | 'sofa'
  | 'pokerTable'
  | 'bookshelf'
  | 'landscapePainting'
  | 'succulent';

export const FURNITURE_IDS: readonly FurnitureId[] = [
  'sofa',
  'pokerTable',
  'bookshelf',
  'landscapePainting',
  'succulent',
];

/** Ids de los activos cuya carga puede fallar (se nombran en el aviso). */
export type AssetLabelId =
  | 'floor'
  | 'rug'
  | 'clock'
  | 'vase'
  | 'prints'
  | 'fabric';

/** Códigos de error que traduce la interfaz. */
export type ViewerErrorCode =
  | 'context-lost'
  | 'webgl-unavailable'
  | 'render-failed'
  | 'model-load-failed'
  | 'locale-load-failed'
  | 'pieces-load-failed';

/** Los 6 grupos de la lista de piezas (spec D). */
export type GroupId =
  | 'greenWall'
  | 'windowWall'
  | 'tvWall'
  | 'deskWall'
  | 'floor'
  | 'ceiling';

export const GROUP_IDS: readonly GroupId[] = [
  'greenWall',
  'windowWall',
  'tvWall',
  'deskWall',
  'floor',
  'ceiling',
];

export interface FurnitureText {
  name: string;
  description: string;
  /** Datos secundarios (autoría, origen) para la ficha. */
  details?: string;
}

export interface ControlText {
  label: string;
  /** Etiqueta alternativa en táctil; si falta se usa `label`. */
  touchLabel?: string;
  text: string;
  /** Variante para dispositivos táctiles (sin ratón ni teclado). */
  touchText: string;
  /** Icono SVG de la acción. */
  icon: 'rotate' | 'pan' | 'zoom' | 'walk' | 'inspect' | 'keyboard';
}

/** Forma única de los diccionarios: `EN` y `ES` la satisfacen. */
export interface Messages {
  meta: { title: string; description: string };
  brand: { title: string; byline: string };
  loading: { title: string; byline: string; status: string };
  errors: {
    webglTitle: string;
    contextLostTitle: string;
    webglHelp: string;
    retry: string;
    /** Plantillas por código; `{names}` se sustituye por la lista. */
    messages: Record<ViewerErrorCode, string>;
  };
  panel: {
    close: string;
    /** Título accesible de la sección de acciones de la ficha. */
    actions: string;
  };
  list: {
    title: string;
    resetView: string;
    resetViewLabel: string;
    /** Etiqueta del buscador (y su `aria-label`). */
    search: string;
    /** Aviso cuando la búsqueda no encuentra nada. */
    searchEmpty: string;
    /** Primera fila de cada grupo: encuadra la pared (o el techo). */
    viewWall: string;
    /** Marca de la pieza con su acción activa (p. ej. «On»). */
    stateOn: string;
    groups: Record<GroupId, string>;
  };
  /** Navegación por tramos de una pared que no cabe entera (spec C.2). */
  wall: {
    nav: {
      previous: string;
      next: string;
      /** Plantilla: `{n}` y `{m}`. */
      section: string;
    };
  };
  help: {
    title: string;
    open: string;
    openLabel: string;
    gotIt: string;
    /** Qué hace pulsar una pared (la ficha no se cierra). */
    wallClick: string;
    /** El zoom va hacia el puntero y llega hasta leer una lámina. */
    zoomCursor: string;
    /** Tupla: también cuenta el número de controles. */
    controls: readonly [
      ControlText,
      ControlText,
      ControlText,
      ControlText,
      ControlText,
      ControlText,
    ];
  };
  language: { label: string; announce: string };
  canvasLabel: string;
  assets: Record<AssetLabelId, string>;
  furniture: Record<FurnitureId, FurnitureText>;
}

/** Qué dice cada acción (spec B.4 y B.6). Las plantillas admiten `{work}`. */
export interface ActionText {
  /** Etiqueta del botón mientras el estado está apagado (p. ej. «Turn on»). */
  whenOff: string;
  /** Etiqueta mientras está activo; si falta, la de `whenOff` (acciones sin estado). */
  whenOn?: string;
  /** Anuncio `aria-live` al activar / desactivar. */
  announceOn?: string;
  announceOff?: string;
  /** Línea de estado visible de la ficha, apagada / encendida. */
  stateOff?: string;
  stateOn?: string;
  /** Pista del botón deshabilitado (`aria-disabled`). */
  disabledHint?: string;
}

/** Texto de una pieza del chunk perezoso: la ficha de `FurnitureText` más sus acciones. */
export interface PieceText extends FurnitureText {
  actions?: Partial<Record<ActionId, ActionText>>;
}

/** Pieza con acciones: obliga a declararlas todas (las de `PIECE_IDS_WITH_ACTIONS`). */
export type ActionPieceText = PieceText & {
  actions: Partial<Record<ActionId, ActionText>>;
};

/** Texto de una pared o del techo. */
export interface SurfaceText {
  name: string;
  description: string;
}

/**
 * Diccionario perezoso de las piezas (`pieces.<locale>`): 35 piezas y 5
 * superficies. Se carga con `LocaleService`, no va en el bundle inicial.
 */
export interface PieceMessages {
  pieces: Record<Exclude<PieceId, ActionPieceId>, PieceText> &
    Record<ActionPieceId, ActionPieceText>;
  surfaces: Record<SurfaceId, SurfaceText>;
}
