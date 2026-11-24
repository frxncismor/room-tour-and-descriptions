import { EN } from '../i18n/en';
import ES from '../i18n/es';
import { fill } from '../i18n/format';
import type {
  ObjectInfo,
  SelectableId,
  SelectedInfo,
} from '../interfaces/scene.interface';
import * as pieceIds from './piece-ids';
import { FURNITURE_IDS, Locale, PieceMessages } from '../i18n/messages';
import {
  ACTION_IDS,
  PIECE_IDS,
  PIECE_IDS_WITH_ACTIONS,
  SURFACE_IDS,
} from './piece-ids';
import PIECES_EN from './pieces.en';
import PIECES_ES from './pieces.es';

const DICTS: Record<Locale, PieceMessages> = {
  en: PIECES_EN,
  es: PIECES_ES,
};

const keysOf = (value: unknown, prefix = ''): string[] => {
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      keysOf(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
};

const stringsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(stringsOf);
  }
  return [];
};

describe('piece-ids', () => {
  it('lists 35 unique pieces and 5 unique surfaces', () => {
    expect(PIECE_IDS.length).toBe(35);
    expect(new Set(PIECE_IDS).size).toBe(35);
    expect(SURFACE_IDS.length).toBe(5);
    expect(new Set(SURFACE_IDS).size).toBe(5);
  });

  it('contains the five existing furniture ids', () => {
    for (const id of FURNITURE_IDS) {
      expect(PIECE_IDS as readonly string[]).toContain(id);
    }
  });

  it('only declares the actions the spec lists (B.1)', () => {
    expect([...ACTION_IDS].sort()).toEqual(['next', 'power', 'sound', 'spin']);
    expect(Object.keys(PIECE_IDS_WITH_ACTIONS).sort()).toEqual([
      'deskLamp',
      'floorLamp',
      'monitor',
      'readingLamp',
      'turntable',
      'tv',
    ]);
  });

  it('only exports types and id constants (arrays or maps of arrays)', () => {
    for (const [name, value] of Object.entries(pieceIds)) {
      const isList = Array.isArray(value);
      const isMapOfLists =
        !isList &&
        typeof value === 'object' &&
        Object.values(value as object).every(Array.isArray);
      expect(isList || isMapOfLists, name).toBe(true);
    }
  });
});

describe('scene types (T-420)', () => {
  it('a furniture ObjectInfo needs no kind (consumers keep working)', () => {
    const info: ObjectInfo = { id: 'sofa' };
    expect(info.kind ?? 'furniture').toBe('furniture');
  });

  it('SelectedInfo discriminates furniture, pieces and surfaces by kind', () => {
    const all: SelectedInfo[] = [
      { id: 'sofa' },
      { id: 'tv', kind: 'piece' },
      { id: 'ceiling', kind: 'surface' },
    ];
    const ids: SelectableId[] = all.map(info => info.id);
    expect(ids).toEqual(['sofa', 'tv', 'ceiling']);
    expect(all.map(info => info.kind ?? 'furniture')).toEqual([
      'furniture',
      'piece',
      'surface',
    ]);
  });
});

