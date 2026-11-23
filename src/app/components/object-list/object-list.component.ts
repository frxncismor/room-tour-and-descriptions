import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';

export interface ObjectListItem {
  id: string;
  name: string;
}

/** Acceso por teclado/toque a cada mueble y a la vista inicial. */
@Component({
  selector: 'app-object-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="list" [attr.aria-label]="text().title">
      <h2 class="head">{{ text().title }}</h2>
      <ul>
        @for (item of items(); track item.id) {
          <li>
            <button
              type="button"
              class="chip"
              [attr.data-id]="item.id"
              [attr.aria-pressed]="item.id === selectedId()"
              (click)="selectItem.emit(item.id)"
            >
              {{ item.name }}
            </button>
          </li>
        }
        <li class="reset-item">
          <button
            type="button"
            class="chip reset"
            [attr.aria-label]="text().resetViewLabel"
            (click)="resetView.emit()"
          >
            <svg
              viewBox="0 0 14 14"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="butt"
              stroke-linejoin="miter"
              aria-hidden="true"
            >
              <path d="M5 2 1.5 5.5 5 9M1.5 5.5H9.5a3 3 0 0 1 3 3V12" />
            </svg>
            <span class="reset-text">{{ text().resetView }}</span>
          </button>
        </li>
      </ul>
    </nav>
  `,
  styles: `
    :host {
      display: contents;
    }
    .list {
      position: absolute;
      top: var(--space-4);
      left: var(--space-4);
      z-index: 20;
      width: 232px;
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
    }
    .head {
      padding: var(--space-3) var(--space-4) var(--space-2);
      font-family: var(--font-text);
      font-size: var(--fs-label);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    ul {
      padding: 0 0 var(--space-1);
      margin: 0;
      list-style: none;
    }
    .chip {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 36px;
      padding: 0 var(--space-4);
      color: var(--ink);
      text-align: left;
      overflow-wrap: anywhere;
      cursor: pointer;
      background: none;
      border: 0;
      border-left: 3px solid transparent;
      transition: background-color var(--dur-1) var(--ease);
    }
    .chip:hover {
      background: var(--paper-sunk);
    }
    .chip[aria-pressed='true'] {
      font-weight: 600;
      background: var(--paper-sunk);
      border-left-color: var(--clay);
    }
    .chip:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    /* Acción secundaria: no es una pieza, así que va separada por un filete. */
    .chip.reset {
      gap: var(--space-2);
      min-height: 40px;
      font-weight: 500;
      color: var(--clay);
      border-top: 1px solid var(--rule);
    }
    .chip.reset:hover {
      color: var(--clay-hover);
    }
    .chip.reset svg {
      flex: none;
    }
    @media (pointer: coarse) {
      .chip,
      .chip.reset {
        min-height: var(--hit);
      }
    }
    /* Móvil y paisaje bajo: tira horizontal con subrayado en la pieza activa. */
    @media (max-width: 600px), (max-height: 500px) {
      .list {
        top: 0;
        right: 0;
        left: 0;
        width: auto;
        border-width: 0 0 1px;
        border-radius: 0;
        box-shadow: none;
      }
      .head {
        display: none;
      }
      ul {
        display: flex;
        padding: 0;
        overflow-x: auto;
        scrollbar-width: none;
        /* El reset es sticky: la pieza activa no debe quedar bajo él. */
        scroll-padding-inline: var(--hit);
      }
      li {
        flex: none;
      }
      .chip {
        width: auto;
        min-height: var(--hit);
        padding: 0 var(--space-4);
        white-space: nowrap;
        border-bottom: 3px solid transparent;
        border-left: 0;
      }
      .chip[aria-pressed='true'] {
        background: none;
        border-bottom-color: var(--clay);
      }
      /* Solo icono al final de la tira: el texto queda en el aria-label. */
      .chip.reset {
        justify-content: center;
        min-height: var(--hit);
        border-top: 0;
        border-left: 1px solid var(--rule);
      }
      .reset-item {
        position: sticky;
        right: 0;
        margin-left: auto;
        background: var(--paper);
      }
      .reset-text {
        display: none;
      }
    }
    /* Pantallas muy estrechas (≤ 380 px): tira compacta. */
    @media (max-width: 380px) {
      .chip {
        padding: 0 var(--space-3);
        font-size: var(--fs-small);
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
  readonly selectedId = input<string | null>(null);
  readonly selectItem = output<string>();
  readonly resetView = output<void>();
  private readonly i18n = inject(LocaleService);
  protected readonly text = computed(() => this.i18n.messages().list);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // En la tira móvil la pieza activa puede quedar fuera de la vista: la traemos.
    effect(() => {
      this.selectedId();
      this.items();
      // Reordenar (cambio de idioma) puede soltar el foco del chip: se devuelve.
      const focusedId = this.focusedChipId();
      queueMicrotask(() => {
        this.restoreFocus(focusedId);
        this.revealActive();
      });
    });
  }

  private focusedChipId(): string | null {
    const active = this.host.nativeElement.ownerDocument.activeElement;
    if (!active || !this.host.nativeElement.contains(active)) return null;
    return active.getAttribute('data-id');
  }

  private restoreFocus(id: string | null): void {
    if (id === null) return;
    const host = this.host.nativeElement;
    if (host.contains(host.ownerDocument.activeElement)) return;
    Array.from(host.querySelectorAll<HTMLElement>('.chip[data-id]'))
      .find(chip => chip.getAttribute('data-id') === id)
      ?.focus({ preventScroll: true });
  }

  private revealActive(): void {
    const active = this.host.nativeElement.querySelector<HTMLElement>(
      '.chip[aria-pressed="true"]'
    );
    active?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }
}
