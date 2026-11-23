import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { LOCALES } from '../../i18n/messages';
import { localeReady, provideLocale } from '../../i18n/testing';
import { ViewerError } from '../../services/viewer-state.service';
import { ErrorOverlayComponent } from './error-overlay.component';

const DICTIONARY = { en: EN, es: ES };

describe.each(LOCALES)('ErrorOverlayComponent (%s)', locale => {
  const messages = DICTIONARY[locale];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale(locale)] });
    await localeReady();
  });

  async function render(error: ViewerError): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ErrorOverlayComponent);
    fixture.componentRef.setInput('error', error);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('explains WebGL being unavailable, with help', async () => {
    const el = await render({ code: 'webgl-unavailable' });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      messages.errors.webglTitle
    );
    expect(el.textContent).toContain(
      messages.errors.messages['webgl-unavailable']
    );
    expect(el.querySelector('.help')?.textContent?.trim()).toBe(
      messages.errors.webglHelp
    );
  });

  it.each(['webgl-context-lost', 'context-lost'])(
    'uses the context-lost title for %s, without the WebGL help',
    async code => {
      const el = await render({ code });
      expect(el.querySelector('h1')?.textContent?.trim()).toBe(
        messages.errors.contextLostTitle
      );
      expect(el.textContent).toContain(
        messages.errors.messages['context-lost']
      );
      expect(el.querySelector('.help')).toBeNull();
    }
  );

  it('is announced as an alert', async () => {
    const el = await render({ code: 'render-failed' });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('ErrorOverlayComponent live language change', () => {
  it('retranslates title and message', async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
    const fixture = TestBed.createComponent(ErrorOverlayComponent);
    fixture.componentRef.setInput('error', {
      code: 'webgl-unavailable',
    });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain(EN.errors.webglTitle);
    await TestBed.inject(LocaleService).use('es', {
      persist: false,
      announce: false,
    });
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain(ES.errors.webglTitle);
    expect(el.textContent).toContain(ES.errors.messages['webgl-unavailable']);
  });
});
