import { TestBed } from '@angular/core/testing';
import { ViewerError } from '../../services/viewer-state.service';
import { ErrorBannerComponent } from './error-banner.component';

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
