import { TestBed } from '@angular/core/testing';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { localeReady, provideLocale } from '../../i18n/testing';
import { ActionId, ActionPieceId } from '../../pieces/piece-ids';
import { ViewerStateService } from '../../services/viewer-state.service';
import { DescriptionPanelComponent } from './description-panel.component';
import { PANEL_ACTIONS, PanelActionResult } from './panel-actions';

interface Calls {
  run: [ActionPieceId, ActionId][];
  tramo: number[];
}

describe('DescriptionPanelComponent actions and wall sections', () => {
  const calls: Calls = { run: [], tramo: [] };
  let nextAnnouncement: string | null = null;
  let work: string | null = null;

  beforeEach(async () => {
    calls.run = [];
    calls.tramo = [];
    nextAnnouncement = 'Television on. On screen: A fern.';
    work = 'A fern, Anna Atkins, c. 1850';
    TestBed.configureTestingModule({
      providers: [
        provideLocale('en'),
        {
          provide: PANEL_ACTIONS,
          useValue: {
            run: (id: ActionPieceId, action: ActionId): PanelActionResult => {
              calls.run.push([id, action]);
              return { changed: true, announcement: nextAnnouncement };
            },
            focusTramo: (n: number) => calls.tramo.push(n),
            workOnScreen: () => work,
          },
        },
      ],
    });
    await localeReady();
    await TestBed.inject(LocaleService).enablePieces();
    // La TV arranca encendida (modo arte); estos casos parten de apagada.
    TestBed.inject(ViewerStateService).patchPiece('tv', { power: false });
  });

  async function open(info: unknown) {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    fixture.componentRef.setInput('info', info);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const buttons = (el: HTMLElement) =>
    Array.from(
      el.querySelectorAll<HTMLButtonElement>('[role="group"] button.act')
    );
  const live = (el: HTMLElement) =>
    el.querySelector('[aria-live="polite"]')?.textContent?.trim();

  it('shows an Actions group with verb buttons that are at least 44 px tall', async () => {
    const { el } = await open({ id: 'tv', kind: 'piece' });
    const group = el.querySelector('[role="group"]') as HTMLElement;
    expect(group.getAttribute('aria-label')).toBe('Actions');
    const [power, next] = buttons(el);
    // R9-I4: el verbo cambia con el estado, así que no hay `aria-pressed`.
    expect(power.hasAttribute('aria-pressed')).toBe(false);
    expect(power.textContent).toContain('Turn on');
    expect(next.hasAttribute('aria-pressed')).toBe(false);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    const css = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .join(' ');
    expect(css).toMatch(/\.act\[[^\]]*\] \{[^}]*min-height: var\(--hit\)/);
  });

  it('runs the action on click and announces its result in the live region', async () => {
    const { fixture, el } = await open({ id: 'tv', kind: 'piece' });
    buttons(el)[0].click();
    await fixture.whenStable();
    expect(calls.run).toEqual([['tv', 'power']]);
    expect(live(el)).toBe('Television on. On screen: A fern.');
  });

  it('reflects the state: label, visual state and status line with the work on screen', async () => {
    const state = TestBed.inject(ViewerStateService);
    state.patchPiece('tv', { power: true });
    const { el } = await open({ id: 'tv', kind: 'piece' });
    const [power, next] = buttons(el);
    expect(power.hasAttribute('aria-pressed')).toBe(false);
    expect(power.classList.contains('on')).toBe(true);
    expect(power.textContent).toContain('Turn off');
    expect(next.hasAttribute('aria-disabled')).toBe(false);
    expect(el.textContent).toContain('Showing: A fern, Anna Atkins, c. 1850');
  });

  it('hides the work line while the scene cannot tell which work is on screen', async () => {
    work = null;
    TestBed.inject(ViewerStateService).patchPiece('tv', { power: true });
    const { el } = await open({ id: 'tv', kind: 'piece' });
    expect(el.textContent).not.toContain('Showing');
  });

  it('runs "Next" when the TV is on and it when the TV is on', async () => {
    TestBed.inject(ViewerStateService).patchPiece('tv', { power: true });
    const { fixture, el } = await open({ id: 'tv', kind: 'piece' });
    buttons(el)[1].click();
    await fixture.whenStable();
    expect(calls.run).toEqual([['tv', 'next']]);
  });

  it('ignores clicks on a disabled button', async () => {
    const { el } = await open({ id: 'tv', kind: 'piece' });
    buttons(el)[1].click();
    expect(calls.run).toEqual([]);
  });

  it('disables Sound until the record spins and explains why', async () => {
    const { fixture, el } = await open({ id: 'turntable', kind: 'piece' });
    const [spin, sound] = buttons(el);
    expect(sound.getAttribute('aria-disabled')).toBe('true');
    const hintId = sound.getAttribute('aria-describedby') as string;
    expect(el.querySelector(`#${hintId}`)?.textContent).toContain(
      'Start the record first'
    );
    sound.click();
    expect(calls.run).toEqual([]);

    TestBed.inject(ViewerStateService).patchPiece('turntable', { spin: true });
    await fixture.whenStable();
    expect(spin.hasAttribute('aria-pressed')).toBe(false);
    expect(spin.classList.contains('on')).toBe(true);
    expect(el.textContent).toContain('Platter: spinning');
    expect(sound.hasAttribute('aria-disabled')).toBe(false);
  });

  describe('sound unavailable (R9-I3)', () => {
    const hint = (el: HTMLElement) =>
      el.querySelector<HTMLElement>('[data-audio-notice]');

    async function openSpinning() {
      const state = TestBed.inject(ViewerStateService);
      state.patchPiece('turntable', { spin: true });
      return { state, ...(await open({ id: 'turntable', kind: 'piece' })) };
    }

    it('shows nothing while sound has not failed', async () => {
      const { el } = await openSpinning();
      expect(hint(el)).toBeNull();
    });

    it('shows and announces the notice when the sound falls back to off', async () => {
      const { state, fixture, el } = await openSpinning();
      state.audioError.set('audio-unavailable');
      await fixture.whenStable();
      expect(hint(el)?.textContent?.trim()).toBe(
        'Sound is not available in this browser.'
      );
      expect(live(el)).toBe('Sound is not available in this browser.');
      expect(buttons(el)[1].getAttribute('aria-describedby')).toBe(
        hint(el)!.id
      );
    });

    it('is translated to Spanish and hides when the user tries the sound again', async () => {
      const { state, fixture, el } = await openSpinning();
      state.audioError.set('audio-unavailable');
      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(hint(el)?.textContent?.trim()).toBe(
        ES.errors.messages['audio-unavailable']
      );
      buttons(el)[1].click();
      await fixture.whenStable();
      expect(state.audioError()).toBeNull();
      expect(hint(el)).toBeNull();
    });
  });

  it('shows no Actions group for a piece without actions', async () => {
    const { el } = await open({ id: 'credenza', kind: 'piece' });
    expect(el.querySelector('[role="group"]')).toBeNull();
    expect(el.querySelector('#furniture-title')?.textContent).toContain(
      'Walnut'
    );
  });

  describe('wall and ceiling', () => {
    function sections(tramo: number, count: number) {
      const state = TestBed.inject(ViewerStateService);
      state.surfaceTramo.set({ tramo, count });
      return state.surfaceTramo;
    }

    it('shows name and description, with no section buttons when m = 1', async () => {
      sections(1, 1);
      const { el } = await open({ id: 'wallGreen', kind: 'surface' });
      expect(el.querySelector('#furniture-title')?.textContent).toContain(
        'Green wall'
      );
      expect(el.querySelector('[role="group"]')).toBeNull();
      expect(live(el)).toContain('Green wall');
    });

    it('with m = 2 shows Section n of m, announces it and steps with the buttons', async () => {
      const nav = sections(1, 2);
      const { fixture, el } = await open({ id: 'wallGreen', kind: 'surface' });
      expect(live(el)).toBe('Green wall, section 1 of 2');
      expect(el.textContent).toContain('Section 1 of 2');
      const [previous, next] = buttons(el);
      expect(previous.getAttribute('aria-disabled')).toBe('true');
      previous.click();
      next.click();
      expect(calls.tramo).toEqual([2]);

      nav.set({ tramo: 2, count: 2 });
      await fixture.whenStable();
      expect(live(el)).toBe('Green wall, section 2 of 2');
      expect(next.getAttribute('aria-disabled')).toBe('true');
      previous.click();
      next.click();
      expect(calls.tramo).toEqual([2, 1]);
    });

    it('translates everything when the language changes with the panel open', async () => {
      sections(1, 2);
      const { fixture, el } = await open({ id: 'wallGreen', kind: 'surface' });
      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(el.querySelector('#furniture-title')?.textContent).toContain(
        'Pared verde'
      );
      expect(el.textContent).toContain('Tramo 1 de 2');
      expect(buttons(el).map(b => b.textContent?.trim())).toEqual([
        ES.wall.nav.previous,
        ES.wall.nav.next,
      ]);
      expect(live(el)).toBe('Pared verde, tramo 1 de 2');
    });
  });
});
