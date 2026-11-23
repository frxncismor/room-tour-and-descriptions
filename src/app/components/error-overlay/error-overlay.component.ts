import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { errorText } from '../../i18n/error-messages';
import { LocaleService } from '../../i18n/locale.service';
import { ViewerError } from '../../services/viewer-state.service';

/** Error bloqueante (WebGL no disponible o contexto perdido). */
@Component({
  selector: 'app-error-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" role="alert">
      <div class="card">
        <h1>{{ title() }}</h1>
        <p>{{ message() }}</p>
        @if (error().code === 'webgl-unavailable') {
          <p class="help">{{ text().webglHelp }}</p>
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
      padding: var(--space-4);
      background: var(--paper-sunk);
    }
    .card {
      width: min(92vw, 420px);
      padding: var(--space-5);
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
    }
    h1 {
      margin: 0 0 var(--space-3);
      font-size: var(--fs-title);
      color: var(--ink);
    }
    p {
      margin: 0 0 var(--space-2);
      line-height: var(--lh-body);
      color: var(--ink);
    }
    .help {
      font-size: var(--fs-small);
      color: var(--ink-muted);
    }
  `,
})
export class ErrorOverlayComponent {
  readonly error = input.required<ViewerError>();
  private readonly i18n = inject(LocaleService);
  protected readonly text = computed(() => this.i18n.messages().errors);
  protected readonly title = computed(() =>
    this.error().code === 'webgl-context-lost' ||
    this.error().code === 'context-lost'
      ? this.text().contextLostTitle
      : this.text().webglTitle
  );
  protected readonly message = computed(() =>
    errorText(this.i18n.messages(), this.i18n.locale(), this.error())
  );
}
