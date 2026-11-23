import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { UI_TEXT } from '../../config/ui-text';
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
        <h1>{{ text.title }}</h1>
        <div
          class="bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="progress()"
          [attr.aria-valuetext]="progress() + '%'"
          [attr.aria-label]="text.status"
        >
          <div class="fill" [style.width.%]="progress()"></div>
        </div>
        <p class="status">{{ text.status }} · {{ progress() }}%</p>
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
      background: var(--color-bg);
      opacity: 1;
      transition: opacity 0.4s ease;
    }
    .loading.done {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity 0.4s ease,
        visibility 0s linear 0.4s;
    }
    .card {
      width: min(86vw, 340px);
      text-align: center;
    }
    h1 {
      margin: 0 0 20px;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .bar {
      height: 8px;
      overflow: hidden;
      background: rgb(31 41 55 / 0.12);
      border-radius: 999px;
    }
    .fill {
      height: 100%;
      background: var(--color-accent-strong);
      transition: width 0.25s ease;
    }
    .status {
      margin: 12px 0 0;
      font-size: 0.9rem;
      color: var(--color-text-muted);
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
  protected readonly text = UI_TEXT.loading;
  protected readonly progress = computed(() =>
    Math.round(Math.min(100, Math.max(0, this.state.loadProgress())))
  );
  /** Termina cuando la escena está lista o la carga falló (se ve el error). */
  protected readonly done = computed(() => {
    const status = this.state.loadStatus();
    return status === 'ready' || status === 'error';
  });
}
