import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';

function isTouchDevice(): boolean {
  try {
    return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    return false;
  }
}

export const HELP_STORAGE_KEY = 'room-tour.help-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(HELP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(value: boolean): void {
  try {
    if (value) localStorage.setItem(HELP_STORAGE_KEY, '1');
    else localStorage.removeItem(HELP_STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible: la ayuda solo se recuerda en esta sesión */
  }
}

/** Ayuda de controles; recuerda su cierre y se reabre con el botón «Help». */
@Component({
  selector: 'app-help-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open() && !suppressed()) {
      <section
        class="sheet"
        role="dialog"
        aria-modal="false"
        aria-labelledby="help-title"
      >
        <h2 id="help-title">{{ text().title }}</h2>
        <dl>
          @for (control of text().controls; track control.label) {
            <div [attr.data-keyboard]="control.icon === 'keyboard' ? '' : null">
              <dt>
                {{
                  touch ? (control.touchLabel ?? control.label) : control.label
                }}
              </dt>
              <dd>{{ touch ? control.touchText : control.text }}</dd>
            </div>
          }
        </dl>
        <div class="footer">
          <button type="button" class="primary" (click)="dismiss()">
            {{ text().gotIt }}
          </button>
        </div>
      </section>
    } @else if (!open() && !suppressed()) {
      <button
        type="button"
        #reopenButton
        class="reopen"
        [attr.aria-label]="text().openLabel"
        (click)="reopen()"
      >
        {{ text().open }}
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .sheet {
      position: absolute;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: 20;
      width: min(92vw, 380px);
      max-height: 70dvh;
      padding: var(--space-5);
      overflow: auto;
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
    }
    h2 {
      font-size: var(--fs-title);
      color: var(--ink);
    }
    /* Una sola columna de etiquetas, tan ancha como la más larga («Inspeccionar»). */
    dl {
      display: grid;
      grid-template-columns: minmax(5rem, max-content) 1fr;
      gap: var(--space-3) var(--space-4);
      margin: var(--space-4) 0 var(--space-5);
      font-size: var(--fs-body);
    }
    dl > div {
      display: grid;
      grid-template-columns: subgrid;
      grid-column: 1 / -1;
    }
    dt {
      font-weight: 600;
      color: var(--ink);
    }
    dd {
      margin: 0;
      color: var(--ink-muted);
    }
    .primary {
      min-height: var(--hit);
      padding: 0 var(--space-5);
      font-weight: 600;
      color: var(--paper);
      cursor: pointer;
      background: var(--clay);
      border: 0;
      border-radius: var(--radius-1);
      transition: background var(--dur-1) var(--ease);
    }
    .primary:hover {
      background: var(--clay-hover);
    }
    .reopen {
      position: absolute;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: 20;
      min-width: var(--hit);
      min-height: var(--hit);
      padding: 0 var(--space-4);
      font-weight: 500;
      color: var(--ink);
      cursor: pointer;
      background: var(--paper);
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-1);
      transition: background var(--dur-1) var(--ease);
    }
    .reopen:hover {
      background: var(--paper-sunk);
    }
    @media (max-width: 600px), (max-height: 500px) {
      .sheet {
        right: 0;
        bottom: 0;
        left: 0;
        width: auto;
        max-height: 56dvh;
        padding: var(--space-3) var(--space-4) 0;
        border-width: 1px 0 0;
        border-radius: var(--radius-2) var(--radius-2) 0 0;
      }
      dl {
        grid-template-columns: minmax(4.5rem, max-content) 1fr;
        gap: var(--space-2) var(--space-3);
        margin: var(--space-2) 0 var(--space-1);
        font-size: var(--fs-small);
      }
      h2 {
        margin: 0;
      }
      .footer {
        position: sticky;
        bottom: 0;
        padding: var(--space-2) 0
          calc(var(--space-4) + env(safe-area-inset-bottom));
        background: var(--paper);
      }
      .primary {
        width: 100%;
      }
      .reopen {
        right: var(--space-3);
        bottom: var(--space-3);
      }
    }
    /* En táctil no hay teclado: se omite su ítem para no cortar la lista. */
    @media (pointer: coarse) and (max-width: 600px) {
      [data-keyboard] {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .primary,
      .reopen {
        transition: none;
      }
    }
  `,
})
export class HelpPanelComponent {
  /** El visor lo oculta mientras hay una ficha abierta (evita tapar la escena). */
  readonly suppressed = input(false);
  /** El usuario ya navegó (gesto, lista): la ayuda se da por vista. */
  readonly seen = input(false);
  private readonly i18n = inject(LocaleService);
  protected readonly text = computed(() => this.i18n.messages().help);
  /** Táctil: la ayuda habla de dedos y toques, no de ratón ni teclado. */
  protected readonly touch = isTouchDevice();
  protected readonly open = signal(!readDismissed());

  private readonly injector = inject(Injector);
  private readonly reopenButton =
    viewChild<ElementRef<HTMLButtonElement>>('reopenButton');

  constructor() {
    // Primer gesto, primera selección o uso de la lista: ya sabe explorar, así
    // que la ayuda no debe reaparecer al cerrar la ficha. No mueve el foco.
    effect(() => {
      if (this.suppressed() || this.seen()) {
        untracked(() => {
          if (this.open()) {
            this.open.set(false);
            writeDismissed(true);
          }
        });
      }
    });
  }

  /**
   * La ayuda aparece abierta al cargar pero NO roba el foco (un usuario de
   * ratón/táctil no debe ver saltar el foco): basta con que sea lo primero en
   * el orden de Tab. Al cerrarla, el foco pasa al botón «? Help» para que un
   * usuario de teclado no lo pierda al desaparecer el botón enfocado.
   */
  protected dismiss(): void {
    this.open.set(false);
    writeDismissed(true);
    afterNextRender(
      () => this.reopenButton()?.nativeElement.focus({ preventScroll: true }),
      {
        injector: this.injector,
      }
    );
  }

  protected reopen(): void {
    this.open.set(true);
    writeDismissed(false);
  }
}
