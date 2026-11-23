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
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 11 12 4l8.5 7" />
          <path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" />
        </svg>
        <span class="reset-text">{{ text.resetView }}</span>
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
    /* Acción secundaria: no es un mueble, así que va con borde y sin relleno. */
    .chip.reset {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      margin-top: 4px;
      font-weight: 600;
      color: var(--color-accent-strong);
      background: rgb(255 255 255 / 0.7);
      border-color: rgb(3 105 161 / 0.35);
      box-shadow: none;
      backdrop-filter: blur(6px);
    }
    .chip.reset:hover {
      background: #fff;
      border-color: var(--color-accent-strong);
    }
    .chip:focus-visible {
      outline: 3px solid var(--color-accent-strong);
      outline-offset: 2px;
    }
    @media (max-width: 600px), (max-height: 500px) {
      .list {
        right: 16px;
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 6px;
        align-items: center;
      }
      .chip {
        flex: 0 1 auto;
        min-width: 0;
        padding: 0 12px;
        font-size: 0.85rem;
        white-space: nowrap;
      }
      /* Botón de icono al final de la fila: el texto queda en el aria-label. */
      .chip.reset {
        flex: none;
        justify-content: center;
        width: 44px;
        padding: 0;
        margin: 0 0 0 auto;
      }
      .reset-text {
        display: none;
      }
    }
    /* Pantallas muy estrechas (≤ 360 px): chips más compactos para seguir en una fila. */
    @media (max-width: 380px) {
      .list {
        gap: 4px;
      }
      .chip {
        padding: 0 9px;
        font-size: 0.78rem;
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
