import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { fill } from '../../i18n/format';
import { LocaleService } from '../../i18n/locale.service';
import { ActionText, PieceText } from '../../i18n/messages';
import { SelectedInfo } from '../../interfaces/scene.interface';
import {
  ACTION_IDS,
  ActionId,
  ActionPieceId,
  PIECE_IDS_WITH_ACTIONS,
} from '../../pieces/piece-ids';
import {
  PieceRuntimeState,
  ViewerStateService,
} from '../../services/viewer-state.service';
import { PANEL_ACTIONS } from './panel-actions';

/** Una acción de la ficha lista para pintar. */
interface ActionView {
  id: ActionId;
  label: string;
  /** Botón de alternar: `aria-pressed`; sin estado («Siguiente lámina»): null. */
  pressed: boolean | null;
  disabled: boolean;
  /** Pista del botón deshabilitado (también su descripción accesible). */
  hint: string | null;
  /** Línea de estado visible bajo los botones (p. ej. «Plato: girando»). */
  status: string | null;
}

/** ¿Es esta pieza una de las que tienen acciones (TV, monitor, lámparas, tocadiscos)? */
function hasActions(id: string): id is ActionPieceId {
  return Object.hasOwn(PIECE_IDS_WITH_ACTIONS, id);
}

/** «Tramo 1 de 2» → «tramo 1 de 2» para encadenarlo tras el nombre de la pared. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase() + text.slice(1);
}

/** Ficha de un mueble, pieza o pared: no modal; Esc y clic en vacío los gestiona el visor. */
@Component({
  selector: 'app-description-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Persistent live region: screen readers only announce changes in a
         region that already exists, so it lives outside the @if. -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ liveText() }}
    </div>
    @if (content(); as item) {
      <section
        class="panel"
        role="dialog"
        aria-labelledby="furniture-title"
        aria-describedby="furniture-desc"
      >
        <button
          type="button"
          class="close"
          [attr.aria-label]="i18n.messages().panel.close"
          (click)="closed.emit()"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="butt"
            aria-hidden="true"
          >
            <path d="M3 3l10 10M13 3 3 13" />
          </svg>
        </button>
        <div>
          <h2 id="furniture-title">{{ item.name }}</h2>
          <p id="furniture-desc">{{ item.description }}</p>
          @if (section(); as nav) {
            <div class="row" role="group" [attr.aria-label]="nav.label">
              <button
                type="button"
                class="act"
                [attr.aria-disabled]="nav.tramo <= 1 ? 'true' : null"
                (click)="step(-1)"
              >
                {{ i18n.messages().wall.nav.previous }}
              </button>
              <button
                type="button"
                class="act"
                [attr.aria-disabled]="nav.tramo >= nav.count ? 'true' : null"
                (click)="step(1)"
              >
                {{ i18n.messages().wall.nav.next }}
              </button>
            </div>
            <p class="state">{{ nav.label }}</p>
          }
          @if (actions().length) {
            <div
              class="row"
              role="group"
              [attr.aria-label]="i18n.messages().panel.actions"
            >
              @for (action of actions(); track action.id) {
                <button
                  type="button"
                  class="act"
                  [class.on]="action.pressed"
                  [attr.aria-pressed]="action.pressed"
                  [attr.aria-disabled]="action.disabled ? 'true' : null"
                  [attr.aria-describedby]="
                    action.disabled && action.hint ? 'hint-' + action.id : null
                  "
                  (click)="run(action)"
                >
                  @if (action.pressed) {
                    <span class="dot" aria-hidden="true"></span>
                  }
                  {{ action.label }}
                </button>
              }
            </div>
            @for (action of actions(); track action.id) {
              @if (action.disabled && action.hint) {
                <p class="state" [id]="'hint-' + action.id">
                  {{ action.hint }}
                </p>
              } @else if (action.status) {
                <p class="state">{{ action.status }}</p>
              }
            }
          }
          @if (item.details) {
            <p class="credit">{{ item.details }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      white-space: nowrap;
      clip-path: inset(50%);
      border: 0;
    }
    .panel {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      z-index: 20;
      width: min(92vw, 360px);
      max-height: min(60dvh, 480px);
      padding: var(--space-5);
      overflow: auto;
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-panel);
      overflow-wrap: anywhere;
      animation: panel-in var(--dur-2) var(--ease);
    }
    h2 {
      padding-right: var(--space-6);
      margin: 0;
      font-size: var(--fs-title);
      color: var(--ink);
    }
    p {
      margin: var(--space-3) 0 0;
      color: var(--ink);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
    .act {
      display: inline-flex;
      gap: var(--space-2);
      align-items: center;
      justify-content: center;
      min-height: var(--hit);
      padding: 0 var(--space-4);
      font-weight: 600;
      color: var(--ink);
      cursor: pointer;
      background: transparent;
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-1);
      transition: background var(--dur-1) var(--ease);
    }
    .act:hover {
      background: var(--paper-sunk);
    }
    .act.on {
      color: var(--paper);
      background: var(--teal);
      border-color: var(--teal);
    }
    .act.on:hover {
      background: var(--focus-canvas-dark);
    }
    .act[aria-disabled='true'] {
      color: var(--ink-muted);
      cursor: not-allowed;
      background: transparent;
      border-style: dashed;
    }
    .act:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .dot {
      width: 0.5rem;
      height: 0.5rem;
      background: currentColor;
      border-radius: 50%;
    }
    .state {
      margin-top: var(--space-3);
      font-size: var(--fs-small);
      color: var(--ink-muted);
    }
    .credit {
      padding-top: var(--space-3);
      margin-top: var(--space-4);
      font-size: var(--fs-small);
      color: var(--ink-muted);
      border-top: 1px solid var(--rule);
    }
    .close {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      display: grid;
      place-items: center;
      width: var(--hit);
      height: var(--hit);
      color: var(--ink);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--radius-1);
    }
    .close:hover {
      background: var(--paper-sunk);
    }
    .close:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    @keyframes panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    /* Móvil y paisaje bajo: hoja inferior (≤ 34 dvh) con scroll interno. */
    @media (max-width: 600px), (max-height: 500px) {
      .panel {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        width: auto;
        max-height: 34dvh;
        padding: var(--space-4) var(--space-4)
          calc(var(--space-5) + env(safe-area-inset-bottom));
        overscroll-behavior: contain;
        border-width: 1px 0 0;
        border-radius: var(--radius-2) var(--radius-2) 0 0;
      }
      .credit {
        margin-top: var(--space-3);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel {
        animation: none;
      }
      .act {
        transition: none;
      }
    }
  `,
})
export class DescriptionPanelComponent {
  /** Lo abierto: mueble, pieza o pared; el texto sale del diccionario activo. */
  readonly info = input<SelectedInfo | null>(null);
  readonly closed = output<void>();
  protected readonly i18n = inject(LocaleService);
  private readonly state = inject(ViewerStateService);
  private readonly port = inject(PANEL_ACTIONS);

  /** Texto de la ficha en el idioma activo (se actualiza al cambiar de idioma). */
  protected readonly content = computed<{
    name: string;
    description: string;
    details?: string;
  } | null>(() => {
    const info = this.info();
    if (!info) return null;
    if (info.kind === 'surface') {
      return this.i18n.pieceMessages()?.surfaces[info.id] ?? null;
    }
    if (info.kind === 'piece') {
      return this.i18n.pieceMessages()?.pieces[info.id] ?? null;
    }
    return this.i18n.messages().furniture[info.id];
  });

  /** Tramo actual de la pared encuadrada; solo si hay más de uno. */
  protected readonly section = computed(() => {
    const info = this.info();
    const nav = this.state.surfaceTramo();
    if (info?.kind !== 'surface' || !nav || nav.count < 2) return null;
    return {
      ...nav,
      label: fill(this.i18n.messages().wall.nav.section, {
        n: String(nav.tramo),
        m: String(nav.count),
      }),
    };
  });

  /** Botones de la ficha de una pieza con acciones, según su estado. */
  protected readonly actions = computed<ActionView[]>(() => {
    const info = this.info();
    if (info?.kind !== 'piece' || !hasActions(info.id)) return [];
    const defined = (this.content() as PieceText | null)?.actions;
    if (!defined) return [];
    const piece = this.state.pieceState()[info.id];
    const work = this.port.workOnScreen() ?? '';
    const views: ActionView[] = [];
    for (const id of ACTION_IDS) {
      const text = defined[id];
      if (text) views.push(this.view(id, text, piece, work));
    }
    return views;
  });

  /** Anuncio tras pulsar un botón; se borra al abrir otra ficha. */
  private readonly announcement = linkedSignal<
    SelectedInfo | null,
    string | null
  >({
    source: this.info,
    computation: () => null,
  });

  /** Lo que lee el lector de pantalla: el último anuncio o la ficha entera. */
  protected readonly liveText = computed(() => {
    const item = this.content();
    if (!item) return '';
    const said = this.announcement();
    if (said) return said;
    const section = this.section();
    if (section) return `${item.name}, ${lowerFirst(section.label)}`;
    return `${item.name}. ${item.description}`;
  });

  protected run(action: ActionView): void {
    const info = this.info();
    if (action.disabled || info?.kind !== 'piece' || !hasActions(info.id)) {
      return;
    }
    const result = this.port.run(info.id, action.id);
    if (result.announcement) this.announcement.set(result.announcement);
  }

  protected step(delta: -1 | 1): void {
    const nav = this.section();
    if (!nav) return;
    const next = nav.tramo + delta;
    if (next >= 1 && next <= nav.count) this.port.focusTramo(next);
  }

  private view(
    id: ActionId,
    text: ActionText,
    piece: PieceRuntimeState,
    work: string
  ): ActionView {
    const toggles = id !== 'next';
    const active =
      id === 'power' ? piece.power : id === 'spin' ? piece.spin : piece.sound;
    const stateLine = active ? text.stateOn : text.stateOff;
    return {
      id,
      label: toggles && active ? (text.whenOn ?? text.whenOff) : text.whenOff,
      pressed: toggles ? active : null,
      disabled:
        (id === 'sound' && !piece.spin) || (id === 'next' && !piece.power),
      hint: text.disabledHint ?? null,
      status:
        toggles && stateLine && (work || !stateLine.includes('{work}'))
          ? fill(stateLine, { work })
          : null,
    };
  }
}
