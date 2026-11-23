import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { FurnitureText, UI_TEXT } from '../../config/ui-text';

/** Ficha de un mueble: no modal; Esc y clic en vacío los gestiona el visor. */
@Component({
  selector: 'app-description-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Persistent live region: screen readers only announce changes in a
         region that already exists, so it lives outside the @if. -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      @if (info(); as announced) {
        {{ announced.name }}. {{ announced.description }}
      }
    </div>
    @if (info(); as item) {
      <section
        class="panel"
        role="dialog"
        aria-labelledby="furniture-title"
        aria-describedby="furniture-desc"
      >
        <button
          type="button"
          class="close"
          [attr.aria-label]="text.close"
          (click)="closed.emit()"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              fill="none"
            />
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
      top: 16px;
      right: 16px;
      z-index: 20;
      width: min(92vw, 360px);
      max-height: min(60dvh, 480px);
      padding: 20px 56px 20px 20px;
      overflow: auto;
      background: rgb(255 255 255 / 0.96);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(8px);
      animation: panel-in 0.2s ease-out;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--color-text);
    }
    p {
      margin: 0;
      line-height: 1.55;
      color: var(--color-text);
    }
    .credit {
      margin-top: 12px;
      font-size: 0.85rem;
      color: var(--color-text-muted);
    }
    .close {
      position: absolute;
      top: 4px;
      right: 4px;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: var(--color-text);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--radius-sm);
    }
    .close:hover {
      background: rgb(31 41 55 / 0.08);
    }
    .close:focus-visible {
      outline: 3px solid var(--color-accent-strong);
      outline-offset: -3px;
    }
    @keyframes panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @media (max-width: 600px), (max-height: 500px) {
      /* Bottom sheet bajo (≤ 30 %): deja libre el mueble recién encuadrado. */
      .panel {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        width: auto;
        max-height: 30dvh;
        padding: 14px 52px calc(14px + env(safe-area-inset-bottom)) 16px;
        overscroll-behavior: contain;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }
      h2 {
        font-size: 1.1rem;
      }
      p {
        line-height: 1.45;
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
  readonly info = input<FurnitureText | null>(null);
  readonly closed = output<void>();
  protected readonly text = UI_TEXT.panel;
}
