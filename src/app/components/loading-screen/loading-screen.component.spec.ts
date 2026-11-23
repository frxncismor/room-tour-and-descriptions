import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LOCALES } from '../../i18n/messages';
import { localeReady, provideLocale } from '../../i18n/testing';
import { ViewerStateService } from '../../services/viewer-state.service';
import { LoadingScreenComponent } from './loading-screen.component';

const DICTIONARY = { en: EN, es: ES };
const NBSP = ' ';

describe.each(LOCALES)('LoadingScreenComponent (%s)', locale => {
  const messages = DICTIONARY[locale];
  const space = locale === 'es' ? NBSP : '';

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale(locale)] });
    await localeReady();
  });

  it('exposes progress through a progressbar and hides when ready', async () => {
    const state = TestBed.inject(ViewerStateService);
    state.loadStatus.set('loading');
    state.loadProgress.set(42);
    const fixture = TestBed.createComponent(LoadingScreenComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuetext')).toBe(`42${space}%`);
    expect(bar.getAttribute('aria-label')).toBe(messages.loading.status);
    expect(el.querySelector('.loading.done')).toBeNull();

    state.loadStatus.set('ready');
    await fixture.whenStable();
    expect(el.querySelector('.loading.done')).not.toBeNull();
    expect(el.querySelector('.loading')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });

  it('shows the status with a localised percentage', async () => {
    const state = TestBed.inject(ViewerStateService);
    state.loadStatus.set('loading');
    state.loadProgress.set(7);
    const fixture = TestBed.createComponent(LoadingScreenComponent);
    await fixture.whenStable();
    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '.status'
    );
    expect(status?.textContent?.trim()).toBe(
      `${messages.loading.status} · 7${space}%`
    );
  });

  it('shows the project title and author while loading', async () => {
    const fixture = TestBed.createComponent(LoadingScreenComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain(
      messages.loading.title
    );
    expect(el.textContent).toContain(messages.loading.byline);
  });
});
