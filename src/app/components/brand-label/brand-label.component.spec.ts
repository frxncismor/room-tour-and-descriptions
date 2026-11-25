import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { localeReady, provideLocale } from '../../i18n/testing';
import { BrandLabelComponent } from './brand-label.component';

describe('BrandLabelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
  });

  it('renders the title and byline without interactive elements', async () => {
    await localeReady();
    const fixture = TestBed.createComponent(BrandLabelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(EN.brand.title);
    expect(el.textContent).toContain(EN.brand.byline);
    expect(el.querySelector('button, a')).toBeNull();
  });

  it('follows the active language and does not position itself', async () => {
    await localeReady();
    const fixture = TestBed.createComponent(BrandLabelComponent);
    await fixture.whenStable();
    await TestBed.inject(LocaleService).setLocale('es');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(ES.brand.byline);
    const css = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .join(' ');
    expect(css).not.toMatch(/\.brand\s*\{[^}]*position:\s*absolute/);
  });
});
