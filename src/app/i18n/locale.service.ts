import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  InjectionToken,
  signal,
} from '@angular/core';
import { ViewerStateService } from '../services/viewer-state.service';
import { EN } from './en';
import { DEFAULT_LOCALE, Locale, LOCALES, Messages } from './messages';

/** Clave de `localStorage` con el idioma elegido por el usuario. */
export const LOCALE_STORAGE_KEY = 'room-tour.locale';

/**
 * Carga del diccionario español. Es una importación dinámica para que el ES
 * viaje en un chunk aparte; los tests la sustituyen.
 */
export const ES_MESSAGES_LOADER = new InjectionToken<() => Promise<Messages>>(
  'ES_MESSAGES_LOADER',
  {
    providedIn: 'root',
    factory: () => () => import('./es').then(module => module.default),
  }
);

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/**
 * Primer idioma soportado de la lista del navegador (subetiqueta primaria);
 * `en` si ninguno lo es.
 */
export function detectLocale(
  languages: readonly string[] | null | undefined
): Locale {
  for (const tag of languages ?? []) {
    const primary = String(tag).toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

function readStored(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* almacenamiento no disponible: el idioma solo vale para esta sesión */
  }
}

/**
 * Idioma activo y sus textos (señales). El EN va en el bundle inicial;
 * el ES se importa bajo demanda y, si no carga, la app sigue en inglés
 * con un aviso no bloqueante.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly doc = inject(DOCUMENT);
  private readonly state = inject(ViewerStateService);
  private readonly loadEs = inject(ES_MESSAGES_LOADER);

  private readonly active = signal<Locale>(DEFAULT_LOCALE);
  private readonly dictionary = signal<Messages>(EN);
  private spanish: Messages | null = null;

  readonly locale = this.active.asReadonly();
  readonly messages = computed(() => this.dictionary());
  /** Texto para el lector de pantalla; solo cambia tras elegir un idioma. */
  readonly announcement = signal('');

  constructor() {
    effect(() => this.applyToDocument(this.active(), this.dictionary()));
  }

  /**
   * Fija el idioma inicial (guardado o detectado) y espera su diccionario
   * para que no se pinte ni un fotograma en otro idioma. No escribe en
   * `localStorage`. Pensado para `provideAppInitializer`.
   */
  async init(): Promise<void> {
    const languages = this.doc.defaultView?.navigator?.languages;
    const navigatorLanguages = languages?.length
      ? languages
      : [this.doc.defaultView?.navigator?.language ?? ''];
    const initial = readStored() ?? detectLocale(navigatorLanguages);
    await this.use(initial, { persist: false, announce: false });
  }

  /** Cambio elegido por el usuario: se recuerda y se anuncia. */
  async setLocale(locale: Locale): Promise<void> {
    await this.use(locale, { persist: true, announce: true });
  }

  /** Cambia sin guardar ni anunciar (tests y arranque). */
  async use(
    locale: Locale,
    options: { persist: boolean; announce: boolean }
  ): Promise<void> {
    if (!isLocale(locale)) return;
    const dictionary = await this.dictionaryFor(locale);
    if (!dictionary) {
      this.notifyLoadFailure();
      return;
    }
    this.dictionary.set(dictionary);
    this.active.set(locale);
    this.applyToDocument(locale, dictionary);
    if (options.persist) writeStored(locale);
    if (options.announce) this.announcement.set(dictionary.language.announce);
  }

  private async dictionaryFor(locale: Locale): Promise<Messages | null> {
    if (locale === 'en') return EN;
    if (this.spanish) return this.spanish;
    try {
      this.spanish = await this.loadEs();
      return this.spanish;
    } catch (error) {
      console.warn('Could not load the Spanish messages', error);
      return null;
    }
  }

  private notifyLoadFailure(): void {
    this.state.error.set({
      code: 'locale-load-failed',
      retry: () => {
        this.state.error.set(null);
        void this.setLocale('es');
      },
    });
  }

  private applyToDocument(locale: Locale, messages: Messages): void {
    const root = this.doc.documentElement;
    if (root.lang !== locale) root.lang = locale;
    if (this.doc.title !== messages.meta.title) {
      this.doc.title = messages.meta.title;
    }
    this.doc
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', messages.meta.description);
  }
}
