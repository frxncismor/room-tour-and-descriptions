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
      top: 12px;
      left: 50%;
      z-index: 25;
      display: flex;
      align-items: center;
      gap: 12px;
      width: max-content;
      max-width: min(92vw, 520px);
      padding: 8px 8px 8px 16px;
      color: #fff;
      background: #b91c1c;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      transform: translateX(-50%);
    }
    .message {
      font-size: 0.95rem;
      line-height: 1.35;
    }
    .action {
      min-height: 44px;
      padding: 0 16px;
      font: inherit;
      font-weight: 600;
      color: #7f1d1d;
      cursor: pointer;
      background: #fff;
      border: 0;
      border-radius: var(--radius-sm);
    }
    .action:focus-visible {
      outline: 3px solid #fff;
      outline-offset: 2px;
    }
  `,
})
export class ErrorBannerComponent {
  readonly error = input.required<ViewerError>();
  readonly retry = output<void>();
  protected readonly text = UI_TEXT.errors;
}
