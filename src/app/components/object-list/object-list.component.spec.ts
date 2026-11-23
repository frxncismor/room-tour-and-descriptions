import { TestBed } from '@angular/core/testing';
import { FURNITURE_TEXT, UI_TEXT } from '../../config/ui-text';
import { ObjectListComponent } from './object-list.component';

describe('ObjectListComponent', () => {
  it('lists furniture and emits selection and reset', async () => {
    const sofa = FURNITURE_TEXT.sofa.name;
    const bookshelf = FURNITURE_TEXT.bookshelf.name;
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: sofa },
      { id: 'bookshelf', name: bookshelf },
    ]);
    fixture.componentRef.setInput('selectedName', bookshelf);
    const selected: string[] = [];
    let resets = 0;
    fixture.componentInstance.selectItem.subscribe(id => selected.push(id));
    fixture.componentInstance.resetView.subscribe(() => resets++);
    await fixture.whenStable();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    );
    expect(buttons.map(b => b.textContent?.trim())).toEqual([
      sofa,
      bookshelf,
      UI_TEXT.list.resetView,
    ]);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    buttons[0].click();
    buttons[2].click();
    expect(selected).toEqual(['sofa']);
    expect(resets).toBe(1);
  });

  it('renders the initial view as a secondary icon button after the furniture', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: FURNITURE_TEXT.sofa.name },
    ]);
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav')!;
    const reset = nav.querySelector('li:last-child > button') as HTMLElement;
    expect(reset.classList.contains('reset')).toBe(true);
    expect(reset.querySelector('svg')).not.toBeNull();
    expect(reset.getAttribute('aria-label')).toBeTruthy();
    expect(nav.querySelectorAll('.chip.reset').length).toBe(1);
  });

  it('keeps the visible text inside the reset accessible name (WCAG 2.5.3)', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: FURNITURE_TEXT.sofa.name },
    ]);
    await fixture.whenStable();
    const reset = (fixture.nativeElement as HTMLElement).querySelector(
      'button.chip.reset'
    ) as HTMLElement;
    const visible = reset.textContent!.trim().toLowerCase();
    const name = reset.getAttribute('aria-label')!.toLowerCase();
    expect(visible).toBe(UI_TEXT.list.resetView.toLowerCase());
    expect(name.startsWith(visible)).toBe(true);
  });

  it('renders a text index with a header and no pill styling', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: FURNITURE_TEXT.sofa.name },
    ]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(
      UI_TEXT.list.title
    );
    expect(el.querySelectorAll('ul > li').length).toBe(2);
  });

  it('scrolls the active piece into view', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    const scroll = vi.fn();
    const proto = HTMLElement.prototype as { scrollIntoView?: unknown };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = scroll;
    try {
      fixture.componentRef.setInput('items', [
        { id: 'sofa', name: FURNITURE_TEXT.sofa.name },
        { id: 'bookshelf', name: FURNITURE_TEXT.bookshelf.name },
      ]);
      fixture.componentRef.setInput(
        'selectedName',
        FURNITURE_TEXT.bookshelf.name
      );
      await fixture.whenStable();
      await Promise.resolve();
      expect(scroll).toHaveBeenCalled();
    } finally {
      proto.scrollIntoView = original;
    }
  });
});
