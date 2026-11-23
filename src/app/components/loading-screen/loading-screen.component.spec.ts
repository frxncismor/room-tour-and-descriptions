import { TestBed } from '@angular/core/testing';
import { UI_TEXT } from '../../config/ui-text';
import { ViewerStateService } from '../../services/viewer-state.service';
import { LoadingScreenComponent } from './loading-screen.component';

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

  it('shows the status with a tabular percentage', async () => {
    const state = TestBed.inject(ViewerStateService);
    state.loadStatus.set('loading');
    state.loadProgress.set(7);
    const fixture = TestBed.createComponent(LoadingScreenComponent);
    await fixture.whenStable();
    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '.status'
    );
    expect(status?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${UI_TEXT.loading.status} · 7%`
    );
  });

  it('shows the project title and author while loading', async () => {
    const fixture = TestBed.createComponent(LoadingScreenComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain(
      UI_TEXT.loading.title
    );
    expect(el.textContent).toContain(UI_TEXT.loading.byline);
  });
});
