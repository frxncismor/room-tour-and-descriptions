import { TestBed } from '@angular/core/testing';
import { localeReady, provideLocale } from '../../i18n/testing';
import { LocaleService } from '../../i18n/locale.service';
import { LanguageSwitcherComponent } from './language-switcher.component';

describe('LanguageSwitcherComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('room-tour.locale');
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
  });
  afterEach(() => localStorage.removeItem('room-tour.locale'));

  async function create() {
    await localeReady();
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button'));
    return { fixture, el, buttons };
  }

  it('renders a labelled group with two autonym buttons', async () => {
    const { el, buttons } = await create();
    const group = el.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Language');
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['EN', 'ES']);
    expect(buttons.map(b => b.getAttribute('lang'))).toEqual(['en', 'es']);
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
      'EN, English',
      'ES, Español',
    ]);
    expect(buttons.every(b => b.type === 'button')).toBe(true);
    expect(buttons.map(b => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);
  });

  it('switches the locale on click without moving focus', async () => {
    const { fixture, el, buttons } = await create();
    const service = TestBed.inject(LocaleService);
    buttons[1].focus();
    buttons[1].click();
    await fixture.whenStable();
    expect(service.locale()).toBe('es');
    expect(buttons.map(b => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
    ]);
    expect(document.activeElement).toBe(buttons[1]);
    expect(el.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe(
      'Idioma'
    );
  });

  it('announces only after a change, not on creation', async () => {
    const { fixture, el, buttons } = await create();
    const status = el.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('');
    buttons[1].click();
    await fixture.whenStable();
    expect(status.textContent?.trim()).toBe('Idioma: español');
  });

  it('does nothing when the active language is chosen again', async () => {
    const { fixture, el, buttons } = await create();
    buttons[0].click();
    await fixture.whenStable();
    expect(
      (el.querySelector('[role="status"]') as HTMLElement).textContent?.trim()
    ).toBe('');
  });

  it('is operable with the keyboard (native buttons) and drops transitions under reduced motion', async () => {
    const { buttons } = await create();
    expect(buttons.every(b => b.tabIndex === 0)).toBe(true);
    const css = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*transition: none/
    );
  });
});
