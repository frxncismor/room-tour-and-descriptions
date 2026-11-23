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
