import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { GROUP_IDS, GroupId } from '../../i18n/messages';
import { localeReady, provideLocale } from '../../i18n/testing';
import type { SurfaceId } from '../../pieces/piece-ids';
import { PIECES } from '../../pieces/pieces.config';
import PIECES_EN from '../../pieces/pieces.en';
import {
  ObjectListComponent,
  ObjectListGroup,
  normalizeText,
} from './object-list.component';

const SURFACES: Partial<Record<GroupId, SurfaceId>> = {
  greenWall: 'wallGreen',
  windowWall: 'wallWindow',
  tvWall: 'wallTv',
  deskWall: 'wallDesk',
  ceiling: 'ceiling',
};

/** Las 35 piezas en sus 6 grupos, con los textos ingleses reales. */
function allGroups(
  names: (id: string) => string = id =>
    PIECES_EN.pieces[id as keyof typeof PIECES_EN.pieces].name
): ObjectListGroup[] {
  return GROUP_IDS.map(id => ({
    id,
    name: EN.list.groups[id],
    surfaceId: SURFACES[id],
    items: PIECES.filter(piece => piece.group === id)
      .sort((a, b) => a.order - b.order)
      .map(piece => ({ id: piece.id, name: names(piece.id) })),
  }));
}

function furnitureGroup(): ObjectListGroup[] {
  return [
    {
      id: 'greenWall',
      name: EN.list.groups.greenWall,
      items: [
        { id: 'sofa', name: EN.furniture.sofa.name },
        { id: 'bookshelf', name: EN.furniture.bookshelf.name },
      ],
    },
  ];
}

function rect(init: Partial<DOMRect>): () => DOMRect {
  return () => ({ top: 0, bottom: 0, left: 0, right: 0, ...init }) as DOMRect;
}

