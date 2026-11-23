import { TestBed } from '@angular/core/testing';
import { LocaleService } from '../../i18n/locale.service';
import { localeReady, provideLocale } from '../../i18n/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { SceneService } from '../../services/scene.service';
import { ViewerStateService } from '../../services/viewer-state.service';
import { ViewerComponent } from './viewer.component';

describe('ViewerComponent', () => {
  const scene = {
    initialize: vi.fn(),
    loadAll: vi.fn(() => Promise.resolve()),
    dispose: vi.fn(),
    getObjectList: vi.fn(() => [
      { id: 'sofa', name: EN.furniture.sofa.name },
      { id: 'succulent', name: EN.furniture.succulent.name },
      { id: 'bookshelf', name: EN.furniture.bookshelf.name },
      { id: 'pokerTable', name: EN.furniture.pokerTable.name },
      { id: 'landscapePainting', name: EN.furniture.landscapePainting.name },
    ]),
    handlePointerSelect: vi.fn(() => Promise.resolve()),
    handlePointerMove: vi.fn(),
    clearSelection: vi.fn(),
    selectObject: vi.fn(),
    resetView: vi.fn(),
    retryLoad: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    Object.values(scene).forEach(fn => fn.mockClear());
    localStorage.setItem('room-tour.help-dismissed', '1');
    TestBed.configureTestingModule({
      providers: [
        { provide: SceneService, useValue: scene },
        provideLocale('en'),
      ],
    });
  });

  beforeEach(async () => {
    await localeReady();
  });

  afterEach(() => localStorage.removeItem('room-tour.help-dismissed'));

  function pointer(type: string, init: PointerEventInit): PointerEvent {
    return new PointerEvent(type, { bubbles: true, pointerId: 1, ...init });
  }

  it('initializes the scene and loads the models', async () => {
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    expect(scene.initialize).toHaveBeenCalledTimes(1);
    expect(scene.loadAll).toHaveBeenCalledTimes(1);
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBeTruthy();
    expect(canvas.tabIndex).toBe(0);
  });

  it('treats a short press as a click and a drag as navigation', async () => {
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    const canvas = fixture.nativeElement.querySelector('canvas');

    canvas.dispatchEvent(
      pointer('pointerdown', { clientX: 100, clientY: 100 })
    );
    canvas.dispatchEvent(pointer('pointerup', { clientX: 102, clientY: 101 }));
    expect(scene.handlePointerSelect).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(
      pointer('pointerdown', { clientX: 100, clientY: 100 })
    );
    canvas.dispatchEvent(
      pointer('pointermove', { clientX: 140, clientY: 100 })
    );
    canvas.dispatchEvent(pointer('pointerup', { clientX: 140, clientY: 100 }));
    expect(scene.handlePointerSelect).toHaveBeenCalledTimes(1);
  });

  it('captures the pointer and survives an invalid pointerId', async () => {
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    const canvas = fixture.nativeElement.querySelector('canvas');
    const capture = vi.fn();
    canvas.setPointerCapture = capture;
    // jsdom/Chromium lanzan NotFoundError con un id que no está activo.
    canvas.releasePointerCapture = () => {
      throw new DOMException('invalid pointer', 'NotFoundError');
    };

    canvas.dispatchEvent(
      pointer('pointerdown', { pointerId: 999, clientX: 10, clientY: 10 })
    );
    expect(capture).toHaveBeenCalledWith(999);
    expect(() =>
      canvas.dispatchEvent(
        pointer('pointerup', { pointerId: 999, clientX: 10, clientY: 10 })
      )
    ).not.toThrow();
    expect(scene.handlePointerSelect).toHaveBeenCalledTimes(1);

    canvas.setPointerCapture = () => {
      throw new DOMException('invalid pointer', 'NotFoundError');
    };
    canvas.dispatchEvent(pointer('pointerdown', { pointerId: 5 }));
    canvas.dispatchEvent(pointer('pointercancel', { pointerId: 5 }));
  });

  it('closes the panel with Escape and shows it for a selection', async () => {
    const state = TestBed.inject(ViewerStateService);
    const fixture = TestBed.createComponent(ViewerComponent);
    state.selected.set({
      id: 'sofa',
    });
    await localeReady();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(scene.clearSelection).toHaveBeenCalledTimes(1);
  });

  it('shows a retry banner for model errors and calls retry', async () => {
    const state = TestBed.inject(ViewerStateService);
    const retry = vi.fn();
    state.error.set({ code: 'model-load-failed', retry });
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'app-error-banner button'
    ) as HTMLButtonElement;
    button.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows the blocking overlay when WebGL is unavailable', async () => {
    const state = TestBed.inject(ViewerStateService);
    state.loadStatus.set('error');
    state.error.set({ code: 'webgl-unavailable' });
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-error-overlay')
    ).not.toBeNull();
    expect(scene.loadAll).not.toHaveBeenCalled();
  });

  it('does not select after a multi-touch gesture', async () => {
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    const canvas = fixture.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 })
    );
    canvas.dispatchEvent(
      pointer('pointerdown', { pointerId: 2, clientX: 160, clientY: 100 })
    );
    canvas.dispatchEvent(
      pointer('pointerup', { pointerId: 2, clientX: 160, clientY: 100 })
    );
    canvas.dispatchEvent(
      pointer('pointerup', { pointerId: 1, clientX: 100, clientY: 100 })
    );
    expect(scene.handlePointerSelect).not.toHaveBeenCalled();

    // After the gesture a plain tap selects again.
    canvas.dispatchEvent(
      pointer('pointerdown', { pointerId: 3, clientX: 50, clientY: 50 })
    );
    canvas.dispatchEvent(
      pointer('pointerup', { pointerId: 3, clientX: 50, clientY: 50 })
    );
    expect(scene.handlePointerSelect).toHaveBeenCalledTimes(1);
  });

  it('resets the gesture on pointercancel without selecting', async () => {
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    const canvas = fixture.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(
      pointer('pointerdown', { clientX: 100, clientY: 100 })
    );
    canvas.dispatchEvent(
      pointer('pointermove', { clientX: 150, clientY: 100 })
    );
    canvas.dispatchEvent(
      pointer('pointercancel', { clientX: 150, clientY: 100 })
    );
    canvas.dispatchEvent(pointer('pointerup', { clientX: 150, clientY: 100 }));
    expect(scene.handlePointerSelect).not.toHaveBeenCalled();

    canvas.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(pointer('pointerup', { clientX: 10, clientY: 10 }));
    expect(scene.handlePointerSelect).toHaveBeenCalledTimes(1);
  });

  it('returns to the initial view with the Home key on the canvas', async () => {
    const fixture = TestBed.createComponent(ViewerComponent);
    await fixture.whenStable();
    const canvas = fixture.nativeElement.querySelector('canvas');
    const event = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(event);
    expect(scene.clearSelection).toHaveBeenCalledTimes(1);
    expect(scene.resetView).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  describe('language', () => {
    const names = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('nav button.chip:not(.reset)')).map(b =>
        b.textContent?.trim()
      );

    it('lists the pieces sorted for the active language', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(names(el)).toEqual(
        [
          'Bookshelf',
          'Landscape painting',
          'Poker table',
          'Potted succulent',
          'Sectional sofa',
        ].sort((a, b) => a.localeCompare(b, 'en'))
      );

      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(names(el)).toEqual([
        'Cuadro de paisaje',
        'Estantería',
        'Mesa de póker',
        'Sofá rinconera',
        'Suculenta en maceta',
      ]);
    });

    it('translates the canvas label, brand and list in place', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const canvas = el.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.getAttribute('aria-label')).toBe(EN.canvasLabel);
      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(canvas.getAttribute('aria-label')).toBe(ES.canvasLabel);
      expect(el.querySelector('app-brand-label')?.textContent).toContain(
        ES.brand.byline
      );
      expect(el.querySelector('nav h2')?.textContent?.trim()).toBe(
        ES.list.title
      );
    });

    it('puts the switcher before the brand in the corner container', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const corner = (fixture.nativeElement as HTMLElement).querySelector(
        '.corner'
      ) as HTMLElement;
      expect(
        Array.from(corner.children).map(c => c.tagName.toLowerCase())
      ).toEqual(['app-language-switcher', 'app-brand-label']);
    });

    it('retitles an open sheet without closing it or moving focus', async () => {
      const state = TestBed.inject(ViewerStateService);
      state.selected.set({
        id: 'sofa',
      });
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const close = el.querySelector('button.close') as HTMLButtonElement;
      close.focus();
      el.querySelector<HTMLButtonElement>(
        'app-language-switcher button[lang="es"]'
      )!.click();
      await fixture.whenStable();
      expect(el.querySelector('#furniture-title')?.textContent).toContain(
        ES.furniture.sofa.name
      );
      expect(el.querySelector('#furniture-desc')?.textContent).toContain(
        ES.furniture.sofa.description
      );
      expect(el.querySelector('button.close')).toBe(close);
      expect(document.activeElement).toBe(close);
    });

    it('retranslates the open help sheet and a simulated error', async () => {
      localStorage.removeItem('room-tour.help-dismissed');
      const state = TestBed.inject(ViewerStateService);
      state.error.set({
        code: 'model-load-failed',
      });
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.sheet h2')?.textContent).toContain(
        EN.help.title
      );
      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(el.querySelector('.sheet h2')?.textContent).toContain(
        ES.help.title
      );
      expect(el.querySelector('app-error-banner')?.textContent).not.toContain(
        EN.errors.retry
      );
    });
  });

  describe('help panel (H3)', () => {
    beforeEach(() => localStorage.removeItem('room-tour.help-dismissed'));

    it('is dismissed by the first drag, not by a plain press', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const canvas = el.querySelector('canvas') as HTMLCanvasElement;
      expect(el.querySelector('.sheet')).not.toBeNull();

      canvas.dispatchEvent(
        pointer('pointerdown', { clientX: 10, clientY: 10 })
      );
      await fixture.whenStable();
      expect(el.querySelector('.sheet')).not.toBeNull();

      canvas.dispatchEvent(
        pointer('pointermove', { clientX: 60, clientY: 10 })
      );
      await fixture.whenStable();
      expect(el.querySelector('.sheet')).toBeNull();
      expect(localStorage.getItem('room-tour.help-dismissed')).toBe('1');
    });

    it('is dismissed by using the object list', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      (el.querySelector('nav button.chip') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(el.querySelector('.sheet')).toBeNull();
    });

    it('is dismissed by a navigation key but not by Tab', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const canvas = el.querySelector('canvas') as HTMLCanvasElement;
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      await fixture.whenStable();
      expect(el.querySelector('.sheet')).not.toBeNull();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      await fixture.whenStable();
      expect(el.querySelector('.sheet')).toBeNull();
    });
  });
});
