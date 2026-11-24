import {
  CanvasTexture,
  Material,
  Mesh,
  Object3D,
  PointLight,
  SRGBColorSpace,
  Texture,
} from 'three';
import { fill } from '../i18n/format';
import type { ActionText, PieceMessages } from '../i18n/messages';
import type { ViewerStateService } from '../services/viewer-state.service';
import type { ActionId, ActionPieceId } from './piece-ids';

/**
 * Acciones de las piezas (spec 004, B.1): máquinas de estados de la TV, el
 * monitor, las tres lámparas y el tocadiscos, aplicadas por nombre a las mallas
 * que crea la pista de builders. Sin trabajo por frame en reposo: `update(dt)`
 * solo hace falta mientras `animating` sea verdadero (`onWake` avisa cuando
 * pasa de reposo a animando).
 *
 * El estado vive en `ViewerStateService.pieceState` y solo se escribe en
 * eventos discretos (`run`, temporizador de la TV).
 */

/** Nombres de las mallas que busca el runtime dentro de la raíz que recibe. */
export const PART = {
  tvScreen: 'tv:screen',
  /** Segundo plano de la pantalla, para el fundido entre láminas. */
  tvScreenB: 'tv:screen-b',
  tvHalo: 'tv:halo',
  monitorScreen: 'monitor:screen',
  monitorHalo: 'monitor:halo',
  platter: 'turntable:platter',
  arm: 'turntable:arm',
} as const;

/** Mallas de una lámpara: `<pieza>:shade`, `<pieza>:halo` y `<pieza>:pool`. */
export type LampId = 'deskLamp' | 'readingLamp' | 'floorLamp';
export const LAMP_IDS: readonly LampId[] = [
  'deskLamp',
  'readingLamp',
  'floorLamp',
];

/** Cifras de B.1 y B.5. */
export const TUNING = {
  tvTickMs: 8000,
  tvCrossfade: 1.2,
  tvHaloFade: 0.4,
  tvHaloMax: 0.3,
  monitorHaloMax: 0.18,
  lampFade: 0.3,
  lampEmissive: 0.9,
  lampGlowMax: 0.35,
  monitorEmissive: 0.8,
  floorLightOn: 2.2,
  /** 33⅓ rpm en rad/s. */
  platterSpeed: ((100 / 3) * 2 * Math.PI) / 60,
  platterBrake: 1,
  armFade: 0.6,
  /** Giro del brazo sobre el disco; en reposo vale 0. */
  armPlayAngle: -0.5,
} as const;

/** Una lámina de la TV (título = nombre propio, no se traduce). */
export interface Plate {
  title: string;
  texture: Texture;
}

/** Lo que el runtime necesita del audio (lo cumple `TurntableAudio`). */
export interface AudioPort {
  start(): Promise<{ ok: true } | { ok: false; error: { code: string } }>;
  stop(): void;
  setHidden(hidden: boolean): void;
  dispose(): void;
}

export interface PieceActionsOptions {
  state: Pick<ViewerStateService, 'pieceState' | 'patchPiece'>;
  /** Textos del idioma activo (`LocaleService.pieceMessages`). */
  messages: () => PieceMessages | null;
  /** Las láminas de la TV, en orden de pase. */
  plates: readonly Plate[];
  /** `PointLight` existente de la lámpara de pie (no se crea ninguna luz). */
  floorLight?: PointLight | null;
  audio?: AudioPort | null;
  /** Por defecto, `matchMedia('(prefers-reduced-motion: reduce)')`; se lee en cada transición. */
  reducedMotion?: () => boolean;
  /** Se llama al pasar de reposo a animando (para pedir fotogramas). */
  onWake?: () => void;
  /** El audio no pudo arrancar (mostrable, constitución V). */
  onAudioError?: (error: { code: string }) => void;
  document?: Document;
}

/** Resultado de `run`: si cambió algo y qué anunciar al lector de pantalla. */
export interface ActionResult {
  changed: boolean;
  announcement: string | null;
}

interface Tween {
  key: string;
  from: number;
  to: number;
  duration: number;
  elapsed: number;
  apply: (value: number) => void;
  done?: () => void;
}

