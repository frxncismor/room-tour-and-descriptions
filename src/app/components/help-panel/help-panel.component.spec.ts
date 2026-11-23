import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { LOCALES } from '../../i18n/messages';
import { localeReady, provideLocale } from '../../i18n/testing';
import { HELP_STORAGE_KEY, HelpPanelComponent } from './help-panel.component';

const DICTIONARY = { en: EN, es: ES };

describe.each(LOCALES)('HelpPanelComponent (%s)', locale => {
  const help = DICTIONARY[locale].help;
  const [look, , zoom] = help.controls;
  const keys = help.controls[5];

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideLocale(locale)] });
    await localeReady();
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function stubPointer(coarse: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: coarse && query.includes('coarse'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  }

  const terms = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('dt')).map(dt => dt.textContent?.trim());
  const definitions = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('dd')).map(dd => dd.textContent?.trim());

  it('shows the touch wording on touch devices', async () => {
    stubPointer(true);
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(definitions(el)).toEqual(help.controls.map(c => c.touchText));
    for (const control of help.controls) {
      expect(definitions(el)).not.toContain(control.text);
    }
    expect(el.textContent).toContain(look.touchText);
    expect(el.textContent).toContain(zoom.touchText);
    expect(terms(el)).toContain(keys.touchLabel);
    expect(terms(el)).not.toContain(keys.label);
  });

  it('shows the mouse and keyboard wording on desktop', async () => {
    stubPointer(false);
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(definitions(el)).toEqual(help.controls.map(c => c.text));
    expect(terms(el)).toEqual(help.controls.map(c => c.label));
    expect(el.textContent).toContain(look.text);
  });

  it('remembers dismissal and can be reopened', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sheet')).not.toBeNull();
    expect(el.querySelector('.primary')?.textContent?.trim()).toBe(help.gotIt);

    (el.querySelector('.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('.sheet')).toBeNull();
    expect(localStorage.getItem(HELP_STORAGE_KEY)).toBe('1');
    const reopen = el.querySelector('.reopen') as HTMLButtonElement;
    expect(reopen.textContent?.trim()).toBe(help.open);
    expect(reopen.getAttribute('aria-label')).toBe(help.openLabel);

    reopen.click();
    await fixture.whenStable();
    expect(el.querySelector('.sheet')).not.toBeNull();
    expect(localStorage.getItem(HELP_STORAGE_KEY)).toBeNull();
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
    expect(title?.textContent).toContain(help.title);
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

  it('is dismissed and remembered once the user has navigated', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sheet')).not.toBeNull();

    fixture.componentRef.setInput('seen', true);
    await fixture.whenStable();
    expect(el.querySelector('.sheet')).toBeNull();
    expect(localStorage.getItem(HELP_STORAGE_KEY)).toBe('1');
  });

  it('does not come back when a selection is closed', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    fixture.componentRef.setInput('suppressed', true);
    await fixture.whenStable();
    fixture.componentRef.setInput('suppressed', false);
    await fixture.whenStable();
    expect(el.querySelector('.sheet')).toBeNull();
    expect(el.querySelector('.reopen')).not.toBeNull();
  });

  it('lists the controls as definitions, without icons', async () => {
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('dl dt').length).toBe(help.controls.length);
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelectorAll('[data-keyboard]').length).toBe(1);
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

describe('HelpPanelComponent live language change', () => {
  it('retranslates the open sheet', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain(EN.help.title);
    await TestBed.inject(LocaleService).use('es', {
      persist: false,
      announce: false,
    });
    await fixture.whenStable();
    expect(el.querySelector('h2')?.textContent).toContain(ES.help.title);
    expect(el.querySelector('dt')?.textContent?.trim()).toBe(
      ES.help.controls[0].label
    );
    localStorage.clear();
  });
});
