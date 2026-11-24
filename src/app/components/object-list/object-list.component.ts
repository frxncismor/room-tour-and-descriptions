import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';

export interface ObjectListItem {
  id: string;
  name: string;
  /** Su acción principal está activa (se muestra «Encendida»). */
  on?: boolean;
}

/** Un grupo de la lista: una pared, el suelo o el techo (spec D). */
export interface ObjectListGroup {
  id: string;
  name: string;
  items: ObjectListItem[];
  /** Pared o techo que encuadra la fila «Ver pared»; sin él no hay fila. */
  surfaceId?: string;
}

/** Móvil y paisaje bajo: la lista pasa a tira de dos niveles. */
const COMPACT_QUERY = '(max-width: 600px), (max-height: 500px)';

/** Minúsculas y sin acentos: «lám» encuentra «Lamp» y «lámpara». */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

/**
 * Desplaza solo `container` lo justo para que `target` quede dentro. No usa
 * `scrollIntoView`: este desplaza también a los ancestros (el visor) y mueve
 * todo lo que está en posición absoluta (spec D-419).
 */
function revealWithin(
  container: HTMLElement,
  target: HTMLElement,
  axis: 'x' | 'y',
  inset = 0
): void {
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  if (axis === 'x') {
    if (t.left < c.left + inset)
      container.scrollLeft += t.left - c.left - inset;
    else if (t.right > c.right - inset)
      container.scrollLeft += t.right - c.right + inset;
  } else {
    if (t.top < c.top) container.scrollTop += t.top - c.top;
    else if (t.bottom > c.bottom) container.scrollTop += t.bottom - c.bottom;
  }
}

