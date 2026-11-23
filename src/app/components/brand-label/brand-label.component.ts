import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';

/** Rótulo discreto con el título del proyecto y su autor (no interactivo).
 * Lo coloca el contenedor `.corner` del visor. */
@Component({
  selector: 'app-brand-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="brand">
      <span class="title">{{ text().title }}</span>
      <span class="byline">{{ text().byline }}</span>
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
    .brand {
      display: grid;
      margin: 0;
      padding: var(--space-2) var(--space-3);
      line-height: var(--lh-tight);
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
      pointer-events: none;
      user-select: none;
    }
    .title {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--ink);
    }
    .byline {
      font-size: var(--fs-label);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
  `,
})
export class BrandLabelComponent {
  private readonly i18n = inject(LocaleService);
  protected readonly text = computed(() => this.i18n.messages().brand);
}
