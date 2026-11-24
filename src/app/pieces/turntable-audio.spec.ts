import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_ERROR_CODE, TurntableAudio } from './turntable-audio';

function param(value = 0) {
  return {
    value,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
}

function node() {
  const n: Record<string, unknown> = {
    gain: param(),
    frequency: param(),
    type: '',
    start: vi.fn(),
    stop: vi.fn(),
  };
  n['connect'] = vi.fn((target: unknown) => target ?? n);
  return n;
}

function fakeContext(state: 'suspended' | 'running' = 'suspended') {
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    suspend: vi.fn(async () => {
      ctx.state = 'suspended';
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed' as never;
    }),
    createGain: vi.fn(node),
    createOscillator: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createBufferSource: vi.fn(node),
    createBuffer: vi.fn(() => ({
      getChannelData: () => new Float32Array(200),
    })),
  };
  return ctx;
}

describe('TurntableAudio', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('creates nothing until start()', () => {
    const create = vi.fn(() => fakeContext() as unknown as AudioContext);
    const audio = new TurntableAudio({ createContext: create });
    expect(create).not.toHaveBeenCalled();
    expect(audio.created).toBe(false);
  });

  it('creates the context on start, fades in over 0.6 s and plays a chord', async () => {
    const ctx = fakeContext();
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    const result = await audio.start();
    expect(result).toEqual({ ok: true });
    expect(audio.created).toBe(true);
    expect(ctx.resume).toHaveBeenCalled();
    const master = ctx.createGain.mock.results[0].value;
    expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(0.063, 3),
      0.6
    );
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('chains a new chord every 8 seconds', async () => {
    const ctx = fakeContext();
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    await audio.start();
    vi.advanceTimersByTime(8000);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(6);
  });

  it('fades out over 0.3 s and suspends on stop', async () => {
    const ctx = fakeContext();
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    await audio.start();
    audio.stop();
    const master = ctx.createGain.mock.results[0].value;
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0,
      0.3
    );
    vi.advanceTimersByTime(500);
    expect(ctx.suspend).toHaveBeenCalled();
    expect(audio.playing).toBe(false);
  });

  it('suspends when hidden and resumes when visible again', async () => {
    const ctx = fakeContext();
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    await audio.start();
    audio.setHidden(true);
    expect(ctx.suspend).toHaveBeenCalled();
    ctx.createOscillator.mockClear();
    vi.advanceTimersByTime(16000);
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    audio.setHidden(false);
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('does not resume a stopped audio when the tab becomes visible', async () => {
    const ctx = fakeContext();
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    await audio.start();
    audio.stop();
    audio.setHidden(true);
    audio.setHidden(false);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('dispose closes the context and cancels the timer', async () => {
    const ctx = fakeContext();
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    await audio.start();
    audio.dispose();
    expect(ctx.close).toHaveBeenCalled();
    expect(audio.created).toBe(false);
    ctx.createOscillator.mockClear();
    vi.advanceTimersByTime(20000);
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('returns a displayable error when the context cannot start', async () => {
    const audio = new TurntableAudio({
      createContext: () => {
        throw new Error('blocked');
      },
    });
    const result = await audio.start();
    expect(result).toEqual({ ok: false, error: { code: AUDIO_ERROR_CODE } });
    expect(audio.created).toBe(false);
    expect(audio.playing).toBe(false);
  });

  it('returns an error when resume rejects', async () => {
    const ctx = fakeContext();
    ctx.resume.mockRejectedValueOnce(new Error('denied'));
    const audio = new TurntableAudio({
      createContext: () => ctx as unknown as AudioContext,
    });
    const result = await audio.start();
    expect(result.ok).toBe(false);
    expect(ctx.close).toHaveBeenCalled();
  });
});
