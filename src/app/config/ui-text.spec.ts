import { describe, expect, it } from 'vitest';
import { MODEL_CONFIGURATIONS } from './scene.config';
import { FURNITURE_TEXT } from './ui-text';

describe('single source of furniture text', () => {
  it('MODEL_CONFIGURATIONS metadata comes from FURNITURE_TEXT', () => {
    for (const [id, cfg] of Object.entries(MODEL_CONFIGURATIONS)) {
      expect(cfg.metadata).toBe(
        FURNITURE_TEXT[id as keyof typeof FURNITURE_TEXT]
      );
    }
  });
});
