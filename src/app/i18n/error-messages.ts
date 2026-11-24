import { fill, list } from './format';
import {
  AssetLabelId,
  FURNITURE_IDS,
  FurnitureId,
  Locale,
  Messages,
  ViewerErrorCode,
} from './messages';

/** Forma mínima de un error del visor que sabe traducir `errorText`. */
export interface TranslatableError {
  code: string;
  params?: { names?: readonly string[] };
}

/** Códigos que ya emite `SceneService` con otro nombre. */
const CODE_ALIASES: Readonly<Record<string, ViewerErrorCode>> = {
  'webgl-context-lost': 'context-lost',
};

function resolveCode(code: string): ViewerErrorCode | null {
  const canonical = CODE_ALIASES[code] ?? code;
  return canonical in EMPTY_CODES ? (canonical as ViewerErrorCode) : null;
}

const EMPTY_CODES: Record<ViewerErrorCode, true> = {
  'context-lost': true,
  'webgl-unavailable': true,
  'render-failed': true,
  'model-load-failed': true,
  'locale-load-failed': true,
  'pieces-load-failed': true,
  'audio-unavailable': true,
};

/** Primera letra en minúscula: los nombres van dentro de una frase. */
function inSentence(name: string, locale: Locale): string {
  return name.charAt(0).toLocaleLowerCase(locale) + name.slice(1);
}

/** Un id de `params.names` → su nombre (activo o mueble); si no es un id, tal cual. */
function nameOf(messages: Messages, locale: Locale, id: string): string {
  if (Object.hasOwn(messages.assets, id)) {
    return inSentence(messages.assets[id as AssetLabelId], locale);
  }
  if ((FURNITURE_IDS as readonly string[]).includes(id)) {
    return inSentence(messages.furniture[id as FurnitureId].name, locale);
  }
  return id;
}

/**
 * Texto de un error en el idioma de `messages`.
 * Traduce por código; si falta el código o los `params` que exige,
 * usa el texto genérico de `render-failed`.
 */
export function errorText(
  messages: Messages,
  locale: Locale,
  error: TranslatableError
): string {
  const code = resolveCode(error.code);
  if (code) {
    const template = messages.errors.messages[code];
    if (!template.includes('{names}')) return template;
    const names = error.params?.names;
    if (names?.length) {
      return fill(template, {
        names: list(
          names.map(id => nameOf(messages, locale, id)),
          locale
        ),
      });
    }
  }
  return messages.errors.messages['render-failed'];
}
