import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { FurnitureId } from '../../i18n/messages';

/** Ficha de un mueble: no modal; Esc y clic en vacío los gestiona el visor. */
@Component({
  selector: 'app-description-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Persistent live region: screen readers only announce changes in a
         region that already exists, so it lives outside the @if. -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      @if (content(); as announced) {
        {{ announced.name }}. {{ announced.description }}
      }
    </div>
    @if (content(); as item) {
      <section
        class="panel"
        role="dialog"
        aria-labelledby="furniture-title"
        aria-describedby="furniture-desc"
      >
        <button
          type="button"
          class="close"
          [attr.aria-label]="i18n.messages().panel.close"
          (click)="closed.emit()"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="butt"
            aria-hidden="true"
          >
            <path d="M3 3l10 10M13 3 3 13" />
          </svg>
        </button>
        <div>
          <h2 id="furniture-title">{{ item.name }}</h2>
          <p id="furniture-desc">{{ item.description }}</p>
          @if (item.details) {
            <p class="credit">{{ item.details }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: contents;
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
    .panel {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      z-index: 20;
      width: min(92vw, 360px);
      max-height: min(60dvh, 480px);
      padding: var(--space-5);
      overflow: auto;
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
      overflow-wrap: anywhere;
      animation: panel-in var(--dur-2) var(--ease);
    }
    h2 {
      padding-right: var(--space-6);
      margin: 0;
      font-size: var(--fs-title);
      color: var(--ink);
    }
    p {
      margin: var(--space-3) 0 0;
      color: var(--ink);
    }
    .credit {
      padding-top: var(--space-3);
      margin-top: var(--space-4);
      font-size: var(--fs-small);
      color: var(--ink-muted);
      border-top: 1px solid var(--rule);
    }
    .close {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      display: grid;
      place-items: center;
      width: var(--hit);
      height: var(--hit);
      color: var(--ink);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--radius-1);
    }
    .close:hover {
      background: var(--paper-sunk);
    }
    .close:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    @keyframes panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    /* Móvil y paisaje bajo: hoja inferior (≤ 34 dvh) con scroll interno. */
    @media (max-width: 600px), (max-height: 500px) {
      .panel {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        width: auto;
        max-height: 34dvh;
        padding: var(--space-4) var(--space-4)
          calc(var(--space-5) + env(safe-area-inset-bottom));
        overscroll-behavior: contain;
        border-width: 1px 0 0;
        border-radius: var(--radius-2) var(--radius-2) 0 0;
      }
      .credit {
        margin-top: var(--space-3);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel {
        animation: none;
      }
    }
  `,
})
export class DescriptionPanelComponent {
  /** Pieza abierta: solo importa su `id`; el texto sale del diccionario activo. */
  readonly info = input<{ id: FurnitureId } | null>(null);
  readonly closed = output<void>();
  protected readonly i18n = inject(LocaleService);
  /** Texto de la ficha en el idioma activo (se actualiza al cambiar de idioma). */
  protected readonly content = computed(() => {
    const info = this.info();
    return info ? this.i18n.messages().furniture[info.id] : null;
  });
}
