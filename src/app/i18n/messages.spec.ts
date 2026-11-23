import { EN } from './en';
import ES from './es';
import { FURNITURE_IDS, Locale, LOCALES, Messages } from './messages';

const DICTS: Record<Locale, Messages> = { en: EN, es: ES };

const keysOf = (value: unknown, prefix = ''): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => keysOf(v, `${prefix}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      keysOf(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
};

const collectStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
};

/** Reglas de copy por idioma (spec C.4). */
const RULES: Record<Locale, { maxWords: number; blacklist: RegExp }> = {
  en: {
    maxWords: 30,
    blacklist:
      /generous|stunning|seamless|perfect|beautiful|sleek|elegant|cozy|inviting|invites|touch of|polished|modern|contemporary|ultimate|effortless/i,
  },
  es: {
    maxWords: 34,
    blacklist:
      /incre[ií]ble|espectacular|impresionante|moderno|elegante|lujoso|acogedor|perfecto/i,
  },
};

describe('messages: parity', () => {
  it('EN and ES have exactly the same keys', () => {
    expect(keysOf(ES)).toEqual(keysOf(EN));
  });

  it.each(LOCALES)('%s has 6 help controls with an icon', locale => {
    const { controls } = DICTS[locale].help;
    expect(controls.length).toBe(6);
    expect(controls.map(c => c.icon)).toEqual(
      EN.help.controls.map(c => c.icon)
    );
  });

  it.each(LOCALES)('%s has no empty strings', locale => {
    for (const s of collectStrings(DICTS[locale])) {
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  it('placeholders match between languages', () => {
    for (const code of Object.keys(
      EN.errors.messages
    ) as (keyof Messages['errors']['messages'])[]) {
      if (code === 'locale-load-failed') continue;
      expect(ES.errors.messages[code].includes('{names}')).toBe(
        EN.errors.messages[code].includes('{names}')
      );
    }
  });
});

describe.each(LOCALES)('messages: copy rules (%s)', locale => {
  const dict = DICTS[locale];
  const { maxWords, blacklist } = RULES[locale];

  it('has no blacklisted words', () => {
    // El aviso de «no se pudo cargar el ES» es inglés en ambos diccionarios.
    for (const s of collectStrings(dict)) {
      expect(s).not.toMatch(blacklist);
    }
  });

  it(`every description has at most 2 sentences and ${maxWords} words`, () => {
    for (const id of FURNITURE_IDS) {
      const { description } = dict.furniture[id];
      const sentences = description.split(/(?<=[.!?])\s+/).filter(Boolean);
      const words = description.split(/\s+/).filter(Boolean);
      expect(sentences.length, `${id} sentences`).toBeLessThanOrEqual(2);
      expect(words.length, `${id} words`).toBeLessThanOrEqual(maxWords);
    }
  });

  it('every piece carries its name, description and credit', () => {
    for (const id of FURNITURE_IDS) {
      const t = dict.furniture[id];
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.details).toBeTruthy();
    }
  });

  it('landscapePainting and succulent carry a CC0 credit', () => {
    for (const id of ['landscapePainting', 'succulent'] as const) {
      expect(dict.furniture[id].details).toContain('Poly Haven (CC0)');
    }
  });

  it('canvasLabel does not enumerate furniture', () => {
    expect(dict.canvasLabel).not.toMatch(
      /sofa|sofá|poker|póker|bookshelf|estanter/i
    );
  });

  it('the selector announcement names the language', () => {
    expect(dict.language.announce).toContain(
      locale === 'en' ? 'English' : 'español'
    );
  });
});