describe('ObjectListComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
  });

  afterEach(() => vi.unstubAllGlobals());

  function create(groups: ObjectListGroup[], selectedId: string | null = null) {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('selectedId', selectedId);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const chips = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('.chip[data-id]'));
  const ids = (el: HTMLElement) =>
    chips(el).map(c => c.getAttribute('data-id'));
  const headers = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('button.gh'));

  it("works with today's furniture alone and emits selection and reset", async () => {
    const { fixture, el } = create(furnitureGroup(), 'bookshelf');
    const selected: string[] = [];
    let resets = 0;
    fixture.componentInstance.selectItem.subscribe(id => selected.push(id));
    fixture.componentInstance.resetView.subscribe(() => resets++);
    await fixture.whenStable();

    expect(chips(el).map(c => c.textContent?.trim())).toEqual([
      EN.furniture.sofa.name,
      EN.furniture.bookshelf.name,
    ]);
    expect(
      el
        .querySelector('.chip[data-id="bookshelf"]')!
        .getAttribute('aria-pressed')
    ).toBe('true');
    chips(el)[0].click();
    el.querySelector<HTMLElement>('button.reset')!.click();
    expect(selected).toEqual(['sofa']);
    expect(resets).toBe(1);
  });

  it('renders 6 groups and 35 pieces with test data', async () => {
    const { fixture, el } = create(allGroups());
    await fixture.whenStable();
    expect(headers(el).length).toBe(6);
    const groups = allGroups();
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(35);
    const counts = headers(el).map(h =>
      h.querySelector('.n')!.textContent!.trim()
    );
    expect(counts).toEqual(groups.map(g => String(g.items.length)));
    let seen = 0;
    for (const header of headers(el)) {
      if (header.getAttribute('aria-expanded') !== 'true') header.click();
      await fixture.whenStable();
      seen += chips(el).filter(c => !c.classList.contains('wallview')).length;
    }
    expect(seen).toBe(35);
  });

  it('is an accordion: one group open, aria-expanded follows, and a click closes it', async () => {
    const { fixture, el } = create(allGroups());
    await fixture.whenStable();
    const expanded = () =>
      headers(el).map(h => h.getAttribute('aria-expanded'));
    // Arranca todo plegado (no tapa la vista inicial).
    expect(expanded().every(v => v === 'false')).toBe(true);
    expect(chips(el).length).toBe(0);
    headers(el)[2].click();
    await fixture.whenStable();
    expect(expanded()).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
    headers(el)[2].click();
    await fixture.whenStable();
    expect(expanded().every(v => v === 'false')).toBe(true);
    expect(chips(el).length).toBe(0);
  });

  it('opens the group of the selection on its own', async () => {
    const { fixture, el } = create(allGroups(), 'tv');
    await fixture.whenStable();
    const open = () =>
      headers(el)
        .find(h => h.getAttribute('aria-expanded') === 'true')!
        .getAttribute('data-group');
    expect(open()).toBe('tvWall');
    expect(
      el.querySelector('.chip[data-id="tv"]')!.getAttribute('aria-pressed')
    ).toBe('true');
    fixture.componentRef.setInput('selectedId', 'desk');
    await fixture.whenStable();
    expect(open()).toBe('deskWall');
  });

  it('keeps a group the user folded when the groups are recomputed (R9-M6)', async () => {
    const { fixture, el } = create(allGroups(), 'tv');
    await fixture.whenStable();
    const tvHeader = () =>
      headers(el).find(h => h.getAttribute('data-group') === 'tvWall')!;
    expect(tvHeader().getAttribute('aria-expanded')).toBe('true');
    tvHeader().click();
    await fixture.whenStable();
    expect(tvHeader().getAttribute('aria-expanded')).toBe('false');
    // Encender una lámpara o cambiar de idioma produce un array nuevo.
    fixture.componentRef.setInput('groups', allGroups());
    await fixture.whenStable();
    expect(tvHeader().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows «View wall» first in a group and emits the surface', async () => {
    const { fixture, el } = create(allGroups(), 'tv');
    const surfaces: string[] = [];
    fixture.componentInstance.viewSurface.subscribe(id => surfaces.push(id));
    await fixture.whenStable();
    const first = chips(el)[0];
    expect(first.textContent?.trim()).toBe(EN.list.viewWall);
    first.click();
    expect(surfaces).toEqual(['wallTv']);
    headers(el)
      .find(h => h.getAttribute('data-group') === 'floor')!
      .click();
    await fixture.whenStable();
    expect(el.querySelector('.wallview')).toBeNull();
  });

  it('marks a piece whose action is on', async () => {
    const groups = allGroups();
    groups[2].items = groups[2].items.map(item => ({
      ...item,
      on: item.id === 'tv',
    }));
    const { fixture, el } = create(groups, 'tv');
    await fixture.whenStable();
    const tags = Array.from(el.querySelectorAll('.tag'));
    expect(tags.map(t => t.textContent?.trim())).toEqual([EN.list.stateOn]);
    expect(el.querySelector('.chip[data-id="tv"] .tag')).not.toBeNull();
  });

  describe('search', () => {
    function type(el: HTMLElement, value: string): void {
      const input = el.querySelector<HTMLInputElement>('input')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }

    it('is a labelled search region', async () => {
      const { fixture, el } = create(allGroups());
      await fixture.whenStable();
      expect(el.querySelector('[role="search"]')).not.toBeNull();
      expect(el.querySelector('input')!.getAttribute('aria-label')).toBe(
        EN.list.search
      );
    });

    it('«lam» and «lám» filter the same, across groups, and show all matches', async () => {
      const { fixture, el } = create(allGroups());
      await fixture.whenStable();
      type(el, 'lam');
      await fixture.whenStable();
      const plain = ids(el);
      expect(plain).toEqual(
        expect.arrayContaining([
          'floorLamp',
          'readingLamp',
          'deskLamp',
          'pendant',
        ])
      );
      expect(chips(el).every(c => !c.classList.contains('wallview'))).toBe(
        true
      );
      type(el, 'lám');
      await fixture.whenStable();
      expect(ids(el)).toEqual(plain);
      expect(headers(el).length).toBeLessThan(6);
    });

    it('matches Spanish names without their accents', async () => {
      const { fixture, el } = create(
        allGroups(id =>
          id === 'pendant'
            ? 'Lámpara colgante'
            : PIECES_EN.pieces[id as 'sofa'].name
        )
      );
      await fixture.whenStable();
      type(el, 'LAMPARA');
      await fixture.whenStable();
      expect(ids(el)).toContain('pendant');
    });

    it('says so when nothing matches, and Esc clears the search without closing anything', async () => {
      const { fixture, el } = create(allGroups());
      document.body.appendChild(el);
      try {
        await fixture.whenStable();
        type(el, 'zzzz');
        await fixture.whenStable();
        expect(el.querySelector('[role="status"]')!.textContent?.trim()).toBe(
          EN.list.searchEmpty
        );

        let reached = false;
        document.addEventListener('keydown', () => (reached = true), {
          once: true,
        });
        el.querySelector('input')!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        await fixture.whenStable();
        expect(el.querySelector('input')!.value).toBe('');
        expect(el.querySelector('[role="status"]')).toBeNull();
        expect(reached).toBe(false);
      } finally {
        el.remove();
      }
    });

    it('normalizes accents and case', () => {
      expect(normalizeText('Lámpara de Pie')).toBe('lampara de pie');
    });
  });

  it('keeps every control a native, focusable button or input (Tab, Enter, Space)', async () => {
    const { fixture, el } = create(allGroups(), 'tv');
    await fixture.whenStable();
    const focusable = Array.from(
      el.querySelectorAll<HTMLElement>('button, input')
    );
    expect(focusable.length).toBeGreaterThan(0);
    expect(focusable.every(f => f.tabIndex === 0)).toBe(true);
    expect(el.querySelectorAll('button:not([type="button"])').length).toBe(0);
  });

  it('does not use scrollIntoView on the desktop list and scrolls only its own container', async () => {
    const scrollIntoView = vi.fn();
    const proto = HTMLElement.prototype as { scrollIntoView?: unknown };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = scrollIntoView;
    try {
      const { fixture, el } = create(allGroups(), 'sofa');
      await fixture.whenStable();
      const scroll = el.querySelector<HTMLElement>('.scroll')!;
      scroll.getBoundingClientRect = rect({ top: 0, bottom: 100 });
      fixture.componentRef.setInput('selectedId', 'tv');
      await fixture.whenStable();
      el.querySelector<HTMLElement>(
        '.chip[data-id="tv"]'
      )!.getBoundingClientRect = rect({ top: 300, bottom: 336 });
      fixture.componentRef.setInput('selectedId', null);
      await fixture.whenStable();
      fixture.componentRef.setInput('selectedId', 'tv');
      await fixture.whenStable();
      await Promise.resolve();
      expect(scroll.scrollTop).toBe(236);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      proto.scrollIntoView = original;
    }
  });

  describe('mobile strip (two levels)', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => undefined,
      }));
    });

    it('shows zone tabs on top and the pieces of the active zone below', async () => {
      const { fixture, el } = create(allGroups(), 'tv');
      await fixture.whenStable();
      const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
      expect(tabs.length).toBe(6);
      expect(
        tabs
          .filter(t => t.getAttribute('aria-selected') === 'true')
          .map(t => t.getAttribute('data-group'))
      ).toEqual(['tvWall']);
      expect(chips(el)[0].textContent?.trim()).toBe(EN.list.viewWall);
      expect(ids(el)).toContain('tv');
      expect(el.querySelector('input')).toBeNull();
      tabs[3].click();
      await fixture.whenStable();
      expect(ids(el)).toContain('desk');
      expect(el.querySelector('.reset-item button.reset')).not.toBeNull();
    });

    it("does not call scrollIntoView and moves the strip's own scrollLeft", async () => {
      const scrollIntoView = vi.fn();
      const proto = HTMLElement.prototype as { scrollIntoView?: unknown };
      const original = proto.scrollIntoView;
      proto.scrollIntoView = scrollIntoView;
      try {
        const { fixture, el } = create(allGroups(), 'sofa');
        await fixture.whenStable();
        el.querySelector<HTMLElement>('.pieces')!.getBoundingClientRect = rect({
          left: 0,
          right: 390,
        });
        el.querySelector<HTMLElement>(
          '.chip[data-id="pokerTable"]'
        )!.getBoundingClientRect = rect({ left: 500, right: 640 });
        fixture.componentRef.setInput('selectedId', 'pokerTable');
        await fixture.whenStable();
        await Promise.resolve();
        expect(
          el.querySelector<HTMLElement>('.pieces')!.scrollLeft
        ).toBeGreaterThan(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
      } finally {
        proto.scrollIntoView = original;
      }
    });
  });

  it('renders the initial view as a secondary icon button after the pieces', async () => {
    const { fixture, el } = create(furnitureGroup());
    await fixture.whenStable();
    const reset = el.querySelector('button.chip.reset') as HTMLElement;
    expect(reset.querySelector('svg')).not.toBeNull();
    expect(reset.getAttribute('aria-label')).toBeTruthy();
    expect(el.querySelectorAll('.chip.reset').length).toBe(1);
  });

  it('keeps the visible text inside the reset accessible name (WCAG 2.5.3)', async () => {
    const { fixture, el } = create(furnitureGroup());
    await fixture.whenStable();
    const reset = el.querySelector('button.chip.reset') as HTMLElement;
    const visible = reset.textContent!.trim().toLowerCase();
    expect(visible).toBe(EN.list.resetView.toLowerCase());
    expect(
      reset.getAttribute('aria-label')!.toLowerCase().startsWith(visible)
    ).toBe(true);
  });

  it('translates its texts when the language changes', async () => {
    const { fixture, el } = create(furnitureGroup(), 'sofa');
    await fixture.whenStable();
    await TestBed.inject(LocaleService).setLocale('es');
    fixture.componentRef.setInput('groups', [
      {
        id: 'greenWall',
        name: ES.list.groups.greenWall,
        items: [{ id: 'sofa', name: ES.furniture.sofa.name }],
      },
    ]);
    await fixture.whenStable();
    expect(el.querySelector('nav')!.getAttribute('aria-label')).toBe(
      ES.list.title
    );
    expect(el.querySelector('input')!.getAttribute('aria-label')).toBe(
      ES.list.search
    );
    expect(el.querySelector('button.reset')!.getAttribute('aria-label')).toBe(
      ES.list.resetViewLabel
    );
    expect(
      el.querySelector('.chip[aria-pressed="true"]')!.textContent?.trim()
    ).toBe(ES.furniture.sofa.name);
  });

  it('keeps the focus inside the list when the pieces are reordered', async () => {
    const group = (order: string[]): ObjectListGroup[] => [
      {
        id: 'greenWall',
        name: 'G',
        items: order.map(id => ({ id, name: id.toUpperCase() })),
      },
    ];
    const { fixture, el } = create(group(['a', 'b']));
    document.body.appendChild(el);
    try {
      await fixture.whenStable();
      el.querySelector<HTMLElement>('.gh')!.click();
      await fixture.whenStable();
      el.querySelector<HTMLElement>('.chip[data-id="b"]')!.focus();
      fixture.componentRef.setInput('groups', group(['b', 'a']));
      await fixture.whenStable();
      await Promise.resolve();
      expect(el.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.getAttribute('data-id')).toBe('b');
    } finally {
      el.remove();
    }
  });
});
