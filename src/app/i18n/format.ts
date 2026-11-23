import { Locale } from './messages';

/** Porcentaje localizado: EN «7%», ES «7 %» (espacio no separable). */
export function pct(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

/** Lista con conjunción: «A and B» / «A y B». */
export function list(items: readonly string[], locale: Locale): string {
  return new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(items);
}

/** Sustituye `{clave}` por `params[clave]`; una clave ausente se deja tal cual. */
export function fill(
  template: string,
  params: Readonly<Record<string, string>>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(params, key) ? params[key] : match
  );
}

export function collator(locale: Locale): Intl.Collator {
  return new Intl.Collator(locale);
}
