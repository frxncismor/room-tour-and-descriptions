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

    it('ignores the message when the code is known', () => {
      expect(
        errorText(messages, locale, { code: 'render-failed', message: 'x' })
      ).toBe(messages.errors.messages['render-failed']);
    });

    it('translates asset and furniture ids and joins them', () => {
      const text = errorText(messages, locale, {
        code: 'model-load-failed',
        params: { names: ['pokerTable', 'prints'] },
      });
      expect(text).toContain(messages.furniture.pokerTable.name);
      expect(text).toContain(messages.assets.prints);
      expect(text).not.toContain('{names}');
    });

    it('uses the message when the params are missing', () => {
      expect(
        errorText(messages, locale, {
          code: 'model-load-failed',
          message: 'Could not load: X.',
        })
      ).toBe('Could not load: X.');
    });
  });

  it('EN and ES lists use their own conjunction', () => {
    const error = {
      code: 'model-load-failed',
      params: { names: ['pokerTable', 'prints'] },
    };
    expect(errorText(EN, 'en', error)).toBe(
      'Could not load: Poker table and Wall prints.'
    );
    expect(errorText(ES, 'es', error)).toBe(
      'No se pudo cargar: Mesa de póker y Láminas.'
    );
  });

  it('falls back to the message for an unknown code, then to a generic text', () => {
    expect(errorText(EN, 'en', { code: 'weird', message: 'Boom' })).toBe(
      'Boom'
    );
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