type StdMaterial = Material & {
  opacity: number;
  map: Texture | null;
  emissiveIntensity?: number;
  emissiveMap?: Texture | null;
  toneMapped: boolean;
  depthWrite: boolean;
};

const NO_RESULT: ActionResult = { changed: false, announcement: null };

function readReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export class PieceActionsRuntime {
  private readonly state: PieceActionsOptions['state'];
  private readonly messages: PieceActionsOptions['messages'];
  private readonly plates: readonly Plate[];
  private readonly floorLight: PointLight | null;
  private readonly audio: AudioPort | null;
  private readonly isReduced: () => boolean;
  private readonly doc: Document | null;
  private readonly tweens = new Map<string, Tween>();
  private readonly missingParts = new Set<string>();
  private readonly onVisibility = () => this.visibilityChanged();

  private root: Object3D | null = null;
  private front: Mesh | null = null;
  private back: Mesh | null = null;
  private platter: Object3D | null = null;
  private arm: Object3D | null = null;
  private platterSpeed = 0;
  private tick: ReturnType<typeof setTimeout> | null = null;
  private monitorTexture: CanvasTexture | null = null;
  private wasAnimating = false;
  private disposed = false;

  constructor(private readonly options: PieceActionsOptions) {
    this.state = options.state;
    this.messages = options.messages;
    this.plates = options.plates;
    this.floorLight = options.floorLight ?? null;
    this.audio = options.audio ?? null;
    this.isReduced = options.reducedMotion ?? readReducedMotion;
    this.doc =
      options.document ?? (typeof document === 'undefined' ? null : document);
    this.doc?.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Nombres de mallas que no se encontraron (no es un error: se omite el efecto). */
  get missing(): readonly string[] {
    return [...this.missingParts];
  }

  /** `update(dt)` solo es necesario mientras esto sea verdadero. */
  get animating(): boolean {
    return this.tweens.size > 0 || this.platterSpeed > 0;
  }

  /** Obra que muestra la TV ahora, o `null` si está apagada. */
  get workOnScreen(): string | null {
    const tv = this.state.pieceState().tv;
    return tv.power ? (this.plates[tv.index]?.title ?? null) : null;
  }

  /**
   * Engancha el runtime a las mallas de `root` y pinta el estado actual de
   * golpe (sin fundidos): la vista inicial queda con la lámpara de pie encendida.
   */
  attach(root: Object3D): void {
    this.root = root;
    this.missingParts.clear();
    this.front = this.find(PART.tvScreen);
    this.back = this.find(PART.tvScreenB, true);
    this.platter = this.find(PART.platter);
    this.arm = this.find(PART.arm);
    const state = this.state.pieceState();

    for (const mesh of [this.front, this.back]) {
      const material = this.material(mesh);
      if (material) material.toneMapped = false;
    }
    this.glow(PART.tvHalo)?.setup();
    this.glow(PART.monitorHalo)?.setup();
    for (const id of LAMP_IDS) {
      this.glow(`${id}:halo`)?.setup();
      this.glow(`${id}:pool`)?.setup();
    }

    this.paintTv(state.tv.power, state.tv.index);
    this.paintMonitor(state.monitor.power);
    for (const id of LAMP_IDS) this.paintLamp(id, state[id].power);
    if (this.arm) {
      this.arm.rotation.y = state.turntable.spin ? TUNING.armPlayAngle : 0;
    }
    this.platterSpeed =
      state.turntable.spin && !this.isReduced() ? TUNING.platterSpeed : 0;
    this.scheduleTick();
    this.notifyWake();
  }

  /** Ejecuta una acción de una pieza. Devuelve qué anunciar (nada en `TICK`). */
  run(id: ActionPieceId, action: ActionId): ActionResult {
    if (this.disposed) return NO_RESULT;
    switch (id) {
      case 'tv':
        return action === 'power'
          ? this.toggleTv()
          : action === 'next'
            ? this.nextPlate()
            : NO_RESULT;
      case 'monitor':
        return action === 'power' ? this.toggleMonitor() : NO_RESULT;
      case 'deskLamp':
      case 'readingLamp':
      case 'floorLamp':
        return action === 'power' ? this.toggleLamp(id) : NO_RESULT;
      case 'turntable':
        return action === 'spin'
          ? this.toggleSpin()
          : action === 'sound'
            ? this.toggleSound()
            : NO_RESULT;
    }
  }

  /** Avanza fundidos y el giro del plato. Solo hay que llamarlo si `animating`. */
  update(dt: number): void {
    if (this.disposed) return;
    for (const tween of [...this.tweens.values()]) {
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration);
      tween.apply(tween.from + (tween.to - tween.from) * t);
      if (t >= 1) {
        this.tweens.delete(tween.key);
        tween.done?.();
      }
    }
    if (this.platter && this.platterSpeed > 0) {
      this.platter.rotation.y += this.platterSpeed * dt;
    }
    this.wasAnimating = this.animating;
  }

  /** Cierra el audio, cancela temporizadores y libera las texturas de canvas propias. */
  dispose(): void {
    this.disposed = true;
    this.clearTick();
    this.tweens.clear();
    this.platterSpeed = 0;
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.audio?.dispose();
    this.monitorTexture?.dispose();
    this.monitorTexture = null;
    this.root = this.front = this.back = this.platter = this.arm = null;
  }

  // ---------------------------------------------------------------- TV

  private toggleTv(): ActionResult {
    const tv = this.state.pieceState().tv;
    const power = !tv.power;
    const index = power ? 0 : tv.index;
    this.state.patchPiece('tv', { power, index });
    this.paintTv(power, index, true);
    this.scheduleTick();
    return this.result('tv', 'power', power);
  }

  private nextPlate(): ActionResult {
    const tv = this.state.pieceState().tv;
    if (!tv.power) return NO_RESULT;
    this.advanceTv();
    return this.result('tv', 'next', true);
  }

  private advanceTv(): void {
    const tv = this.state.pieceState().tv;
    const index = (tv.index + 1) % Math.max(1, this.plates.length);
    this.state.patchPiece('tv', { index });
    this.showPlate(index, true);
    this.scheduleTick();
  }

  private paintTv(power: boolean, index: number, animate = false): void {
    this.complete('tv-xfade');
    const fade = animate ? TUNING.tvHaloFade : 0;
    const halo = this.glow(PART.tvHalo);
    if (power) {
      this.showPlate(index, false);
      halo?.to(TUNING.tvHaloMax, fade);
    } else {
      for (const mesh of [this.front, this.back]) {
        if (mesh) mesh.visible = false;
      }
      halo?.to(0, fade);
    }
  }

  /** Pone la lámina `index`; con `fade` y sin reducir movimiento, funde 1,2 s. */
  private showPlate(index: number, fade: boolean): void {
    const front = this.front;
    const plate = this.plates[index];
    if (!front || !plate) return;
    const crossfade = fade && !this.isReduced() && this.back && front.visible;
    if (!crossfade) {
      this.complete('tv-xfade');
      this.setMap(front, plate.texture);
      front.visible = true;
      this.opacity(front, 1);
      if (this.back) this.back.visible = false;
      return;
    }
    this.complete('tv-xfade');
    // `complete` pudo intercambiar los planos.
    const current = this.front as Mesh;
    const incoming = this.back as Mesh;
    this.setMap(incoming, plate.texture);
    incoming.visible = true;
    this.opacity(incoming, 0);
    this.tween({
      key: 'tv-xfade',
      from: 0,
      to: 1,
      duration: TUNING.tvCrossfade,
      apply: v => {
        this.opacity(incoming, v);
        this.opacity(current, 1 - v);
      },
      done: () => {
        current.visible = false;
        this.opacity(current, 1);
        this.front = incoming;
        this.back = current;
      },
    });
  }

  private scheduleTick(): void {
    this.clearTick();
    if (this.disposed || !this.root) return;
    if (!this.state.pieceState().tv.power) return;
    if (this.isReduced() || this.doc?.hidden) return;
    this.tick = setTimeout(() => {
      this.tick = null;
      if (this.disposed) return;
      if (this.state.pieceState().tv.power && !this.isReduced()) {
        this.advanceTv(); // TICK: no se anuncia
      }
    }, TUNING.tvTickMs);
  }

  private clearTick(): void {
    if (this.tick !== null) clearTimeout(this.tick);
    this.tick = null;
  }

  // ------------------------------------------------------------ monitor

  private toggleMonitor(): ActionResult {
    const power = !this.state.pieceState().monitor.power;
    this.state.patchPiece('monitor', { power });
    this.paintMonitor(power);
    return this.result('monitor', 'power', power);
  }

  private paintMonitor(power: boolean): void {
    const mesh = this.find(PART.monitorScreen);
    const material = this.material(mesh);
    if (material) {
      if (power) this.monitorTexture ??= this.drawMonitor();
      const map = power ? this.monitorTexture : null;
      material.map = map;
      if ('emissiveMap' in material) material.emissiveMap = map;
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = power ? TUNING.monitorEmissive : 0;
      }
      material.needsUpdate = true;
    }
    this.glow(PART.monitorHalo)?.to(power ? TUNING.monitorHaloMax : 0, 0);
  }

  /** Ventana de editor sin texto legible, dibujada una sola vez (512×288). */
  private drawMonitor(): CanvasTexture | null {
    const canvas = this.doc?.createElement('canvas');
    if (!canvas) return null;
    canvas.width = 512;
    canvas.height = 288;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2b2622';
      ctx.fillRect(0, 0, 512, 288);
      ctx.fillStyle = '#1f1b18';
      ctx.fillRect(0, 0, 512, 22);
      ctx.fillRect(0, 22, 56, 266);
      const tones = ['#d9a066', '#b98a5a', '#8f9f8a', '#c9b79c', '#a67b5b'];
      for (let row = 0; row < 18; row++) {
        let x = 72 + (row % 4 === 2 ? 28 : row % 7 === 5 ? 56 : 0);
        for (let seg = 0; seg < 3 + ((row * 5) % 3); seg++) {
          const w = 26 + ((row * 37 + seg * 53) % 90);
          ctx.fillStyle = tones[(row + seg * 2) % tones.length];
          ctx.fillRect(x, 36 + row * 14, w, 6);
          x += w + 10;
        }
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  // ------------------------------------------------------------ lámparas

  private toggleLamp(id: LampId): ActionResult {
    const power = !this.state.pieceState()[id].power;
    this.state.patchPiece(id, { power });
    this.paintLamp(id, power, true);
    return this.result(id, 'power', power);
  }

  private paintLamp(id: LampId, power: boolean, animate = false): void {
    const seconds = animate && !this.isReduced() ? TUNING.lampFade : 0;
    const shade = this.material(this.find(`${id}:shade`));
    if (shade?.emissiveIntensity !== undefined) {
      this.fade(
        `${id}-shade`,
        shade.emissiveIntensity,
        power ? TUNING.lampEmissive : 0,
        seconds,
        v => (shade.emissiveIntensity = v)
      );
    }
    const max = power ? TUNING.lampGlowMax : 0;
    this.glow(`${id}:halo`)?.to(max, seconds);
    this.glow(`${id}:pool`)?.to(max, seconds);
    if (id === 'floorLamp' && this.floorLight) {
      const light = this.floorLight;
      this.fade(
        'floor-light',
        light.intensity,
        power ? TUNING.floorLightOn : 0,
        seconds,
        v => (light.intensity = v)
      );
    }
  }

  // ---------------------------------------------------------- tocadiscos

  private toggleSpin(): ActionResult {
    const turntable = this.state.pieceState().turntable;
    const spin = !turntable.spin;
    const wasSound = turntable.sound;
    this.state.patchPiece('turntable', {
      spin,
      ...(spin ? {} : { sound: false }),
    });
    if (!spin && wasSound) this.audio?.stop();
    const reduced = this.isReduced();
    if (this.arm) {
      const arm = this.arm;
      this.fade(
        'arm',
        arm.rotation.y,
        spin ? TUNING.armPlayAngle : 0,
        reduced ? 0 : TUNING.armFade,
        v => (arm.rotation.y = v)
      );
    }
    if (spin) {
      this.complete('platter-brake');
      this.platterSpeed = reduced ? 0 : TUNING.platterSpeed;
    } else if (this.platterSpeed > 0) {
      const from = this.platterSpeed;
      this.fade('platter-brake', from, 0, TUNING.platterBrake, v => {
        this.platterSpeed = v;
      });
    }
    this.notifyWake();
    return this.result('turntable', 'spin', spin);
  }

  private toggleSound(): ActionResult {
    const turntable = this.state.pieceState().turntable;
    if (!turntable.spin) return NO_RESULT;
    const sound = !turntable.sound;
    this.state.patchPiece('turntable', { sound });
    if (sound) {
      // El AudioContext se crea dentro de este mismo gesto (autoplay).
      void this.audio?.start().then(result => {
        if (result.ok || this.disposed) return;
        this.state.patchPiece('turntable', { sound: false });
        this.options.onAudioError?.(result.error);
      });
    } else {
      this.audio?.stop();
    }
    return this.result('turntable', 'sound', sound);
  }

  // -------------------------------------------------------------- común

  private visibilityChanged(): void {
    if (this.disposed) return;
    const hidden = this.doc?.hidden ?? false;
    this.audio?.setHidden(hidden);
    if (hidden) this.clearTick();
    else this.scheduleTick();
  }

  /** Anuncio `aria-live` de una acción; vacío si no hay textos cargados. */
  private result(
    id: ActionPieceId,
    action: ActionId,
    on: boolean
  ): ActionResult {
    const text: ActionText | undefined =
      this.messages()?.pieces[id]?.actions?.[action];
    const template = on ? text?.announceOn : text?.announceOff;
    const announcement = template
      ? fill(template, { work: this.workOnScreen ?? '' })
      : null;
    return { changed: true, announcement };
  }

  private find(name: string, optional = false): Mesh | null {
    const found = this.root?.getObjectByName(name) as Mesh | undefined;
    if (!found && !optional) this.missingParts.add(name);
    return found ?? null;
  }

  private material(mesh: Object3D | null): StdMaterial | null {
    const material = (mesh as Mesh | null)?.material;
    const first = Array.isArray(material) ? material[0] : material;
    return (first as StdMaterial | undefined) ?? null;
  }

  private setMap(mesh: Mesh, texture: Texture): void {
    const material = this.material(mesh);
    if (!material) return;
    material.map = texture;
    material.needsUpdate = true;
  }

  private opacity(mesh: Object3D | null, value: number): void {
    const material = this.material(mesh);
    if (material) material.opacity = value;
  }

  /** Halo o charco aditivo: sin `depthWrite`, opacidad animable y mesh invisible a 0. */
  private glow(name: string):
    | {
        setup(): void;
        to(value: number, seconds: number): void;
      }
    | undefined {
    const mesh = this.find(name);
    const material = this.material(mesh);
    if (!mesh || !material) return undefined;
    return {
      setup: () => {
        material.depthWrite = false;
        material.transparent = true;
      },
      to: (value, seconds) => {
        material.depthWrite = false;
        this.fade(
          name,
          material.opacity,
          value,
          this.isReduced() ? 0 : seconds,
          v => {
            material.opacity = v;
            mesh.visible = v > 0;
          }
        );
      },
    };
  }

  private fade(
    key: string,
    from: number,
    to: number,
    seconds: number,
    apply: (value: number) => void
  ): void {
    this.complete(key);
    if (seconds <= 0 || from === to) {
      apply(to);
      return;
    }
    this.tween({ key, from, to, duration: seconds, apply });
  }

  private tween(tween: Omit<Tween, 'elapsed'>): void {
    this.tweens.set(tween.key, { ...tween, elapsed: 0 });
    this.notifyWake();
  }

  /** Termina de golpe un fundido en curso. */
  private complete(key: string): void {
    const tween = this.tweens.get(key);
    if (!tween) return;
    this.tweens.delete(key);
    tween.apply(tween.to);
    tween.done?.();
  }

  private notifyWake(): void {
    const animating = this.animating;
    if (animating && !this.wasAnimating) this.options.onWake?.();
    this.wasAnimating = animating;
  }
}
