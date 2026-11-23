import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { UI_TEXT } from '../../config/ui-text';

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
        <h2 id="help-title">{{ text.title }}</h2>
        <ul>
          @for (control of text.controls; track control.label) {
            <li>
              <span class="icon" aria-hidden="true">
                @switch (control.icon) {
                  @case ('rotate') {
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
                      <path d="M20 4v4.5h-4.5" />
                      <circle cx="12" cy="12" r="1.5" />
                    </svg>
                  }
                  @case ('pan') {
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
                    </svg>
                  }
                  @case ('zoom') {
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="10.5" cy="10.5" r="6" />
                      <path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5" />
                    </svg>
                  }
                  @case ('walk') {
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"
                      />
                      <circle cx="12" cy="11" r="2.2" />
                    </svg>
                  }
                  @case ('inspect') {
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 14v-3a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
                      <path d="M3 14h18v4H3zM6 18v2M18 18v2" />
                      <path d="M12 3v3" />
                    </svg>
                  }
                  @case ('keyboard') {
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="2.5" y="6" width="19" height="12" rx="2" />
                      <path
                        d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"
                      />
                    </svg>
                  }
                }
              </span>
              <span class="copy">
                <strong>{{ control.label }}</strong>
                <span>{{ touch ? control.touchText : control.text }}</span>
              </span>
            </li>
          }
        </ul>
        <div class="footer">
          <button type="button" class="primary" (click)="dismiss()">
            {{ text.gotIt }}
          </button>
        </div>
      </section>
    } @else if (!open() && !suppressed()) {
      <button
        type="button"
        #reopenButton
        class="reopen"
        [attr.aria-label]="text.openLabel"
        (click)="reopen()"
      >
        <span aria-hidden="true">?</span>
        <span class="reopen-text">{{ text.open }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .sheet {
      position: absolute;
      bottom: 24px;
      left: 50%;
      z-index: 20;
      width: min(92vw, 640px);
      max-height: 40dvh;
      padding: 12px 18px 14px;
      overflow: auto;
      background: rgb(255 255 255 / 0.96);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(8px);
      transform: translateX(-50%);
    }
    h2 {
      margin: 0 0 8px;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--color-text);
    }
    ul {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 20px;
      padding: 0;
      margin: 0 0 10px;
      list-style: none;
    }
    li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 32px;
      height: 32px;
      color: var(--color-accent-strong);
      background: rgb(14 165 233 / 0.1);
      border-radius: var(--radius-sm);
    }
    .copy {
      display: grid;
      font-size: 0.88rem;
      line-height: 1.3;
      color: var(--color-text);
    }
    .copy span {
      color: var(--color-text-muted);
    }
    .primary {
      width: 100%;
      min-height: 40px;
      font: inherit;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      background: var(--color-accent-strong);
      border: 0;
      border-radius: var(--radius-md);
    }
    .primary:hover {
      background: #075985;
    }
    .reopen {
      position: absolute;
      right: 16px;
      bottom: 16px;
      z-index: 20;
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 44px;
      min-height: 44px;
      padding: 0 14px;
      font: inherit;
      font-weight: 600;
      color: var(--color-text);
      cursor: pointer;
      background: rgb(255 255 255 / 0.96);
      border: 0;
      border-radius: 999px;
      box-shadow: var(--shadow-md);
    }
    .reopen:hover {
      background: #fff;
    }
    :is(.primary, .reopen):focus-visible {
      outline: 3px solid var(--color-accent-strong);
      outline-offset: 2px;
    }
    @media (max-width: 600px), (max-height: 500px) {
      .sheet {
        bottom: 0;
        width: 100%;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }
      ul {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .sheet {
        padding-bottom: 0;
        background: #fff;
      }
      ul {
        margin-bottom: 8px;
      }
      .footer {
        position: sticky;
        bottom: 0;
        padding: 8px 0 calc(16px + env(safe-area-inset-bottom));
        background: #fff;
      }
      .reopen-text {
        display: none;
      }
      /* Sin iconos el texto ocupa menos líneas y caben los ítems enteros. */
      .icon {
        display: none;
      }
      li {
        gap: 0;
      }
      .copy {
        font-size: 0.85rem;
        line-height: 1.25;
      }
    }
    /* En táctil no hay teclado: se omite su ítem para no cortar la lista. */
    @media (pointer: coarse) and (max-width: 600px) {
      li:last-child {
        display: none;
      }
    }
  `,
})
export class HelpPanelComponent {
  /** El visor lo oculta mientras hay una ficha abierta (evita tapar la escena). */
  readonly suppressed = input(false);
  protected readonly text = UI_TEXT.help;
  /** Táctil: la ayuda habla de dedos y toques, no de ratón ni teclado. */
  protected readonly touch = isTouchDevice();
  protected readonly open = signal(!readDismissed());

  private readonly injector = inject(Injector);
  private readonly reopenButton =
    viewChild<ElementRef<HTMLButtonElement>>('reopenButton');

  /**
   * La ayuda aparece abierta al cargar pero NO roba el foco (un usuario de
   * ratón/táctil no debe ver saltar el foco): basta con que sea lo primero en
   * el orden de Tab. Al cerrarla, el foco pasa al botón «? Help» para que un
   * usuario de teclado no lo pierda al desaparecer el botón enfocado.
   */
  protected dismiss(): void {
    this.open.set(false);
    writeDismissed(true);
    afterNextRender(() => this.reopenButton()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected reopen(): void {
    this.open.set(true);
    writeDismissed(false);
  }
}
