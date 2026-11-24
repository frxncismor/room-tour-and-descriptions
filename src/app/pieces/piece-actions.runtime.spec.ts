import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Texture,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PIECES_EN from './pieces.en';
import PIECES_ES from './pieces.es';
import {
  AudioPort,
  PART,
  PieceActionsOptions,
  PieceActionsRuntime,
  TUNING,
} from './piece-actions.runtime';
import { ViewerStateService } from '../services/viewer-state.service';

const GEO = new PlaneGeometry(1, 1);

function mesh(
  name: string,
  material: MeshBasicMaterial | MeshStandardMaterial
) {
  const m = new Mesh(GEO, material);
  m.name = name;
  return m;
}

function glowMaterial() {
  return new MeshBasicMaterial({ transparent: true, opacity: 0 });
}

const TITLES = Array.from({ length: 8 }, (_, i) => `Plate ${i}`);

function build() {
  const root = new Group();
  const parts: Record<string, Mesh> = {};
  const add = (
    name: string,
    material: MeshBasicMaterial | MeshStandardMaterial = glowMaterial()
  ) => {
    parts[name] = mesh(name, material);
    root.add(parts[name]);
  };
  add(PART.tvScreen, new MeshBasicMaterial());
  add(PART.tvScreenB, new MeshBasicMaterial());
  add(PART.tvHalo);
  add(PART.monitorScreen, new MeshStandardMaterial());
  add(PART.monitorHalo);
  for (const id of ['deskLamp', 'readingLamp', 'floorLamp']) {
    add(`${id}:shade`, new MeshStandardMaterial());
    add(`${id}:halo`);
    add(`${id}:pool`);
  }
  add(PART.platter, new MeshStandardMaterial());
  add(PART.arm, new MeshStandardMaterial());
  return { root, parts };
}

function fakeAudio() {
  return {
    start: vi.fn(async () => ({ ok: true }) as const),
    stop: vi.fn(),
    setHidden: vi.fn(),
    dispose: vi.fn(),
  } satisfies AudioPort;
}

/** `tvOn`: el estado de arranque real (TV encendida); por defecto se apaga para los casos de la TV. */
function setup(extra: Partial<PieceActionsOptions> = {}, tvOn = false) {
  const state = new ViewerStateService();
  if (!tvOn) state.patchPiece('tv', { power: false });
  const { root, parts } = build();
  const audio = fakeAudio();
  const light = new PointLight(0xffffff, 2.2);
  const options: PieceActionsOptions = {
    state,
    messages: () => PIECES_EN,
    plates: TITLES.map(title => ({ title, texture: new Texture() })),
    floorLight: light,
    audio,
    reducedMotion: () => false,
    ...extra,
  };
  const runtime = new PieceActionsRuntime(options);
  runtime.attach(root);
  return { state, root, parts, audio, light, runtime, options };
}

const mat = <T>(m: Mesh) => m.material as unknown as T;
const std = (m: Mesh) => mat<MeshStandardMaterial>(m);
const basic = (m: Mesh) => mat<MeshBasicMaterial>(m);

/** Avanza hasta que no quede animación (con tope). */
function settle(runtime: PieceActionsRuntime, seconds = 3) {
  for (let t = 0; t < seconds && runtime.animating; t += 0.05) {
    runtime.update(0.05);
  }
}

