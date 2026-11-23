import { collator, fill, list, pct } from './format';

describe('format', () => {
  it('pct: EN without space, ES with a no-break space', () => {
    expect(pct(7, 'en')).toBe('7%');
    expect(pct(7, 'es')).toBe('7 %');
    expect(pct(100, 'es')).toBe('100 %');
  });

  it('pct rounds to whole numbers', () => {
    expect(pct(33.4, 'en')).toBe('33%');
  });

  it('list joins with the language conjunction', () => {
    expect(list(['Poker table', 'Wall prints'], 'en')).toBe(
      'Poker table and Wall prints'
    );
    expect(list(['Mesa de póker', 'Láminas'], 'es')).toBe(
      'Mesa de póker y Láminas'
    );
    expect(list(['A'], 'es')).toBe('A');
  });

  it('fill replaces known keys and keeps unknown ones', () => {
    expect(fill('Could not load: {names}.', { names: 'X' })).toBe(
      'Could not load: X.'
    );
    expect(fill('{a} {b}', { a: '1' })).toBe('1 {b}');
  });

  it('collator orders by language', () => {
    const es = ['Suculenta', 'Sofá', 'Estantería'].sort(collator('es').compare);
    expect(es).toEqual(['Estantería', 'Sofá', 'Suculenta']);
  });
});
