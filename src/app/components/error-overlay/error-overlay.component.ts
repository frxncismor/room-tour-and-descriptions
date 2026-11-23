import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UI_TEXT } from '../../config/ui-text';
import { ViewerError } from '../../services/viewer-state.service';

/** Error bloqueante (WebGL no disponible o contexto perdido). */
@Component({
  selector: 'app-error-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" role="alert">
      <div class="card">
        <h1>
          {{
            error().code === 'webgl-context-lost'
              ? text.contextLostTitle
              : text.webglTitle
          }}
        </h1>
        <p>{{ error().message }}</p>
        @if (error().code === 'webgl-unavailable') {
          <p class="help">{{ text.webglHelp }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .overlay {
      position: absolute;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 16px;
      background: var(--color-bg);
    }
    .card {
      width: min(92vw, 420px);
      padding: 28px;
      text-align: center;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 1.25rem;
      color: var(--color-text);
    }
    p {
      margin: 0 0 10px;
      line-height: 1.5;
      color: var(--color-text);
    }
    .help {
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }
  `,
})
export class ErrorOverlayComponent {
  readonly error = input.required<ViewerError>();
  protected readonly text = UI_TEXT.errors;
}
