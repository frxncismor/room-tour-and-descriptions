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
      bottom: 16px;
      left: 16px;
      z-index: 10;
      display: grid;
      margin: 0;
      line-height: 1.25;
      pointer-events: none;
      user-select: none;
    }
    .title {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--color-text);
    }
    .byline {
      font-size: 0.78rem;
      color: var(--color-text-muted);
    }
  `,
})
export class BrandLabelComponent {
  protected readonly text = UI_TEXT.brand;
}
