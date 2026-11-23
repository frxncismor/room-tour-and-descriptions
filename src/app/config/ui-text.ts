import { EN } from '../i18n/en';
import { ControlText } from '../i18n/messages';

export type { ControlText, FurnitureText } from '../i18n/messages';

/**
 * Fachada del diccionario inglés (`i18n/en.ts`, fuente única del texto).
 * Se mantiene hasta que los componentes lean `LocaleService` (spec 003, F3).
 */
export const UI_TEXT = {
  appName: 'Room tour',
  brand: EN.brand,
  loading: EN.loading,
  errors: {
    webglTitle: EN.errors.webglTitle,
    contextLostTitle: EN.errors.contextLostTitle,
    webglHelp: EN.errors.webglHelp,
    retry: EN.errors.retry,
  },
  panel: EN.panel,
  list: EN.list,
  help: {
    ...EN.help,
    controls: EN.help.controls as unknown as ControlText[],
  },
  canvasLabel: EN.canvasLabel,
};

/**
 * Textos por mueble, por id de `MODEL_CONFIGURATIONS`: los mismos objetos
 * que `EN.furniture` (identidad de referencia).
 */
export const FURNITURE_TEXT = EN.furniture;
