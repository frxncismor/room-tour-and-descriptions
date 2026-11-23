import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UI_TEXT } from '../../config/ui-text';

/** Rótulo discreto con el título del proyecto y su autor (no interactivo). */
@Component({
  selector: 'app-brand-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="brand">
      <span class="title">{{ text.title }}</span>
      <span class="byline">{{ text.byline }}</span>
    </p>
  `,
  styles: `
    :host {
      display: contents;
    }
    .brand {
      position: absolute;
      bottom: var(--space-4);
      left: var(--space-4);
      z-index: 10;
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
    @media (max-width: 600px), (max-height: 500px) {
      .brand {
        bottom: var(--space-3);
        left: var(--space-3);
      }
    }
  `,
})
export class BrandLabelComponent {
  protected readonly text = UI_TEXT.brand;
}
