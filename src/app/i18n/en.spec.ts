import { EN } from './en';

/** El EN conserva los textos que vivían en servicios y config. */
describe("EN keeps today's copy", () => {
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
