import { EN } from './en';
import { errorText } from './error-messages';
import ES from './es';
import { Locale, Messages } from './messages';

const DICTS: readonly [Locale, Messages][] = [
  ['en', EN],
  ['es', ES],
];

describe('errorText', () => {
  describe.each(DICTS)('%s', (locale, messages) => {
    it.each([
      ['context-lost', messages.errors.messages['context-lost']],
      ['webgl-context-lost', messages.errors.messages['context-lost']],
      ['webgl-unavailable', messages.errors.messages['webgl-unavailable']],
      ['render-failed', messages.errors.messages['render-failed']],
    ])('translates the code %s', (code, expected) => {
      expect(errorText(messages, locale, { code })).toBe(expected);
    });

    it('translates asset and furniture ids and joins them', () => {
      const text = errorText(messages, locale, {
        code: 'model-load-failed',
        params: { names: ['pokerTable', 'prints'] },
      });
      expect(text.toLowerCase()).toContain(
        messages.furniture.pokerTable.name.toLowerCase()
      );
      expect(text.toLowerCase()).toContain(
        messages.assets.prints.toLowerCase()
      );
      expect(text).not.toContain('{names}');
    });

    it('falls back to the generic text when the params are missing', () => {
      expect(errorText(messages, locale, { code: 'model-load-failed' })).toBe(
        messages.errors.messages['render-failed']
      );
    });
  });

  it('EN and ES lists use their own conjunction', () => {
    const error = {
      code: 'model-load-failed',
      params: { names: ['pokerTable', 'prints'] },
    };
    expect(errorText(EN, 'en', error)).toBe(
      'Could not load: round table and wall prints.'
    );
    expect(errorText(ES, 'es', error)).toBe(
      'No se pudo cargar lo siguiente: mesa redonda y láminas.'
    );
  });

  it('falls back to the generic text for an unknown code', () => {
    expect(errorText(EN, 'en', { code: 'weird' })).toBe(
      EN.errors.messages['render-failed']
    );
  });

  it('keeps unknown names as they come (compatibility)', () => {
    expect(
      errorText(EN, 'en', {
        code: 'model-load-failed',
        params: { names: ['Floor texture'] },
      })
    ).toBe('Could not load: Floor texture.');
  });
});
