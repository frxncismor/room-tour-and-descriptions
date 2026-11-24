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
  | 'locale-load-failed';

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
  panel: { close: string };
  list: { title: string; resetView: string; resetViewLabel: string };
  help: {
    title: string;
    open: string;
    openLabel: string;
    gotIt: string;
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
