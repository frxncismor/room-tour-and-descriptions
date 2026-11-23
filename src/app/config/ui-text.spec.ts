import { describe, expect, it } from 'vitest';
import { MODEL_CONFIGURATIONS } from './scene.config';
import { FURNITURE_TEXT, UI_TEXT } from './ui-text';

describe('new pieces text', () => {
  it('landscapePainting and succulent carry a CC0 credit', () => {
    for (const id of ['landscapePainting', 'succulent'] as const) {
      expect(FURNITURE_TEXT[id].name).toBeTruthy();
      expect(FURNITURE_TEXT[id].details).toContain('Poly Haven (CC0)');
    }
  });

  it('canvasLabel does not enumerate furniture', () => {
    expect(UI_TEXT.canvasLabel).not.toMatch(/sofa|poker|bookshelf/i);
  });
});

describe('single source of furniture text', () => {
  it('MODEL_CONFIGURATIONS metadata comes from FURNITURE_TEXT', () => {
    for (const [id, cfg] of Object.entries(MODEL_CONFIGURATIONS)) {
      expect(cfg.metadata).toBe(
        FURNITURE_TEXT[id as keyof typeof FURNITURE_TEXT]
      );
    }
  });
});

describe('copy rules (FR-241, SC-214)', () => {
  const BLACKLIST =
    /generous|stunning|seamless|perfect|beautiful|sleek|elegant|cozy|inviting|invites|touch of|polished|modern|contemporary|ultimate|effortless/i;

  const collectStrings = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(collectStrings);
    if (value && typeof value === 'object')
      return Object.values(value).flatMap(collectStrings);
    return [];
  };

  it('UI_TEXT has no blacklisted words', () => {
    for (const s of collectStrings(UI_TEXT)) {
      expect(s).not.toMatch(BLACKLIST);
    }
  });

  it('FURNITURE_TEXT has no blacklisted words', () => {
    for (const s of collectStrings(FURNITURE_TEXT)) {
      expect(s).not.toMatch(BLACKLIST);
    }
  });

  it('every description has at most 2 sentences and 30 words', () => {
    for (const [id, t] of Object.entries(FURNITURE_TEXT)) {
      const sentences = t.description.split(/(?<=[.!?])\s+/).filter(Boolean);
      const words = t.description.split(/\s+/).filter(Boolean);
      expect(sentences.length, `${id} sentences`).toBeLessThanOrEqual(2);
      expect(words.length, `${id} words`).toBeLessThanOrEqual(30);
    }
  });
});
