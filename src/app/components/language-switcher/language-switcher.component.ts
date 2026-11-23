import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { Locale, LOCALE_OPTIONS } from '../../i18n/messages';

/**
 * Selector EN | ES. Los botones llevan su autónimo (`lang` propio) y no se
 * traducen; el grupo y el anuncio sí. El foco no se mueve al cambiar.
 */
@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="switcher"
      role="group"
      [attr.aria-label]="i18n.messages().language.label"
    >
      @for (option of options; track option.locale) {
        <button
          type="button"
          [attr.lang]="option.locale"
          [attr.aria-pressed]="i18n.locale() === option.locale"
          [attr.aria-label]="option.label"
          (click)="choose(option.locale)"
        >
          {{ option.short }}
        </button>
      }
    </div>
    <p class="sr-only" role="status">{{ i18n.announcement() }}</p>
  `,
  styles: `
    :host {
      display: block;
    }
    .switcher {
      display: flex;
      width: max-content;
      background: var(--paper);
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-1);
      box-shadow: var(--shadow-panel);
    }
    button {
      min-width: var(--hit);
      min-height: var(--hit);
      padding: 0 var(--space-3);
      font-size: var(--fs-small);
      font-weight: 600;
      color: var(--ink);
      letter-spacing: 0.06em;
      cursor: pointer;
      background: none;
      border: 0;
      transition: background-color var(--dur-1) var(--ease);
    }
    button + button {
      border-left: 1px solid var(--rule);
    }
    button:hover {
      background: var(--paper-sunk);
    }
    button[aria-pressed='true'] {
      color: var(--paper);
      background: var(--teal);
    }
    button:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: -4px;
    }
    button[aria-pressed='true']:focus-visible {
      outline-color: var(--paper);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      white-space: nowrap;
      clip-path: inset(50%);
      border: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
})
export class LanguageSwitcherComponent {
  protected readonly i18n = inject(LocaleService);
  protected readonly options = LOCALE_OPTIONS;

  protected choose(locale: Locale): void {
    if (locale === this.i18n.locale()) return;
    void this.i18n.setLocale(locale);
  }
}
