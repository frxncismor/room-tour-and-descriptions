import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { UI_TEXT } from '../../config/ui-text';
import { ViewerError } from '../../services/viewer-state.service';

/** Aviso no bloqueante (p. ej. un modelo no cargó) con «Try again». */
@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner" role="alert">
      <span class="message">{{ error().message }}</span>
      <button type="button" class="action" (click)="retry.emit()">
        {{ text.retry }}
      </button>
    </div>
  `,
  styles: `
    .banner {
      position: absolute;
      top: var(--space-3);
      left: 50%;
      z-index: 25;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: max-content;
      max-width: min(92vw, 520px);
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      color: var(--paper);
      background: var(--danger);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
      transform: translateX(-50%);
    }
    .message {
      font-size: var(--fs-body);
      line-height: var(--lh-body);
    }
    .action {
      min-height: var(--hit);
      padding: 0 var(--space-4);
      font-weight: 600;
      color: var(--paper);
      cursor: pointer;
      background: transparent;
      border: 1px solid var(--paper);
      border-radius: var(--radius-1);
      transition: background var(--dur-1) var(--ease);
    }
    .action:hover {
      background: color-mix(in srgb, var(--paper) 14%, transparent);
    }
    .action:focus-visible {
      outline: 2px solid var(--paper);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .action {
        transition: none;
      }
    }
  `,
})
export class ErrorBannerComponent {
  readonly error = input.required<ViewerError>();
  readonly retry = output<void>();
  protected readonly text = UI_TEXT.errors;
}
