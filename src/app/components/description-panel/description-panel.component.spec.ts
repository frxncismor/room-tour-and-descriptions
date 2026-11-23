import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { localeReady, provideLocale } from '../../i18n/testing';
import { DescriptionPanelComponent } from './description-panel.component';

describe('DescriptionPanelComponent', () => {
  const info = { id: 'sofa' } as const;
  const text = EN.furniture.sofa;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
  });

  it('renders a labelled dialog with a polite live region', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    fixture.componentRef.setInput('info', info);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe('furniture-title');
    expect(el.querySelector('#furniture-title')?.textContent).toContain(
      text.name
    );
  });

  it('keeps a persistent polite live region that announces the piece', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const live = el.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).not.toBeNull();
    expect(live.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('info', info);
    await fixture.whenStable();
    expect(el.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live.textContent).toContain(text.name);

    fixture.componentRef.setInput('info', null);
    await fixture.whenStable();
    expect(el.querySelector('[aria-live="polite"]')).toBe(live);
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

describe('DescriptionPanelComponent language', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
  });

  it('retranslates title, text, credit and close label while open, keeping focus', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.componentRef.setInput('info', { id: 'sofa' });
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const close = el.querySelector('button.close') as HTMLButtonElement;
      close.focus();
      expect(close.getAttribute('aria-label')).toBe(EN.panel.close);
      expect(el.querySelector('.credit')?.textContent).toContain(
        EN.furniture.sofa.details
      );

      await TestBed.inject(LocaleService).setLocale('es');
      await fixture.whenStable();
      expect(el.querySelector('#furniture-title')?.textContent).toContain(
        ES.furniture.sofa.name
      );
      expect(el.querySelector('#furniture-desc')?.textContent).toContain(
        ES.furniture.sofa.description
      );
      expect(el.querySelector('.credit')?.textContent).toContain(
        ES.furniture.sofa.details
      );
      expect(el.querySelector('button.close')).toBe(close);
      expect(close.getAttribute('aria-label')).toBe(ES.panel.close);
      expect(document.activeElement).toBe(close);
      expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(
        ES.furniture.sofa.name
      );
    } finally {
      fixture.nativeElement.remove();
    }
  });
});

describe('DescriptionPanelComponent motion', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
  });

  it('disables its entrance animation under prefers-reduced-motion', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    fixture.componentRef.setInput('info', { id: 'sofa' });
    await fixture.whenStable();
    const css = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ');
    // Presence of the rules only: durations and easing are tokenised (plan R1).
    expect(css).toMatch(/animation:[^;]*panel-in/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none/
    );
  });
});
