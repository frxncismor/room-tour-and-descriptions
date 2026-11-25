import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { pct } from '../../i18n/format';
import { LocaleService } from '../../i18n/locale.service';
import { ViewerStateService } from '../../services/viewer-state.service';

@Component({
  selector: 'app-loading-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="loading"
      [class.done]="done()"
      [attr.aria-hidden]="done() ? 'true' : null"
    >
      <div class="card">
        <h1>{{ text().title }}</h1>
        <p class="byline">{{ text().byline }}</p>
        <div
          class="bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="progress()"
          [attr.aria-valuetext]="percent()"
          [attr.aria-label]="text().status"
        >
          <div class="fill" [style.width.%]="progress()"></div>
        </div>
        <p class="status">{{ text().status }} · {{ percent() }}</p>
      </div>
    </div>
  `,
  styles: `
    .loading {
      position: absolute;
      inset: 0;
      z-index: 30;
      display: grid;
      place-items: center;
      background: var(--paper);
      opacity: 1;
      transition: opacity var(--dur-3) var(--ease);
    }
    .loading.done {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity var(--dur-3) var(--ease),
        visibility 0s linear var(--dur-3);
    }
    .card {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      width: min(86vw, 280px);
      text-align: center;
    }
    h1 {
      font-size: var(--fs-display);
      font-weight: 400;
      color: var(--ink);
    }
    .byline {
      margin: calc(var(--space-2) * -1) 0 0;
      font-size: var(--fs-label);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .bar {
      width: 240px;
      max-width: 100%;
      height: 2px;
      margin-top: var(--space-3);
      background: var(--rule);
    }
    .fill {
      height: 100%;
      background: var(--clay);
      transition: width var(--dur-2) var(--ease);
    }
    .status {
      margin: 0;
      font-size: var(--fs-small);
      color: var(--ink-muted);
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 600px) {
      h1 {
        font-size: 2rem;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading,
      .loading.done,
      .fill {
        transition: none;
      }
    }
  `,
})
export class LoadingScreenComponent {
  private readonly state = inject(ViewerStateService);
  private readonly i18n = inject(LocaleService);
  protected readonly text = computed(() => this.i18n.messages().loading);
  protected readonly progress = computed(() =>
    Math.round(Math.min(100, Math.max(0, this.state.loadProgress())))
  );
  protected readonly percent = computed(() =>
    pct(this.progress(), this.i18n.locale())
  );
  /** Termina cuando la escena está lista o la carga falló (se ve el error). */
  protected readonly done = computed(() => {
    const status = this.state.loadStatus();
    return status === 'ready' || status === 'error';
  });
}
