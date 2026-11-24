import {
  DataTexture,
  LinearFilter,
  MeshStandardMaterial,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three';
import type { PieceConfig } from '../pieces.config';
import {
  archOutline,
  fanGeometry,
  insetOutline,
  profileFrame,
} from './geometry';
import { BuildKit, Placer, brassMaterial, standard } from './kit';

/**
 * Acabado del vidrio del espejo: `envMap` barato (PMREM de `RoomEnvironment`
 * creado una vez, solo para este material) o vidrio ahumado mate (sin mapa de
 * entorno, con un brillo difuso dibujado en la textura).
 */
export type MirrorFinish = 'env' | 'smoked';

/** Clave del `envMap` que el servicio pasa en las texturas. */
export const MIRROR_ENV_KEY = 'mirror:env';

/** Textura 64×64 del vidrio ahumado: azul grisáceo con un velo diagonal. */
export function smokedGlassTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      // Dos bandas de brillo suaves, en diagonal.
      const band = (center: number, width: number) =>
        Math.exp(-(((u + v) / 2 - center) ** 2) / (2 * width * width));
      const light = 0.5 + 0.38 * band(0.3, 0.07) + 0.2 * band(0.52, 0.03);
      const vignette = 1 - 0.18 * ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 4;
      const i = (y * size + x) * 4;
      const k = Math.min(1, light * vignette);
      data[i] = Math.round(120 * k + 18);
      data[i + 1] = Math.round(140 * k + 24);
      data[i + 2] = Math.round(142 * k + 26);
      data[i + 3] = 255;
    }
  }
  const texture = new DataTexture(
    data,
    size,
    size,
    RGBAFormat,
    UnsignedByteType
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Espejo de arco (spec A.2): marco de latón con perfil escalonado y vidrio.
 * Mallas `archMirror:frame` y `archMirror:glass` (ambas `visuals`).
 * Con `finish = 'env'` y un `mirror:env` en las texturas el vidrio refleja la
 * habitación; si no, queda ahumado.
 */
export function buildArchMirror(
  kit: BuildKit,
  config: PieceConfig,
  finish: MirrorFinish
): void {
  const placer = new Placer(kit, config, 'tvWall');
  const [width, height, depth] = config.size;
  const y = config.position[1];
  const outline = archOutline(width, height, 14);
  const frame = kit.geometry(
    profileFrame(outline, [
      { inset: 0, z: -depth / 2 },
      { inset: 0, z: depth / 2 - 0.007 },
      { inset: 0.008, z: depth / 2 },
      { inset: 0.034, z: depth / 2 },
      { inset: 0.042, z: 0.004 },
    ])
  );
  placer.mesh('archMirror:frame', frame, brassMaterial(kit), 0, y, 0, {
    visual: true,
  });

  const env: Texture | null =
    finish === 'env' ? kit.texture(MIRROR_ENV_KEY) : null;
  const glass = kit.material('archMirror:glass', () => {
    if (env) {
      return new MeshStandardMaterial({
        color: 0xdad6cd,
        metalness: 1,
        roughness: 0.06,
        envMap: env,
        envMapIntensity: 1,
      });
    }
    return standard(0xffffff, 0.28, {
      metalness: 0.55,
      map: kit.own(smokedGlassTexture()),
    });
  });
  const glassOutline = insetOutline(outline, 0.04);
  placer.mesh(
    'archMirror:glass',
    fanGeometry(glassOutline, 0, [width, height]),
    glass,
    0,
    y,
    0.003,
    { visual: true }
  );
}
