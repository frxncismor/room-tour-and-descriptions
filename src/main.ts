import {
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { LocaleService } from './app/i18n/locale.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    // Espera el diccionario del idioma inicial: ni un fotograma en otro idioma.
    provideAppInitializer(() => inject(LocaleService).init()),
  ],
}).catch(err => console.error(err));
