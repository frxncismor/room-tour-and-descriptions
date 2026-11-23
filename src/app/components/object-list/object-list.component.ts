import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { UI_TEXT } from '../../config/ui-text';

export interface ObjectListItem {
  id: string;
  name: string;
}

/** Acceso por teclado/toque a cada mueble y a la vista inicial. */
@Component({
  selector: 'app-object-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="list" [attr.aria-label]="text.title">
      @for (item of items(); track item.id) {
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="item.name === selectedName()"
          (click)="selectItem.emit(item.id)"
        >
          {{ item.name }}
        </button>
      }
      <button
        type="button"
        class="chip reset"
        [attr.aria-label]="text.resetViewLabel"
        (click)="resetView.emit()"
      >
        {{ text.resetView }}
      </button>
    </nav>
  `,
  styles: `
    :host {
      display: contents;
    }
    .list {
      position: absolute;
      top: 16px;
      left: 16px;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }
    .chip {
      min-height: 44px;
      padding: 0 16px;
      font: inherit;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--color-text);
      cursor: pointer;
      background: rgb(255 255 255 / 0.96);
      border: 1px solid transparent;
      border-radius: 999px;
      box-shadow: var(--shadow-sm);
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease;
    }
    .chip:hover {
      background: #fff;
      border-color: var(--color-accent);
    }
    .chip[aria-pressed='true'] {
      color: #fff;
      background: var(--color-accent-strong);
    }
    .chip.reset {
      color: var(--color-accent-strong);
      font-weight: 600;
    }
    .chip:focus-visible {
      outline: 3px solid var(--color-accent-strong);
      outline-offset: 2px;
    }
    @media (max-width: 600px), (max-height: 500px) {
      .list {
        right: 16px;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        padding: 0 12px;
        font-size: 0.85rem;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .chip {
        transition: none;
      }
    }
  `,
})
export class ObjectListComponent {
  readonly items = input<ObjectListItem[]>([]);
  readonly selectedName = input<string | null>(null);
  readonly selectItem = output<string>();
  readonly resetView = output<void>();
  protected readonly text = UI_TEXT.list;
}
