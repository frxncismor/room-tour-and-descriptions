import {
  ApplicationInitStatus,
  EnvironmentProviders,
  inject,
  Provider,
  provideAppInitializer,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import ES from './es';
import { ES_MESSAGES_LOADER, LocaleService } from './locale.service';
import { Locale } from './messages';

/**
 * Solo para tests: deja `LocaleService` en `locale` sin tocar `localStorage`
 * y con el ES ya disponible (sin red). Tras crear el `TestBed`, hay que
 * esperar `await localeReady()` antes de leer los textos.
 */
export function provideLocale(
  locale: Locale
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: ES_MESSAGES_LOADER, useValue: () => Promise.resolve(ES) },
    provideAppInitializer(() =>
      inject(LocaleService).use(locale, { persist: false, announce: false })
    ),
  ];
}

/** Espera a que terminen los inicializadores de `provideLocale`. */
export async function localeReady(): Promise<void> {
  await TestBed.inject(ApplicationInitStatus).donePromise;
}
