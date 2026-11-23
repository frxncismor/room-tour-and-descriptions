import { TestBed } from '@angular/core/testing';
import { FURNITURE_TEXT, FurnitureText } from '../config/ui-text';
import {
  ViewerError,
  ViewerStateService,
} from '../services/viewer-state.service';
import { DescriptionPanelComponent } from './description-panel/description-panel.component';
import { ErrorBannerComponent } from './error-banner/error-banner.component';
import {
  HELP_STORAGE_KEY,
  HelpPanelComponent,
} from './help-panel/help-panel.component';
import { LoadingScreenComponent } from './loading-screen/loading-screen.component';
import { ObjectListComponent } from './object-list/object-list.component';

describe('LoadingScreenComponent', () => {
  it('exposes progress through a progressbar and hides when ready', async () => {
    const state = TestBed.inject(ViewerStateService);
    state.loadStatus.set('loading');
    state.loadProgress.set(42);
    const fixture = TestBed.createComponent(LoadingScreenComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(el.querySelector('.loading.done')).toBeNull();

    state.loadStatus.set('ready');
    await fixture.whenStable();
    expect(el.querySelector('.loading.done')).not.toBeNull();
    expect(el.querySelector('.loading')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });
});

describe('ErrorBannerComponent', () => {
  it('emits retry when the button is clicked', async () => {
    const fixture = TestBed.createComponent(ErrorBannerComponent);
    const error: ViewerError = { code: 'model-load-failed', message: 'Boom' };
    fixture.componentRef.setInput('error', error);
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Boom');
    (el.querySelector('button') as HTMLButtonElement).click();
    expect(retries).toBe(1);
  });
});

describe('DescriptionPanelComponent', () => {
  const info: FurnitureText = FURNITURE_TEXT['sofa'];

  it('renders a labelled dialog with a polite live region', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    fixture.componentRef.setInput('info', info);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe('furniture-title');
    expect(el.querySelector('#furniture-title')?.textContent).toContain(
      info.name
    );
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('emits closed from the close button and renders nothing without info', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    fixture.componentRef.setInput('info', info);
    await fixture.whenStable();
    (el.querySelector('button.close') as HTMLButtonElement).click();
    expect(closed).toBe(1);
  });
});

describe('ObjectListComponent', () => {
  it('lists furniture and emits selection and reset', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: 'Modern Sofa' },
      { id: 'bookshelf', name: 'Bookshelf' },
    ]);
    fixture.componentRef.setInput('selectedName', 'Bookshelf');
    const selected: string[] = [];
    let resets = 0;
    fixture.componentInstance.selectItem.subscribe(id => selected.push(id));
    fixture.componentInstance.resetView.subscribe(() => resets++);
    await fixture.whenStable();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    );
    expect(buttons.map(b => b.textContent?.trim())).toEqual([
      'Modern Sofa',
      'Bookshelf',
      'Initial view',
    ]);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    buttons[0].click();
    buttons[2].click();
    expect(selected).toEqual(['sofa']);
    expect(resets).toBe(1);
  });
});

describe('HelpPanelComponent', () => {
  beforeEach(() => localStorage.removeItem(HELP_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(HELP_STORAGE_KEY));

  it('remembers dismissal and can be reopened', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sheet')).not.toBeNull();

    (el.querySelector('.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('.sheet')).toBeNull();
    expect(localStorage.getItem(HELP_STORAGE_KEY)).toBe('1');

    (el.querySelector('.reopen') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('.sheet')).not.toBeNull();
  });

  it('is a non-modal labelled dialog that does not steal focus', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const sheet = (fixture.nativeElement as HTMLElement).querySelector(
      '.sheet'
    ) as HTMLElement;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('false');
    const title = document.getElementById(
      sheet.getAttribute('aria-labelledby') ?? ''
    );
    expect(title?.textContent).toContain('How to explore');
    expect(sheet.contains(document.activeElement)).toBe(false);
  });

  it('moves focus to the reopen button when closed', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('.reopen'));
    fixture.nativeElement.remove();
  });

  it('starts closed when it was dismissed before', async () => {
    localStorage.setItem(HELP_STORAGE_KEY, '1');
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.sheet')
    ).toBeNull();
  });
});
