import { TestBed } from '@angular/core/testing';
import { UI_TEXT } from '../../config/ui-text';
import { BrandLabelComponent } from './brand-label.component';

describe('BrandLabelComponent', () => {
  it('renders the title and byline without interactive elements', async () => {
    const fixture = TestBed.createComponent(BrandLabelComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(UI_TEXT.brand.title);
    expect(el.textContent).toContain(UI_TEXT.brand.byline);
    expect(el.querySelector('button, a')).toBeNull();
  });
});
