import {
  CircleGeometry,
  Euler,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { BuildKit, ZoneId } from './kit';

/** Alfombras nuevas (spec A.1.4): mismos colores y textura que la de la 003. */
export interface RugSpec {
  id: 'rugTv' | 'rugReading';
  zone: ZoneId;
  /** Centro (x, z) en el suelo. */
  center: readonly [number, number];
  shape: 'rect' | 'round';
  /** Rectangular: ancho × fondo; redonda: diámetro en `width`. */
  width: number;
  depth: number;
  rotationY: number;
}

export const RUG_SPECS: readonly RugSpec[] = [
  {
    id: 'rugTv',
    zone: 'tvLounge',
    center: [0.2, 5.95],
    shape: 'rect',
    width: 4,
    depth: 2.6,
    rotationY: 0,
  },
  {
    id: 'rugReading',
    zone: 'reading',
    center: [-6.4, 4.5],
    shape: 'round',
    width: 2.3,
    depth: 2.3,
    rotationY: 0,
  },
];

/** Datos de color de la alfombra existente (`RUG_TEXTURES` de la 003). */
export const RUG_STYLE = {
  tint: 0xffd9b3,
  borderColor: 0xd8c7ad,
  borderWidth: 0.12,
  y: 0.004,
  /** Metros por baldosa de la textura. */
  tile: 0.5,
} as const;

function matrixAt(x: number, y: number, z: number, rotationY: number): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(0, rotationY, 0)),
    new Vector3(1, 1, 1)
  );
}

/**
 * Alfombras del salón de TV y del rincón de lectura: cada una una malla de
 * tejido con la textura de la existente y otra de ribete claro debajo.
 * Nombres `<id>` y `<id>-border`. Sin raycast: el clic teletransporta.
 */
export function buildRugs(kit: BuildKit): void {
  const rugMap = kit.tiled('rug:diffuse', SRGBColorSpace);
  const rugNormal = kit.tiled('rug:normal');
  for (const rug of RUG_SPECS) {
    const [cx, cz] = rug.center;
    const fabric = kit.material(
      `${rug.id}:fabric`,
      () =>
        new MeshStandardMaterial({
          color: RUG_STYLE.tint,
          roughness: 1,
          metalness: 0,
          ...(rugMap ? { map: rugMap } : {}),
          ...(rugNormal ? { normalMap: rugNormal } : {}),
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
    );
    if (rugNormal) fabric.normalScale = new Vector2(0.6, 0.6);
    const border = kit.material(
      `${rug.id}:border`,
      () =>
        new MeshStandardMaterial({
          color: RUG_STYLE.borderColor,
          roughness: 1,
          metalness: 0,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
    );
    const pad = 2 * RUG_STYLE.borderWidth;
    const fabricGeometry =
      rug.shape === 'round'
        ? new CircleGeometry(rug.width / 2, 40)
        : new PlaneGeometry(rug.width, rug.depth);
    const borderGeometry =
      rug.shape === 'round'
        ? new CircleGeometry(rug.width / 2 + RUG_STYLE.borderWidth, 40)
        : new PlaneGeometry(rug.width + pad, rug.depth + pad);
    // Textura por metros: la UV de 0..1 se escala al tamaño del tejido.
    const uv = fabricGeometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (uv.getX(i) * rug.width) / RUG_STYLE.tile,
        (uv.getY(i) * rug.depth) / RUG_STYLE.tile
      );
    }
    for (const [name, geometry, material, y] of [
      [`${rug.id}-border`, borderGeometry, border, RUG_STYLE.y - 0.002],
      [rug.id, fabricGeometry, fabric, RUG_STYLE.y],
    ] as const) {
      geometry.rotateX(-Math.PI / 2);
      const mesh = kit.addMesh(
        rug.zone,
        name,
        geometry,
        material,
        matrixAt(cx, y, cz, rug.rotationY),
        false
      );
      mesh.receiveShadow = true;
    }
  }
}
