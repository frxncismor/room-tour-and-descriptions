import {
  ComponentFixture,
  DeferBlockState,
  TestBed,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ObjectListComponent } from '../object-list/object-list.component';
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
      { id: 'roundTable', name: EN.furniture.roundTable.name },
      { id: 'landscapePainting', name: EN.furniture.landscapePainting.name },
    ]),
    handlePointerSelect: vi.fn(() => Promise.resolve()),
    handlePointerMove: vi.fn(),
    clearSelection: vi.fn(),
    selectObject: vi.fn(),
    resetView: vi.fn(),
    retryLoad: vi.fn(() => Promise.resolve()),
    viewSurface: vi.fn(),
    stepSurfaceSection: vi.fn(),
  };

  beforeEach(() => {
    Object.values(scene).forEach(fn => fn.mockClear());
    localStorage.setItem('room-tour.help-dismissed', '1');
    TestBed.configureTestingModule({
      imports: [ViewerComponent],
      providers: [
        { provide: SceneService, useValue: scene },
        provideLocale('en'),
      ],
    });
  });

  beforeEach(async () => {
    // `@defer` (la lista): sus dependencias se resuelven de forma asíncrona.
    await TestBed.compileComponents();
    await localeReady();
  });

  afterEach(() => localStorage.removeItem('room-tour.help-dismissed'));

  /** Lista, ficha y avisos van en `@defer (on idle)`: se fuerza a mostrarlos. */
  async function showList(fixture: ComponentFixture<ViewerComponent>) {
    await fixture.whenStable();
    for (const block of await fixture.getDeferBlocks()) {
      await block.render(DeferBlockState.Complete);
    }
    await fixture.whenStable();
  }

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
    await showList(fixture);
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
    await showList(fixture);
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
    await showList(fixture);
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
      await showList(fixture);
      const el = fixture.nativeElement as HTMLElement;
      // La lista arranca plegada: se abre el grupo para ver las piezas.
      el.querySelector<HTMLElement>('nav .gh')!.click();
      await fixture.whenStable();
      expect(names(el)).toEqual(
        [
          'Bookshelf',
          'Landscape painting',
          'Round table',
          'Potted succulent',
          'Sectional sofa',
        ].sort((a, b) => a.localeCompare(b, 'en'))
      );

      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(names(el)).toEqual([
        'Cuadro de paisaje',
        'Estantería',
        'Mesa redonda',
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
      await showList(fixture);
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
      await showList(fixture);
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

  describe('grouped list and surfaces (spec 004 D, E)', () => {
    it('passes the five current furniture as one group, with no «View wall» yet', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      await showList(fixture);
      const el = fixture.nativeElement as HTMLElement;
      const groups = Array.from(el.querySelectorAll('button.gh'));
      expect(groups.map(g => g.getAttribute('data-group'))).toEqual([
        'greenWall',
      ]);
      expect(el.querySelector('.wallview')).toBeNull();
    });

    it('routes «View wall» to the scene and counts it as use of the list', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      await showList(fixture);
      const list = fixture.debugElement.query(By.directive(ObjectListComponent))
        .componentInstance as ObjectListComponent;
      list.viewSurface.emit('wallTv');
      expect(scene.viewSurface).toHaveBeenCalledWith('wallTv');
    });

    it('does not fail when the scene has no surface support yet', async () => {
      const { viewSurface, stepSurfaceSection, ...bare } = scene;
      void viewSurface;
      void stepSurfaceSection;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ViewerComponent],
        providers: [
          { provide: SceneService, useValue: bare },
          provideLocale('en'),
        ],
      });
      await TestBed.compileComponents();
      await localeReady();
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      await showList(fixture);
      const list = fixture.debugElement.query(By.directive(ObjectListComponent))
        .componentInstance as ObjectListComponent;
      expect(() => list.viewSurface.emit('wallTv')).not.toThrow();
    });

    it('steps through the sections of a framed wall with PageDown / PageUp', async () => {
      const state = TestBed.inject(ViewerStateService);
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const canvas = fixture.nativeElement.querySelector('canvas');
      const press = (key: string) =>
        canvas.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        );
      press('PageDown');
      expect(scene.stepSurfaceSection).not.toHaveBeenCalled();
      state.selectedKind.set('surface');
      state.surfaceTramo.set({ tramo: 1, count: 2 });
      press('PageDown');
      press('PageUp');
      expect(scene.stepSurfaceSection.mock.calls).toEqual([[1], [-1]]);
    });

    it('also steps when the focus is still on the list after «View wall» (R9-M4)', async () => {
      const state = TestBed.inject(ViewerStateService);
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      state.selectedKind.set('surface');
      state.surfaceTramo.set({ tramo: 1, count: 2 });
      const button = document.createElement('button');
      const field = document.createElement('input');
      fixture.nativeElement.append(button, field);
      const press = (target: HTMLElement) => {
        const event = new KeyboardEvent('keydown', {
          key: 'PageDown',
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(press(button)).toBe(true);
      expect(scene.stepSurfaceSection.mock.calls).toEqual([[1]]);
      // En un campo de texto no se intercepta.
      expect(press(field)).toBe(false);
      // Con un solo tramo no hay nada que recorrer: la lista se desplaza.
      state.surfaceTramo.set({ tramo: 1, count: 1 });
      expect(press(button)).toBe(false);
      expect(scene.stepSurfaceSection).toHaveBeenCalledTimes(1);
    });

    it('leaves PageDown / PageUp to scrollable containers and the help dialog (R10-M1)', async () => {
      const state = TestBed.inject(ViewerStateService);
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      state.selectedKind.set('surface');
      state.surfaceTramo.set({ tramo: 1, count: 2 });
      const scroller = document.createElement('div');
      scroller.style.overflowY = 'auto';
      Object.defineProperty(scroller, 'scrollHeight', {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scroller, 'clientHeight', { value: 100 });
      const inner = document.createElement('p');
      inner.tabIndex = 0;
      scroller.append(inner);
      const dialog = document.createElement('app-help-panel');
      const help = document.createElement('button');
      dialog.append(help);
      fixture.nativeElement.append(scroller, dialog);
      const press = (target: HTMLElement) => {
        const event = new KeyboardEvent('keydown', {
          key: 'PageDown',
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(press(inner)).toBe(false);
      expect(press(help)).toBe(false);
      expect(scene.stepSurfaceSection).not.toHaveBeenCalled();
      // Con el contenido sin desbordar sí se recorren los tramos.
      Object.defineProperty(scroller, 'scrollHeight', {
        value: 100,
        configurable: true,
      });
      expect(press(inner)).toBe(true);
      expect(scene.stepSurfaceSection).toHaveBeenCalledTimes(1);
    });

    it('keeps stepping from a scrollable list right after «View wall» until another key or click (R9-M4, R10-M1)', async () => {
      const state = TestBed.inject(ViewerStateService);
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      await localeReady();
      await showList(fixture);
      const list = fixture.debugElement.query(By.directive(ObjectListComponent))
        .componentInstance as ObjectListComponent;
      const scroller = document.createElement('div');
      scroller.style.overflowY = 'auto';
      Object.defineProperty(scroller, 'scrollHeight', {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scroller, 'clientHeight', { value: 100 });
      const button = document.createElement('button');
      scroller.append(button);
      fixture.nativeElement.append(scroller);
      const key = (k: string) => {
        const event = new KeyboardEvent('keydown', {
          key: k,
          bubbles: true,
          cancelable: true,
        });
        button.dispatchEvent(event);
        return event.defaultPrevented;
      };
      list.viewSurface.emit('wallTv');
      state.selectedKind.set('surface');
      state.surfaceTramo.set({ tramo: 1, count: 2 });
      expect(key('PageDown')).toBe(true);
      key('ArrowDown'); // otra tecla: la lista vuelve a desplazarse
      expect(key('PageDown')).toBe(false);
    });
  });

  describe('viewer container clipping (FR-430)', () => {
    it('clips instead of only hiding, keeping hidden as the fallback', async () => {
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const css = Array.from(document.querySelectorAll('style'))
        .map(style => style.textContent ?? '')
        .join('\n');
      const rule = /\.viewer-container(?:\[[^\]]*\])*\s*\{([^}]*)\}/.exec(css);
      expect(rule).not.toBeNull();
      const body = rule![1];
      expect(body.indexOf('overflow: hidden')).toBeGreaterThan(-1);
      expect(body.indexOf('overflow: clip')).toBeGreaterThan(
        body.indexOf('overflow: hidden')
      );
      const container =
        fixture.nativeElement.querySelector('.viewer-container');
      expect(['hidden', 'clip']).toContain(
        getComputedStyle(container).overflow
      );
    });

    it('does not scroll the container when the list reveals the active piece', async () => {
      const state = TestBed.inject(ViewerStateService);
      const fixture = TestBed.createComponent(ViewerComponent);
      await fixture.whenStable();
      const container = fixture.nativeElement.querySelector(
        '.viewer-container'
      ) as HTMLElement;
      const scrollIntoView = vi.fn();
      (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView =
        scrollIntoView;
      try {
        state.selected.set({ id: 'bookshelf' });
        await fixture.whenStable();
        await Promise.resolve();
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(container.scrollTop).toBe(0);
        expect(container.scrollLeft).toBe(0);
      } finally {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown })
          .scrollIntoView;
      }
    });
  });
});