describe('PieceActionsRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => vi.useRealTimers());

  describe('estado inicial (B.1)', () => {
    it('arrancan la lámpara de pie y la TV en modo arte; el resto queda en reposo', () => {
      const { parts, runtime, state } = setup({}, true);
      expect(state.pieceState().tv).toMatchObject({ power: true, index: 0 });
      expect(parts[PART.tvScreen].visible).toBe(true);
      expect(basic(parts[PART.tvScreen]).map).toBe(
        runtime['plates'][0].texture
      );
      expect(basic(parts[PART.tvHalo]).opacity).toBeCloseTo(0.3);
      expect(runtime.workOnScreen).toBe('Plate 0');
      // Sin trabajo por frame: solo el TICK de 8 s cambia (y pide un redibujo).
      expect(runtime.animating).toBe(false);
    });

    it('con la TV apagada: pantalla y halo apagados', () => {
      const { parts, light, runtime } = setup();
      expect(std(parts['floorLamp:shade']).emissiveIntensity).toBe(0.9);
      expect(basic(parts['floorLamp:halo']).opacity).toBe(0.35);
      expect(basic(parts['floorLamp:pool']).opacity).toBe(0.35);
      expect(light.intensity).toBe(2.2);
      expect(std(parts['deskLamp:shade']).emissiveIntensity).toBe(0);
      expect(basic(parts['deskLamp:halo']).opacity).toBe(0);
      expect(parts['deskLamp:halo'].visible).toBe(false);
      expect(parts[PART.tvScreen].visible).toBe(false);
      expect(basic(parts[PART.tvHalo]).opacity).toBe(0);
      expect(runtime.animating).toBe(false);
      expect(runtime.missing).toEqual([]);
    });

    it('halos y charcos no escriben profundidad y las pantallas no usan tone mapping', () => {
      const { parts } = setup();
      for (const name of [
        PART.tvHalo,
        PART.monitorHalo,
        'floorLamp:halo',
        'floorLamp:pool',
        'deskLamp:pool',
      ]) {
        expect(basic(parts[name]).depthWrite).toBe(false);
      }
      expect(basic(parts[PART.tvScreen]).toneMapped).toBe(false);
      expect(basic(parts[PART.tvScreenB]).toneMapped).toBe(false);
    });

    it('no revienta si faltan mallas: las registra y sigue', () => {
      const state = new ViewerStateService();
      const runtime = new PieceActionsRuntime({
        state,
        messages: () => PIECES_EN,
        plates: [],
        reducedMotion: () => false,
      });
      runtime.attach(new Group());
      expect(runtime.missing).toContain(PART.platter);
      expect(runtime.missing).toContain('deskLamp:shade');
      expect(() => {
        runtime.run('tv', 'power');
        runtime.run('deskLamp', 'power');
        runtime.run('monitor', 'power');
        runtime.run('turntable', 'spin');
        runtime.update(0.1);
      }).not.toThrow();
      expect(state.pieceState().deskLamp.power).toBe(true);
    });
  });

  describe('lámparas', () => {
    it('encienden y apagan emisivo, halo y charco 0 ↔ máximo en 0,3 s', () => {
      const { parts, runtime, state } = setup();
      const r = runtime.run('deskLamp', 'power');
      expect(r).toEqual({ changed: true, announcement: 'Desk lamp on.' });
      expect(state.pieceState().deskLamp.power).toBe(true);
      expect(runtime.animating).toBe(true);
      runtime.update(0.15);
      expect(basic(parts['deskLamp:halo']).opacity).toBeCloseTo(0.175, 3);
      settle(runtime);
      expect(std(parts['deskLamp:shade']).emissiveIntensity).toBeCloseTo(0.9);
      expect(basic(parts['deskLamp:halo']).opacity).toBeCloseTo(0.35);
      expect(basic(parts['deskLamp:pool']).opacity).toBeCloseTo(0.35);
      expect(parts['deskLamp:pool'].visible).toBe(true);
      expect(runtime.animating).toBe(false);

      runtime.run('deskLamp', 'power');
      settle(runtime);
      expect(std(parts['deskLamp:shade']).emissiveIntensity).toBe(0);
      expect(basic(parts['deskLamp:halo']).opacity).toBe(0);
      expect(parts['deskLamp:halo'].visible).toBe(false);
    });

    it('la PointLight de la lámpara de pie baja de 2,2 a 0 y vuelve; no se crea ninguna luz', () => {
      const { root, light, runtime } = setup();
      const lights = () => {
        let n = 0;
        root.traverse(o => (o as { isLight?: boolean }).isLight && n++);
        return n;
      };
      expect(lights()).toBe(0);
      runtime.run('floorLamp', 'power');
      settle(runtime);
      expect(light.intensity).toBe(0);
      runtime.run('floorLamp', 'power');
      settle(runtime);
      expect(light.intensity).toBe(2.2);
      expect(lights()).toBe(0);
    });

    it('en reducir movimiento cambian de golpe y no animan', () => {
      const { parts, runtime } = setup({ reducedMotion: () => true });
      runtime.run('readingLamp', 'power');
      expect(runtime.animating).toBe(false);
      expect(std(parts['readingLamp:shade']).emissiveIntensity).toBe(0.9);
      expect(basic(parts['readingLamp:pool']).opacity).toBe(0.35);
    });

    it('una pieza sin esa acción no cambia nada', () => {
      const { runtime } = setup();
      expect(runtime.run('deskLamp', 'next')).toEqual({
        changed: false,
        announcement: null,
      });
    });
  });

  describe('monitor', () => {
    it('muestra una textura de canvas al encender (una sola vez) y la quita al apagar', () => {
      const { parts, runtime } = setup();
      const material = std(parts[PART.monitorScreen]);
      expect(material.map).toBeNull();
      runtime.run('monitor', 'power');
      const first = material.map;
      expect(first).not.toBeNull();
      expect(material.emissiveIntensity).toBeCloseTo(0.8);
      expect(basic(parts[PART.monitorHalo]).opacity).toBeCloseTo(0.18);
      expect(runtime.animating).toBe(false);
      runtime.run('monitor', 'power');
      expect(material.map).toBeNull();
      expect(material.emissiveIntensity).toBe(0);
      expect(basic(parts[PART.monitorHalo]).opacity).toBe(0);
      runtime.run('monitor', 'power');
      expect(material.map).toBe(first);
    });
  });

  describe('TV', () => {
    it('POWER enciende en la lámina 0 con halo 0 → 0,3 en 0,4 s y anuncia la obra', () => {
      const { parts, runtime, state } = setup();
      const r = runtime.run('tv', 'power');
      expect(r.announcement).toBe('Television on. Showing Plate 0.');
      expect(state.pieceState().tv).toMatchObject({ power: true, index: 0 });
      expect(parts[PART.tvScreen].visible).toBe(true);
      expect(basic(parts[PART.tvScreen]).map).toBe(
        runtime['plates'][0].texture
      );
      runtime.update(0.2);
      expect(basic(parts[PART.tvHalo]).opacity).toBeCloseTo(0.15, 3);
      settle(runtime);
      expect(basic(parts[PART.tvHalo]).opacity).toBeCloseTo(0.3);
      expect(runtime.workOnScreen).toBe('Plate 0');
    });

    it('POWER apagada: pantalla y halo se apagan y no hay obra', () => {
      const { parts, runtime } = setup();
      runtime.run('tv', 'power');
      settle(runtime);
      const r = runtime.run('tv', 'power');
      expect(r.announcement).toBe('Television off.');
      settle(runtime);
      expect(parts[PART.tvScreen].visible).toBe(false);
      expect(basic(parts[PART.tvHalo]).opacity).toBe(0);
      expect(runtime.workOnScreen).toBeNull();
    });

    it('NEXT solo con la TV encendida: avanza (mod 8), anuncia la obra y funde 1,2 s', () => {
      const { parts, runtime, state } = setup();
      expect(runtime.run('tv', 'next')).toEqual({
        changed: false,
        announcement: null,
      });
      expect(state.pieceState().tv.index).toBe(0);

      runtime.run('tv', 'power');
      settle(runtime);
      const r = runtime.run('tv', 'next');
      expect(r.announcement).toBe('Showing Plate 1.');
      expect(state.pieceState().tv.index).toBe(1);
      // Fundido entre dos planos.
      runtime.update(0.6);
      expect(basic(parts[PART.tvScreenB]).opacity).toBeCloseTo(0.5, 2);
      expect(basic(parts[PART.tvScreen]).opacity).toBeCloseTo(0.5, 2);
      settle(runtime);
      // Los planos se han intercambiado.
      expect(parts[PART.tvScreen].visible).toBe(false);
      expect(parts[PART.tvScreenB].visible).toBe(true);
      expect(basic(parts[PART.tvScreenB]).opacity).toBe(1);
      expect(runtime.workOnScreen).toBe('Plate 1');

      for (let i = 0; i < 7; i++) runtime.run('tv', 'next');
      settle(runtime, 20);
      expect(state.pieceState().tv.index).toBe(0);
    });

    it('un NEXT durante un fundido lo cierra y empieza el siguiente sin perder láminas', () => {
      const { runtime, state, parts } = setup();
      runtime.run('tv', 'power');
      settle(runtime);
      runtime.run('tv', 'next');
      runtime.update(0.3);
      runtime.run('tv', 'next');
      settle(runtime);
      expect(state.pieceState().tv.index).toBe(2);
      const visible = [PART.tvScreen, PART.tvScreenB].filter(
        n => parts[n].visible
      );
      expect(visible).toHaveLength(1);
    });

    it('TICK cada 8 s solo con la TV encendida, sin anunciar', () => {
      const { runtime, state } = setup();
      vi.advanceTimersByTime(30000);
      expect(state.pieceState().tv.index).toBe(0);

      runtime.run('tv', 'power');
      vi.advanceTimersByTime(7999);
      expect(state.pieceState().tv.index).toBe(0);
      vi.advanceTimersByTime(1);
      expect(state.pieceState().tv.index).toBe(1);
      vi.advanceTimersByTime(8000);
      expect(state.pieceState().tv.index).toBe(2);

      runtime.run('tv', 'power'); // apaga
      vi.advanceTimersByTime(30000);
      expect(state.pieceState().tv.index).toBe(2);
    });

    it('NEXT reinicia la cuenta del TICK', () => {
      const { runtime, state } = setup();
      runtime.run('tv', 'power');
      vi.advanceTimersByTime(6000);
      runtime.run('tv', 'next');
      vi.advanceTimersByTime(6000);
      expect(state.pieceState().tv.index).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(state.pieceState().tv.index).toBe(2);
    });

    it('la pestaña oculta suspende el TICK y al volver se reanuda', () => {
      const doc = document.implementation.createHTMLDocument('t');
      let hidden = false;
      Object.defineProperty(doc, 'hidden', { get: () => hidden });
      const { runtime, state, audio } = setup({ document: doc });
      runtime.run('tv', 'power');
      hidden = true;
      doc.dispatchEvent(new Event('visibilitychange'));
      expect(audio.setHidden).toHaveBeenCalledWith(true);
      vi.advanceTimersByTime(40000);
      expect(state.pieceState().tv.index).toBe(0);
      hidden = false;
      doc.dispatchEvent(new Event('visibilitychange'));
      expect(audio.setHidden).toHaveBeenCalledWith(false);
      vi.advanceTimersByTime(8000);
      expect(state.pieceState().tv.index).toBe(1);
    });

    it('reducir movimiento: sin fundido, sin TICK y NEXT manual cortando', () => {
      const { parts, runtime, state } = setup({ reducedMotion: () => true });
      runtime.run('tv', 'power');
      expect(runtime.animating).toBe(false);
      expect(basic(parts[PART.tvHalo]).opacity).toBe(0.3);
      vi.advanceTimersByTime(60000);
      expect(state.pieceState().tv.index).toBe(0);
      const r = runtime.run('tv', 'next');
      expect(r.announcement).toBe('Showing Plate 1.');
      expect(runtime.animating).toBe(false);
      expect(parts[PART.tvScreen].visible).toBe(true);
      expect(basic(parts[PART.tvScreen]).opacity).toBe(1);
      expect(parts[PART.tvScreenB].visible).toBe(false);
      expect(basic(parts[PART.tvScreen]).map).toBe(
        runtime['plates'][1].texture
      );
    });

    it('en español anuncia con el título propio sin traducir', () => {
      const { runtime } = setup({ messages: () => PIECES_ES });
      const r = runtime.run('tv', 'power');
      expect(r.announcement).toBe(
        'Televisión encendida. En pantalla: Plate 0.'
      );
    });

    it('sin textos cargados no anuncia pero funciona', () => {
      const { runtime, state } = setup({ messages: () => null });
      expect(runtime.run('tv', 'power')).toEqual({
        changed: true,
        announcement: null,
      });
      expect(state.pieceState().tv.power).toBe(true);
    });
  });

  describe('tocadiscos', () => {
    it('SPIN_ON: el brazo se apoya y el plato gira a 33⅓ rpm en update(dt)', () => {
      const { parts, runtime, state } = setup();
      const r = runtime.run('turntable', 'spin');
      expect(r.announcement).toBe('Record playing.');
      expect(state.pieceState().turntable.spin).toBe(true);
      expect(runtime.animating).toBe(true);
      runtime.update(1);
      expect(parts[PART.platter].rotation.y).toBeCloseTo(
        TUNING.platterSpeed,
        5
      );
      expect(TUNING.platterSpeed / (2 * Math.PI)).toBeCloseTo(0.5556, 3);
      settle(runtime, 1);
      expect(parts[PART.arm].rotation.y).toBeCloseTo(TUNING.armPlayAngle);
      expect(runtime.animating).toBe(true); // el plato sigue girando
    });

    it('SPIN_OFF: frena en 1 s, el brazo vuelve al reposo y deja de pedir update', () => {
      const { parts, runtime } = setup();
      runtime.run('turntable', 'spin');
      settle(runtime, 1);
      const r = runtime.run('turntable', 'spin');
      expect(r.announcement).toBe('Record stopped.');
      runtime.update(0.5);
      const mid = parts[PART.platter].rotation.y;
      for (let t = 0; t < 1.5; t += 0.05) runtime.update(0.05);
      expect(runtime.animating).toBe(false);
      const stopped = parts[PART.platter].rotation.y;
      runtime.update(1);
      expect(parts[PART.platter].rotation.y).toBe(stopped);
      expect(stopped).toBeGreaterThan(mid);
      expect(parts[PART.arm].rotation.y).toBeCloseTo(0);
    });

    it('SOUND_ON solo con el plato girando; arranca el audio en el gesto', () => {
      const { runtime, state, audio } = setup();
      expect(runtime.run('turntable', 'sound')).toEqual({
        changed: false,
        announcement: null,
      });
      expect(audio.start).not.toHaveBeenCalled();
      expect(state.pieceState().turntable.sound).toBe(false);

      runtime.run('turntable', 'spin');
      const r = runtime.run('turntable', 'sound');
      expect(r.announcement).toBe('Sound on.');
      expect(audio.start).toHaveBeenCalledTimes(1);
      expect(state.pieceState().turntable.sound).toBe(true);

      const off = runtime.run('turntable', 'sound');
      expect(off.announcement).toBe('Sound off.');
      expect(audio.stop).toHaveBeenCalledTimes(1);
      expect(state.pieceState().turntable.sound).toBe(false);
    });

    it('SPIN_OFF fuerza muted y para el audio', () => {
      const { runtime, state, audio } = setup();
      runtime.run('turntable', 'spin');
      runtime.run('turntable', 'sound');
      runtime.run('turntable', 'spin');
      expect(state.pieceState().turntable).toMatchObject({
        spin: false,
        sound: false,
      });
      expect(audio.stop).toHaveBeenCalled();
    });

    it('si el audio falla, vuelve a muted y avisa con un error mostrable', async () => {
      const onAudioError = vi.fn();
      const { runtime, state, audio } = setup({ onAudioError });
      audio.start.mockResolvedValueOnce({
        ok: false,
        error: { code: 'audio-unavailable' },
      } as never);
      runtime.run('turntable', 'spin');
      runtime.run('turntable', 'sound');
      await vi.advanceTimersByTimeAsync(0);
      expect(state.pieceState().turntable.sound).toBe(false);
      expect(onAudioError).toHaveBeenCalledWith({ code: 'audio-unavailable' });
    });

    it('reducir movimiento: plato quieto, brazo apoyado, «reproduciendo» y sonido disponible', () => {
      const { parts, runtime, state, audio } = setup({
        reducedMotion: () => true,
      });
      runtime.run('turntable', 'spin');
      expect(state.pieceState().turntable.spin).toBe(true);
      expect(runtime.animating).toBe(false);
      expect(parts[PART.arm].rotation.y).toBeCloseTo(TUNING.armPlayAngle);
      runtime.update(1);
      expect(parts[PART.platter].rotation.y).toBe(0);
      runtime.run('turntable', 'sound');
      expect(audio.start).toHaveBeenCalled();
      runtime.run('turntable', 'spin');
      expect(parts[PART.arm].rotation.y).toBeCloseTo(0);
    });

    it('no crea ningún audio por su cuenta (sin audio inyectado no pasa nada)', () => {
      const { runtime } = setup({ audio: null });
      runtime.run('turntable', 'spin');
      expect(() => runtime.run('turntable', 'sound')).not.toThrow();
    });
  });

  describe('update y animating', () => {
    it('en reposo no hay animación; onWake avisa al empezar una', () => {
      const onWake = vi.fn();
      const { runtime } = setup({ onWake });
      onWake.mockClear();
      expect(runtime.animating).toBe(false);
      runtime.run('deskLamp', 'power');
      expect(onWake).toHaveBeenCalledTimes(1);
      runtime.run('readingLamp', 'power'); // ya estaba animando
      expect(onWake).toHaveBeenCalledTimes(1);
      settle(runtime);
      runtime.run('turntable', 'spin');
      expect(onWake).toHaveBeenCalledTimes(2);
    });
  });

  describe('dispose', () => {
    it('cierra el audio, cancela el TICK y libera la textura del monitor', () => {
      const { runtime, state, audio, parts } = setup();
      runtime.run('tv', 'power');
      runtime.run('monitor', 'power');
      const texture = std(parts[PART.monitorScreen]).map as Texture;
      const dispose = vi.spyOn(texture, 'dispose');
      runtime.dispose();
      expect(audio.dispose).toHaveBeenCalled();
      expect(dispose).toHaveBeenCalled();
      vi.advanceTimersByTime(30000);
      expect(state.pieceState().tv.index).toBe(0);
      expect(runtime.run('tv', 'next').changed).toBe(false);
      expect(runtime.animating).toBe(false);
    });
  });
});
