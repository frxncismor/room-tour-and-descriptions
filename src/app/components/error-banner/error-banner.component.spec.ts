import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { LOCALES } from '../../i18n/messages';
import { localeReady, provideLocale } from '../../i18n/testing';
import { ViewerError } from '../../services/viewer-state.service';
import { ErrorBannerComponent } from './error-banner.component';

const DICTIONARY = { en: EN, es: ES };

describe.each(LOCALES)('ErrorBannerComponent (%s)', locale => {
  const messages = DICTIONARY[locale];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale(locale)] });
    await localeReady();
  });

  function create(error: ViewerError) {
    const fixture = TestBed.createComponent(ErrorBannerComponent);
    fixture.componentRef.setInput('error', error);
    return fixture;
  }

  const messageOf = (root: HTMLElement) =>
    root.querySelector('[role="alert"] .message')?.textContent?.trim();

  it('emits retry when the button is clicked', async () => {
    const fixture = create({ code: 'model-load-failed' });
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button'
    ) as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe(messages.errors.retry);
    button.click();
    expect(retries).toBe(1);
  });

  it.each([
    'context-lost',
    'webgl-unavailable',
    'render-failed',
    'locale-load-failed',
  ] as const)('translates the code %s', async code => {
    const fixture = create({ code });
    await fixture.whenStable();
    expect(messageOf(fixture.nativeElement)).toBe(
      messages.errors.messages[code]
    );
  });

  it('names the assets that failed to load', async () => {
    const fixture = create({
      code: 'model-load-failed',
      params: { names: ['rug', 'clock'] },
    } as ViewerError);
    await fixture.whenStable();
    const text = messageOf(fixture.nativeElement);
    expect(text).toContain(messages.assets.rug);
    expect(text).toContain(messages.assets.clock);
  });

  it('falls back to the generic text for an unknown code', async () => {
    const fixture = create({ code: 'weird' });
    await fixture.whenStable();
    expect(messageOf(fixture.nativeElement)).toBe(
      messages.errors.messages['render-failed']
    );
  });
});

describe('ErrorBannerComponent live language change', () => {
  it('retranslates the visible error', async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
    const fixture = TestBed.createComponent(ErrorBannerComponent);
    fixture.componentRef.setInput('error', {
      code: 'render-failed',
    });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.message')?.textContent).toContain(
      EN.errors.messages['render-failed']
    );
    await TestBed.inject(LocaleService).use('es', {
      persist: false,
      announce: false,
    });
    await fixture.whenStable();
    expect(el.querySelector('.message')?.textContent).toContain(
      ES.errors.messages['render-failed']
    );
    expect(el.querySelector('button')?.textContent?.trim()).toBe(
      ES.errors.retry
    );
  });
});