describe.each(['en', 'es'] as const)('piece dictionary (%s)', locale => {
  const dict = DICTS[locale];

  it('has exactly the piece and surface ids', () => {
    expect(Object.keys(dict.pieces).sort()).toEqual([...PIECE_IDS].sort());
    expect(Object.keys(dict.surfaces).sort()).toEqual([...SURFACE_IDS].sort());
  });

  it('names stay within 28 characters and descriptions within 220', () => {
    const entries = [
      ...Object.entries(dict.pieces),
      ...Object.entries(dict.surfaces),
    ];
    for (const [id, text] of entries) {
      expect(text.name.length, `${id} name`).toBeGreaterThan(0);
      expect(text.name.length, `${id} name`).toBeLessThanOrEqual(28);
      expect(text.description.length, `${id} description`).toBeGreaterThan(0);
      expect(text.description.length, `${id} description`).toBeLessThanOrEqual(
        220
      );
    }
  });

  it('has no empty strings and no leftover whitespace', () => {
    for (const s of stringsOf(dict)) {
      expect(s.trim()).toBe(s);
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('action labels exist exactly for the pieces with actions', () => {
    const withActions = Object.entries(dict.pieces)
      .filter(([, text]) => text.actions)
      .map(([id]) => id)
      .sort();
    expect(withActions).toEqual(Object.keys(PIECE_IDS_WITH_ACTIONS).sort());
    for (const [id, actions] of Object.entries(PIECE_IDS_WITH_ACTIONS)) {
      const declared = dict.pieces[id as keyof typeof dict.pieces].actions;
      expect(Object.keys(declared ?? {}).sort(), id).toEqual(
        [...actions].sort()
      );
    }
  });

  it('every action has a label for both states and an announcement', () => {
    for (const [id, text] of Object.entries(dict.pieces)) {
      for (const [action, a] of Object.entries(text.actions ?? {})) {
        expect(a.whenOff, `${id}.${action}`).toBeTruthy();
        if (action === 'next') continue;
        expect(a.whenOn, `${id}.${action}`).toBeTruthy();
        expect(a.announceOn, `${id}.${action}`).toBeTruthy();
        expect(a.announceOff, `${id}.${action}`).toBeTruthy();
      }
    }
  });

  it('leaves no {work} unreplaced in the TV templates', () => {
    const tv = dict.pieces.tv.actions;
    const templates = stringsOf(tv).filter(s => s.includes('{'));
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      expect(template.match(/\{\w+\}/g)).toEqual(['{work}']);
      expect(fill(template, { work: 'Pteris aquilina' })).not.toMatch(/[{}]/);
    }
    expect(tv?.power?.announceOn).toContain('{work}');
    expect(tv?.power?.announceOff).not.toContain('{work}');
  });

  it('only the TV uses placeholders', () => {
    for (const [id, text] of Object.entries(dict.pieces)) {
      if (id === 'tv') continue;
      for (const s of stringsOf(text)) expect(s, id).not.toMatch(/[{}]/);
    }
    for (const s of stringsOf(dict.surfaces)) expect(s).not.toMatch(/[{}]/);
  });

  it('credits the Poly Haven models as CC0', () => {
    for (const id of [
      'readingChair',
      'sideboard',
      'tallCabinet',
      'desk',
      'displayShelves',
      'armchair',
      'coffeeTable',
      'pendant',
    ] as const) {
      expect(dict.pieces[id].details, id).toContain('CC0');
    }
  });

  it('the existing furniture repeats the initial dictionary text', () => {
    const initial = locale === 'en' ? EN : ES;
    for (const id of FURNITURE_IDS) {
      expect(dict.pieces[id], id).toEqual(initial.furniture[id]);
    }
  });
});

describe('piece dictionaries: EN/ES parity', () => {
  it('have the same keys', () => {
    expect(keysOf(PIECES_ES)).toEqual(keysOf(PIECES_EN));
  });

  it('keep the same placeholders', () => {
    const placeholders = (s: string) => s.match(/\{\w+\}/g) ?? [];
    const en = stringsOf(PIECES_EN);
    const es = stringsOf(PIECES_ES);
    expect(es.map(placeholders)).toEqual(en.map(placeholders));
  });

  it('are not copies of each other (everything is translated)', () => {
    const same = (['pieces', 'surfaces'] as const).flatMap(group =>
      Object.entries(PIECES_EN[group]).filter(
        ([id, text]) =>
          // «Monitor» y alguna etiqueta técnica pueden coincidir.
          text.description ===
          (PIECES_ES[group] as Record<string, { description: string }>)[id]
            .description
      )
    );
    expect(same).toEqual([]);
  });
});

describe('piece dictionaries: size', () => {
  // Proxy de la norma «≤ 14 kB por archivo»: el JSON es menor que el .ts
  // (sin sangrías ni comillas de clave), y el tamaño real se mide en el informe.
  it.each(['en', 'es'] as const)(
    '%s stays well under 14 kB of text',
    locale => {
      const bytes = new TextEncoder().encode(
        JSON.stringify(DICTS[locale])
      ).byteLength;
      expect(bytes).toBeLessThanOrEqual(12 * 1024);
    }
  );
});
