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

/** Clave de la obra (clon de una lámina) que cuelga del arco. */
export const MIRROR_ART_KEY = 'mirror:art';

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
 * Pieza `archMirror` (spec A.2), hoy una lámina de arco: marco de latón con
 * perfil escalonado y la obra de `mirror:art` en la ventana (el espejo daba un
 * panel gris sin reflejo). Mallas `archMirror:frame` y `archMirror:glass`
 * (ambas `visuals`); `finish` se conserva por compatibilidad y no se usa.
 */
export function buildArchMirror(
  kit: BuildKit,
  config: PieceConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma estable
  _finish: MirrorFinish
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

  // Lámina de arco: la obra (clon de una de las 8 láminas) recortada, no
  // estirada, a la ventana del arco; sin obra, un paspartú liso.
  const art: Texture | null = kit.texture(MIRROR_ART_KEY);
  const glass = kit.material('archMirror:glass', () =>
    art
      ? new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: art })
      : standard(0xd9d4c8, 0.95)
  );
  const glassOutline = insetOutline(outline, 0.04);
  const windowH = height - 0.08;
  placer.mesh(
    'archMirror:glass',
    fanGeometry(glassOutline, 0, [(windowH * 5) / 7, windowH]),
    glass,
    0,
    y,
    0.003,
    { visual: true }
  );
}
