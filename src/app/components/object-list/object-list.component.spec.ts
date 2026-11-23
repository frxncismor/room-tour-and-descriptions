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
    const reset = nav.lastElementChild as HTMLElement;
    expect(reset.classList.contains('reset')).toBe(true);
    expect(reset.querySelector('svg')).not.toBeNull();
    expect(reset.getAttribute('aria-label')).toBeTruthy();
    expect(nav.querySelectorAll('.chip.reset').length).toBe(1);
  });
});
