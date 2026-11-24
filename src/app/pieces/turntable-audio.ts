/**
 * Sonido del tocadiscos (spec 004, B.3): un pad lento de 4 acordes de 8 s y un
 * crepitar de vinilo, generados con Web Audio (sin ficheros ni derechos) a
 * unos −24 dB. No se crea nada hasta `start()`, que debe llamarse dentro del
 * gesto del usuario (política de autoplay). Chunk perezoso propio.
 */

/** Resultado de `start()`: un error mostrable (constitución V), nunca una excepción. */
export type AudioStartResult =
  | { ok: true }
  | { ok: false; error: { code: string } };

export interface TurntableAudioOptions {
  /** Crea el `AudioContext` (por defecto, el del navegador). Solo se llama en `start()`. */
  createContext?: () => AudioContext;
  /** Fuente de azar del crepitar (por defecto `Math.random`). */
  random?: () => number;
}

export const AUDIO_ERROR_CODE = 'audio-unavailable';

const CHORD_SECONDS = 8;
const FADE_IN = 0.6;
const FADE_OUT = 0.3;
/** −24 dB. */
const LEVEL = 0.063;
const CHORDS: readonly (readonly number[])[] = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 261.63, 329.63],
  [196, 246.94, 293.66],
];

export class TurntableAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: BiquadFilterNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private chord = 0;
  private wanted = false;
  private hidden = false;
  private starting: Promise<AudioStartResult> | null = null;

  constructor(private readonly options: TurntableAudioOptions = {}) {}

  /** Hay contexto creado (solo tras `start()`). */
  get created(): boolean {
    return this.ctx !== null;
  }

  /** Suena o está a punto de sonar. */
  get playing(): boolean {
    return this.wanted;
  }

  /** Crea el contexto (la primera vez) y funde la entrada en 0,6 s. */
  start(): Promise<AudioStartResult> {
    this.wanted = true;
    this.starting ??= this.open().finally(() => (this.starting = null));
    return this.starting;
  }

  /** Funde la salida en 0,3 s y deja el contexto en pausa. */
  stop(): void {
    this.wanted = false;
    const { ctx, master } = this;
    if (!ctx || !master) return;
    this.clock(false);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    setTimeout(
      () => {
        if (!this.wanted && this.ctx === ctx && ctx.state === 'running') {
          void ctx.suspend();
        }
      },
      FADE_OUT * 1000 + 50
    );
  }

  /** Pestaña oculta: suspende el audio; al volver, lo reanuda si seguía activo. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    const { ctx } = this;
    if (!ctx) return;
    if (hidden) {
      this.clock(false);
      void ctx.suspend();
    } else if (this.wanted) {
      void ctx.resume();
      this.clock(true);
    }
  }

  /** Cierra el contexto y cancela los temporizadores. */
  dispose(): void {
    this.wanted = false;
    this.clock(false);
    const ctx = this.ctx;
    this.ctx = this.master = this.bus = null;
    if (ctx && ctx.state !== 'closed') void ctx.close();
  }

  private async open(): Promise<AudioStartResult> {
    try {
      if (!this.ctx) this.build();
      const { ctx, master } = this;
      if (!ctx || !master) throw new Error('no-context');
      if (ctx.state === 'suspended') await ctx.resume();
      if (!this.wanted || this.ctx !== ctx) return { ok: true };
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(LEVEL, now + FADE_IN);
      if (!this.hidden) this.clock(true);
      return { ok: true };
    } catch {
      this.dispose();
      return { ok: false, error: { code: AUDIO_ERROR_CODE } };
    }
  }

  private build(): void {
    const ctx = this.options.createContext
      ? this.options.createContext()
      : new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;
    const bus = ctx.createBiquadFilter();
    bus.type = 'lowpass';
    bus.frequency.value = 900;
    bus.connect(master);
    this.bus = bus;
    this.crackle(ctx, master);
  }

  /** Ruido disperso y filtrado, en bucle. */
  private crackle(ctx: AudioContext, out: AudioNode): void {
    const random = this.options.random ?? Math.random;
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = random() < 0.0007 ? (random() - 0.5) * 2 : 0;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    source.connect(filter).connect(gain).connect(out);
    source.start();
  }

  /** Arranca o para el reloj que enlaza los acordes. */
  private clock(on: boolean): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (!on) return;
    this.playChord();
    this.timer = setInterval(() => this.playChord(), CHORD_SECONDS * 1000);
  }

  private playChord(): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const end = t + CHORD_SECONDS + 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.33, t + 2);
    gain.gain.linearRampToValueAtTime(0.33, t + CHORD_SECONDS - 1);
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(bus);
    for (const hz of CHORDS[this.chord % CHORDS.length]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start(t);
      osc.stop(end);
    }
    this.chord++;
  }
}
