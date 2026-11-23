import { TestBed } from '@angular/core/testing';
import { UI_TEXT } from '../../config/ui-text';
import { HELP_STORAGE_KEY, HelpPanelComponent } from './help-panel.component';

describe('HelpPanelComponent', () => {
  const [look, , zoom] = UI_TEXT.help.controls;

  beforeEach(() => localStorage.clear());
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

  it('talks about fingers and taps on touch devices', async () => {
    stubPointer(true);
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(look.touchText);
    expect(text).toContain(zoom.touchText);
    expect(text).not.toMatch(/mouse|wheel|click/i);
    const terms = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('dt')
    ).map(dt => dt.textContent?.trim());
    expect(terms).toContain('Close');
    expect(terms).not.toContain('Keys');
  });

  it('talks about mouse and keyboard on desktop', async () => {
    stubPointer(false);
    const fixture = TestBed.createComponent(HelpPanelComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(look.text);
    expect(text).not.toMatch(/finger|pinch|tap/i);
    expect(text).toContain('Keys');
  });

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
    expect(title?.textContent).toContain(UI_TEXT.help.title);
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
    expect(el.querySelectorAll('dl dt').length).toBe(
      UI_TEXT.help.controls.length
    );
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
