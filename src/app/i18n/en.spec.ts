import { FURNITURE_TEXT, UI_TEXT } from '../config/ui-text';
import { EN } from './en';

/** Mientras `ui-text.ts` exista como fachada, el EN no puede divergir. */
describe("EN keeps today's copy", () => {
  it('matches UI_TEXT block by block', () => {
    expect(EN.brand).toEqual(UI_TEXT.brand);
    expect(EN.loading).toEqual(UI_TEXT.loading);
    expect(EN.panel).toEqual(UI_TEXT.panel);
    expect(EN.list).toEqual(UI_TEXT.list);
    expect(EN.help).toEqual(UI_TEXT.help);
    expect(EN.canvasLabel).toBe(UI_TEXT.canvasLabel);
    const errors = { ...EN.errors, messages: undefined };
    delete errors.messages;
    expect(errors).toEqual(UI_TEXT.errors);
  });

  it('matches FURNITURE_TEXT', () => {
    expect(EN.furniture).toEqual(FURNITURE_TEXT);
  });

  it('keeps the strings that used to live in services and config', () => {
    expect(EN.errors.messages['context-lost']).toBe(
      'The 3D context was lost. It will recover automatically.'
    );
    expect(EN.errors.messages['webgl-unavailable']).toBe(
      'Your browser or device cannot run the 3D viewer (WebGL).'
    );
    expect(EN.errors.messages['render-failed']).toBe(
      'The 3D view stopped working. Try again.'
    );
    expect(EN.assets).toMatchObject({
      floor: 'Floor texture',
      rug: 'Rug texture',
      clock: 'Wall clock',
      vase: 'Ceramic vase',
    });
  });
});
