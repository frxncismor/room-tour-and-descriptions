import {
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import type { PieceConfig } from '../pieces.config';
import { profileFrame, rectOutline } from './geometry';
import { BuildKit, PALETTE, Placer, standard, walnutMaterial } from './kit';

/** Marco de la tele: grosor de la moldura (m). */
const BORDER = 0.04;
/** Relación de la lámina (5:7) para el pilar de la pantalla. */
const ART_ASPECT = 5 / 7;

/**
 * Televisión (spec A.2, B.1): marco de nogal con bisel, cristal oscuro,
 * paspartú, dos planos de lámina (A y B, para el fundido) y halo cálido en la
 * pared. Pantalla y halo son mallas y materiales propios, accesibles por
 * nombre: `tv:glass`, `tv:matte` (paspartú), `tv:screen` y `tv:screen-b` (láminas, para el fundido),
 * `tv:halo`. Apagada, pantalla y halo están ocultos.
 */
export function buildTv(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'tvWall');
  const [width, height, depth] = config.size;
  const y = config.position[1];
  const back = -depth / 2;
  const innerW = width - 2 * BORDER;
  const innerH = height - 2 * BORDER;

  // Marco: lateral, chaflán exterior, cara, chaflán interior.
  const frame = kit.geometry(
    profileFrame(rectOutline(width, height), [
      { inset: 0, z: back },
      { inset: 0, z: depth / 2 - 0.009 },
      { inset: 0.005, z: depth / 2 },
      { inset: BORDER - 0.008, z: depth / 2 },
      { inset: BORDER, z: 0.006 },
    ])
  );
  placer.mesh('tv:frame', frame, walnutMaterial(kit), 0, y, 0, {
    visual: true,
  });

  const glassMaterial = kit.material('tv:glass', () =>
    standard(0x0c0d0f, 0.14, { metalness: 0.15 })
  );
  placer.mesh(
    'tv:glass',
    new PlaneGeometry(innerW, innerH),
    glassMaterial,
    0,
    y,
    0.002,
    { visual: true }
  );

  const screenMaterial = (key: string, color: number): MeshBasicMaterial =>
    kit.material(
      key,
      () =>
        new MeshBasicMaterial({
          color,
          toneMapped: false,
          fog: false,
          transparent: true,
          opacity: 1,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
    );
  const matte = placer.mesh(
    'tv:matte',
    new PlaneGeometry(innerW, innerH),
    screenMaterial('tv:matte', PALETTE.matte),
    0,
    y,
    0.003
  );
  const artH = innerH * 0.94;
  for (const [name, z] of [
    ['tv:screen', 0.0035],
    ['tv:screen-b', 0.004],
  ] as const) {
    const plane = placer.mesh(
      name,
      new PlaneGeometry(artH * ART_ASPECT, artH),
      screenMaterial(name, 0xffffff),
      0,
      y,
      z
    );
    plane.visible = false;
  }
  matte.visible = false;

  const halo = placer.mesh(
    'tv:halo',
    new PlaneGeometry(width * 1.7, height * 2),
    kit.glowMaterial('tv:halo', 0xffd9a0, 0),
    0,
    y,
    back - 0.016
  );
  halo.visible = false;
}

/** Tipos auxiliares para los tests. */
export type TvParts = Record<
  | 'tv:frame'
  | 'tv:glass'
  | 'tv:matte'
  | 'tv:screen'
  | 'tv:screen-b'
  | 'tv:halo',
  Mesh<BufferGeometry, MeshBasicMaterial | MeshStandardMaterial>
>;
