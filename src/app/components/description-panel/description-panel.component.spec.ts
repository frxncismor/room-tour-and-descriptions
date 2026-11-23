import { TestBed } from '@angular/core/testing';
import { FURNITURE_TEXT, FurnitureText } from '../../config/ui-text';
import { DescriptionPanelComponent } from './description-panel.component';

describe('DescriptionPanelComponent', () => {
  const info: FurnitureText = FURNITURE_TEXT['sofa'];

  it('renders a labelled dialog with a polite live region', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    fixture.componentRef.setInput('info', info);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe('furniture-title');
    expect(el.querySelector('#furniture-title')?.textContent).toContain(
      info.name
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
    expect(live.textContent).toContain(info.name);

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

describe('DescriptionPanelComponent motion', () => {
  it('disables its entrance animation under prefers-reduced-motion', async () => {
    const fixture = TestBed.createComponent(DescriptionPanelComponent);
    fixture.componentRef.setInput('info', FURNITURE_TEXT['sofa']);
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