/** Acceso por teclado/toque a cada pieza, pared y a la vista inicial. */
@Component({
  selector: 'app-object-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="list"
      [class.compact]="compact()"
      [attr.aria-label]="text().title"
    >
      @if (compact()) {
        <ul class="tabs" role="tablist" [attr.aria-label]="text().title">
          @for (group of groups(); track group.id) {
            <li role="presentation">
              <button
                type="button"
                class="tab"
                role="tab"
                [attr.data-group]="group.id"
                [attr.aria-selected]="group.id === openId()"
                (click)="open(group.id)"
              >
                {{ group.name }}
              </button>
            </li>
          }
        </ul>
        <ul class="pieces" [attr.aria-label]="activeGroup()?.name">
          @if (activeGroup(); as group) {
            @if (group.surfaceId) {
              <li>
                <ng-container
                  *ngTemplateOutlet="wallRow; context: { $implicit: group }"
                />
              </li>
            }
            @for (item of group.items; track item.id) {
              <li>
                <ng-container
                  *ngTemplateOutlet="pieceRow; context: { $implicit: item }"
                />
              </li>
            }
          }
          <li class="reset-item">
            <ng-container *ngTemplateOutlet="resetButton" />
          </li>
        </ul>
      } @else {
        <h2 class="head">{{ text().title }}</h2>
        <div class="search" role="search">
          <svg
            viewBox="0 0 14 14"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4" />
            <path d="M9 9l3.5 3.5" />
          </svg>
          <input
            type="search"
            [attr.aria-label]="text().search"
            [placeholder]="text().search"
            [value]="query()"
            autocomplete="off"
            spellcheck="false"
            (input)="onQuery($event)"
            (keydown.escape)="onSearchEscape($event)"
          />
        </div>
        <div class="scroll">
          @for (group of visibleGroups(); track group.id) {
            <section class="grp" [class.open]="isOpen(group)">
              <h3>
                <button
                  type="button"
                  class="gh"
                  [attr.data-group]="group.id"
                  [attr.aria-expanded]="isOpen(group)"
                  [attr.aria-controls]="'grp-' + group.id"
                  (click)="toggle(group.id)"
                >
                  <svg
                    viewBox="0 0 10 10"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                  >
                    <path d="M3 1.5 6.5 5 3 8.5" />
                  </svg>
                  {{ group.name }}
                  <span class="n">{{ group.shown.length }}</span>
                </button>
              </h3>
              @if (isOpen(group)) {
                <ul [id]="'grp-' + group.id">
                  @if (group.surfaceId && !searching()) {
                    <li>
                      <ng-container
                        *ngTemplateOutlet="
                          wallRow;
                          context: { $implicit: group }
                        "
                      />
                    </li>
                  }
                  @for (item of group.shown; track item.id) {
                    <li>
                      <ng-container
                        *ngTemplateOutlet="
                          pieceRow;
                          context: { $implicit: item }
                        "
                      />
                    </li>
                  }
                </ul>
              }
            </section>
          }
          @if (searching() && visibleGroups().length === 0) {
            <p class="empty" role="status">{{ text().searchEmpty }}</p>
          }
        </div>
        <div class="reset-row">
          <ng-container *ngTemplateOutlet="resetButton" />
        </div>
      }
    </nav>
    <ng-template #pieceRow let-item>
      <button
        type="button"
        class="chip"
        [attr.data-id]="item.id"
        [attr.aria-pressed]="item.id === selectedId()"
        (click)="selectItem.emit(item.id)"
      >
        {{ item.name }}
        @if (item.on) {
          <span class="tag">{{ text().stateOn }}</span>
        }
      </button>
    </ng-template>
    <ng-template #wallRow let-group>
      <button
        type="button"
        class="chip wallview"
        [attr.data-id]="group.surfaceId"
        [attr.aria-pressed]="group.surfaceId === selectedId()"
        (click)="viewSurface.emit(group.surfaceId)"
      >
        <svg
          viewBox="0 0 14 14"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M5 2 1.5 5.5 5 9M1.5 5.5H9.5a3 3 0 0 1 3 3V12" />
        </svg>
        {{ text().viewWall }}
      </button>
    </ng-template>
    <ng-template #resetButton>
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
    </ng-template>
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
      display: flex;
      flex-direction: column;
      width: 264px;
      max-height: calc(100% - 96px);
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
    .search {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      height: 36px;
      padding: 0 var(--space-3) 0 10px;
      margin: 0 var(--space-3) var(--space-2);
      color: var(--ink-muted);
      background: var(--paper-raised, var(--paper));
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-1);
    }
    .search:focus-within {
      outline: 2px solid var(--focus);
      outline-offset: 1px;
    }
    .search svg {
      flex: none;
    }
    .search input {
      flex: 1;
      min-width: 0;
      height: 100%;
      font: inherit;
      font-size: var(--fs-small);
      color: var(--ink);
      background: none;
      border: 0;
      outline: none;
    }
    .search input::placeholder {
      color: var(--ink-muted);
      opacity: 1;
    }
    .scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      border-top: 1px solid var(--rule);
    }
    .grp h3 {
      margin: 0;
      font: inherit;
    }
    .gh {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      width: 100%;
      min-height: 40px;
      padding: 0 var(--space-4);
      font-weight: 600;
      color: var(--ink);
      text-align: left;
      cursor: pointer;
      background: none;
      border: 0;
      border-bottom: 1px solid var(--rule);
    }
    .gh:hover {
      background: var(--paper-sunk);
    }
    .gh:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    .gh svg {
      flex: none;
      transition: transform var(--dur-1) var(--ease);
    }
    .grp.open .gh svg {
      transform: rotate(90deg);
    }
    .gh .n {
      margin-left: auto;
      font-size: var(--fs-small);
      font-weight: 400;
      color: var(--ink-muted);
    }
    ul {
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .grp ul {
      background: var(--paper-sunk);
      border-bottom: 1px solid var(--rule);
    }
    .empty {
      padding: var(--space-4);
      font-size: var(--fs-small);
      color: var(--ink-muted);
    }
    .chip {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      width: 100%;
      min-height: 36px;
      padding: 0 var(--space-4) 0 28px;
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
    .grp .chip:hover {
      background: var(--paper);
    }
    .chip[aria-pressed='true'] {
      font-weight: 600;
      background: var(--paper);
      border-left-color: var(--clay);
    }
    .chip:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    .chip.wallview {
      font-weight: 500;
      color: var(--clay);
    }
    .chip.wallview[aria-pressed='true'] {
      font-weight: 600;
    }
    .chip.wallview svg,
    .chip.reset svg {
      flex: none;
    }
    .tag {
      margin-left: auto;
      font-size: var(--fs-label);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      /* --teal sobre --paper-sunk supera 4,5:1 */
      color: var(--teal);
    }
    /* Acción secundaria: no es una pieza, así que va separada por un filete. */
    .chip.reset {
      min-height: 40px;
      padding: 0 var(--space-4);
      font-weight: 500;
      color: var(--clay);
      border-top: 1px solid var(--rule);
    }
    .chip.reset:hover {
      color: var(--clay-hover);
    }
    @media (pointer: coarse) {
      .chip,
      .chip.reset,
      .gh {
        min-height: var(--hit);
      }
    }
    /* Móvil y paisaje bajo: dos niveles, zonas arriba y piezas de la zona debajo. */
    .list.compact {
      top: 0;
      right: 0;
      left: 0;
      width: auto;
      max-height: none;
      border-width: 0 0 1px;
      border-radius: 0;
      box-shadow: none;
    }
    .compact ul {
      display: flex;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .compact li {
      flex: none;
    }
    .tabs {
      border-bottom: 1px solid var(--rule);
    }
    .tab {
      min-height: var(--hit);
      padding: 0 var(--space-4);
      font-size: var(--fs-label);
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--ink-muted);
      text-transform: uppercase;
      white-space: nowrap;
      cursor: pointer;
      background: none;
      border: 0;
      border-bottom: 3px solid transparent;
    }
    .tab[aria-selected='true'] {
      color: var(--ink);
      border-bottom-color: var(--teal);
    }
    .tab:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    .pieces {
      /* El reset es sticky: la pieza activa no debe quedar bajo él. */
      scroll-padding-inline: var(--hit);
    }
    .compact .chip {
      width: auto;
      min-height: var(--hit);
      padding: 0 var(--space-4);
      white-space: nowrap;
      background: none;
      border-bottom: 3px solid transparent;
      border-left: 0;
    }
    .compact .chip[aria-pressed='true'] {
      background: none;
      border-bottom-color: var(--clay);
    }
    /* Solo icono al final de la tira: el texto queda en el aria-label. */
    .compact .chip.reset {
      justify-content: center;
      padding: 0 var(--space-3);
      border-top: 0;
      border-left: 1px solid var(--rule);
    }
    .compact .reset-item {
      position: sticky;
      right: 0;
      margin-left: auto;
      background: var(--paper);
    }
    .compact .wallview svg,
    .compact .reset-text {
      display: none;
    }
    /* Pantallas muy estrechas (≤ 380 px): tira compacta. */
    @media (max-width: 380px) {
      .compact .chip,
      .tab {
        padding: 0 var(--space-3);
        font-size: var(--fs-small);
      }
      .tab {
        font-size: var(--fs-label);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .chip,
      .gh svg {
        transition: none;
      }
    }
  `,
  imports: [NgTemplateOutlet],
})
export class ObjectListComponent {
  readonly groups = input<ObjectListGroup[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly selectItem = output<string>();
  readonly viewSurface = output<string>();
  readonly resetView = output<void>();
  private readonly i18n = inject(LocaleService);
  protected readonly text = computed(() => this.i18n.messages().list);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly query = signal('');
  protected readonly searching = computed(
    () => normalizeText(this.query()).trim() !== ''
  );
  /**
   * Grupo abierto: `null` = sin elección (escritorio: todos plegados; móvil: el
   * primero, la tira necesita una pestaña activa); `''` = ninguno (se cerró a mano).
   */
  protected readonly compact = signal(false);
  private readonly openGroup = signal<string | null>(null);
  protected readonly openId = computed(
    () =>
      this.openGroup() ?? (this.compact() ? (this.groups()[0]?.id ?? '') : '')
  );
  protected readonly activeGroup = computed<ObjectListGroup | undefined>(
    () =>
      this.groups().find(group => group.id === this.openId()) ??
      this.groups()[0]
  );

  /** Grupos con las piezas que cumplen la búsqueda (todos sin búsqueda). */
  protected readonly visibleGroups = computed(() => {
    const needle = normalizeText(this.query()).trim();
    return this.groups()
      .map(group => ({
        ...group,
        shown: needle
          ? group.items.filter(item =>
              normalizeText(item.name).includes(needle)
            )
          : group.items,
      }))
      .filter(group => !needle || group.shown.length > 0);
  });

  constructor() {
    const media = globalThis.matchMedia?.(COMPACT_QUERY);
    if (media) {
      this.compact.set(media.matches);
      media.addEventListener?.('change', event =>
        this.compact.set(event.matches)
      );
    }

    // El grupo de la selección se abre solo.
    effect(() => {
      const id = this.selectedId();
      if (id === null) return;
      const group = this.groups().find(
        g => g.surfaceId === id || g.items.some(item => item.id === id)
      );
      if (group) this.openGroup.set(group.id);
    });

    // La pieza activa puede quedar fuera de la vista: la traemos.
    effect(() => {
      this.selectedId();
      this.groups();
      this.openId();
      this.compact();
      // Reordenar (cambio de idioma) puede soltar el foco del chip: se devuelve.
      const focusedId = this.focusedChipId();
      queueMicrotask(() => {
        this.restoreFocus(focusedId);
        this.revealActive();
      });
    });
  }

  protected isOpen(group: { id: string }): boolean {
    return this.searching() || group.id === this.openId();
  }

  protected toggle(id: string): void {
    this.openGroup.set(this.openId() === id ? '' : id);
  }

  protected open(id: string): void {
    this.openGroup.set(id);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** `Esc` en el buscador lo vacía; con el buscador vacío sigue su camino. */
  protected onSearchEscape(event: Event): void {
    if (this.query() === '') return;
    event.stopPropagation();
    this.query.set('');
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

  /** Desplaza solo la tira o la lista (nunca los ancestros) hasta lo activo. */
  private revealActive(): void {
    const host = this.host.nativeElement;
    const active = host.querySelector<HTMLElement>(
      '.chip[aria-pressed="true"]'
    );
    if (this.compact()) {
      const pieces = host.querySelector<HTMLElement>('.pieces');
      if (pieces && active) revealWithin(pieces, active, 'x', 44);
      const tabs = host.querySelector<HTMLElement>('.tabs');
      const tab = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (tabs && tab) revealWithin(tabs, tab, 'x');
      return;
    }
    const scroll = host.querySelector<HTMLElement>('.scroll');
    if (scroll && active) revealWithin(scroll, active, 'y');
  }
}
