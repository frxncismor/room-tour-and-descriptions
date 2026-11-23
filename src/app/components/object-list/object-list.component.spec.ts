import { TestBed } from '@angular/core/testing';
import { EN } from '../../i18n/en';
import ES from '../../i18n/es';
import { LocaleService } from '../../i18n/locale.service';
import { localeReady, provideLocale } from '../../i18n/testing';
import { ObjectListComponent } from './object-list.component';

describe('ObjectListComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocale('en')] });
    await localeReady();
  });

  it('lists furniture and emits selection and reset', async () => {
    const sofa = EN.furniture.sofa.name;
    const bookshelf = EN.furniture.bookshelf.name;
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: sofa },
      { id: 'bookshelf', name: bookshelf },
    ]);
    fixture.componentRef.setInput('selectedId', 'bookshelf');
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
      EN.list.resetView,
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
      { id: 'sofa', name: EN.furniture.sofa.name },
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
      { id: 'sofa', name: EN.furniture.sofa.name },
    ]);
    await fixture.whenStable();
    const reset = (fixture.nativeElement as HTMLElement).querySelector(
      'button.chip.reset'
    ) as HTMLElement;
    const visible = reset.textContent!.trim().toLowerCase();
    const name = reset.getAttribute('aria-label')!.toLowerCase();
    expect(visible).toBe(EN.list.resetView.toLowerCase());
    expect(name.startsWith(visible)).toBe(true);
  });

  it('renders a text index with a header and no pill styling', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: EN.furniture.sofa.name },
    ]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(EN.list.title);
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
        { id: 'sofa', name: EN.furniture.sofa.name },
        { id: 'bookshelf', name: EN.furniture.bookshelf.name },
      ]);
      fixture.componentRef.setInput('selectedId', 'bookshelf');
      await fixture.whenStable();
      await Promise.resolve();
      expect(scroll).toHaveBeenCalled();
    } finally {
      proto.scrollIntoView = original;
    }
  });

  it('translates its texts and keeps the active chip by id when the language changes', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    fixture.componentRef.setInput('items', [
      { id: 'bookshelf', name: EN.furniture.bookshelf.name },
      { id: 'sofa', name: EN.furniture.sofa.name },
    ]);
    fixture.componentRef.setInput('selectedId', 'sofa');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    await TestBed.inject(LocaleService).setLocale('es');
    fixture.componentRef.setInput('items', [
      { id: 'sofa', name: ES.furniture.sofa.name },
      { id: 'bookshelf', name: ES.furniture.bookshelf.name },
    ]);
    await fixture.whenStable();
    expect(el.querySelector('nav')!.getAttribute('aria-label')).toBe(
      ES.list.title
    );
    expect(el.querySelector('h2')?.textContent?.trim()).toBe(ES.list.title);
    expect(el.querySelector('button.reset')!.getAttribute('aria-label')).toBe(
      ES.list.resetViewLabel
    );
    const pressed = el.querySelector('.chip[aria-pressed="true"]')!;
    expect(pressed.textContent?.trim()).toBe(ES.furniture.sofa.name);
  });

  it('keeps the focus inside the list when the pieces are reordered', async () => {
    const fixture = TestBed.createComponent(ObjectListComponent);
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.componentRef.setInput('items', [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      el.querySelector<HTMLElement>('.chip[data-id="b"]')!.focus();
      fixture.componentRef.setInput('items', [
        { id: 'b', name: 'B' },
        { id: 'a', name: 'A' },
      ]);
      await fixture.whenStable();
      await Promise.resolve();
      expect(el.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.getAttribute('data-id')).toBe('b');
    } finally {
      fixture.nativeElement.remove();
    }
  });
});
