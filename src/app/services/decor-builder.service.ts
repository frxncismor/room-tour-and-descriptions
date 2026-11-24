import { Injectable } from '@angular/core';
import {
  AdditiveBlending,
  AlwaysStencilFunc,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DataTexture,
  Euler,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  PlaneGeometry,
  Quaternion,
  Side,
  RepeatWrapping,
  RGBAFormat,
  ReplaceStencilOp,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  Decor3Config,
  DecorBooksConfig,
  DecorTextilesConfig,
  DecorThrowConfig,
} from '../config/decor.config';

/**
 * Texturas ya cargadas por clave de carga (`art:<id>`, `fabric:<id>`). Un valor
 * ausente o `null` deja la pieza en color plano. El builder asume su propiedad y
 * las libera en `dispose`.
 */
export type DecorTextures = Readonly<
  Record<string, Texture | null | undefined>
>;

export type DecorPieceKind =
  | 'frame'
  | 'sconce'
  | 'window'
  | 'curtain'
  | 'rod'
  | 'lamp'
  | 'cushion'
  | 'throw'
  | 'halo';

/** Caja envolvente (en la escena) de una pieza lógica, para los tests de colocación. */
export interface DecorPieceBounds {
  id: string;
  kind: DecorPieceKind;
  box: Box3;
}

export interface DecorBuild {
  /** Grupo `decor3` con `wall-art`, `fixtures` y `textiles`. */
  group: Group;
  pieces: DecorPieceBounds[];
  /**
   * Los textiles (host `sofa`) y los libros (host `bookshelf`) escriben stencil
   * = 1 (la ref. del contorno) para contar como parte de la silueta de su
   * mueble: el casco del contorno no los rellena. Con otro mueble seleccionado
   * recortan su anillo (R8-M3), así que quien gestiona selección y hover debe
   * dejar activo solo el host seleccionado o con hover (`false` en el resto).
   * Al construir quedan activos (comportamiento previo, seguro sin cableado).
   */
  setSilhouette: (host: DecorSilhouetteHost, active: boolean) => void;
  /** Libera geometrías, materiales y texturas y vacía el grupo. */
  dispose: () => void;
}

/** Muebles del glTF que «poseen» piezas de la decoración procedural. */
export type DecorSilhouetteHost = 'sofa' | 'bookshelf';

type GroupName = 'wall-art' | 'fixtures' | 'textiles';

const RADIAL_SEGMENTS = 24;
const HALO_SIZE = 64;
const GLASS_STEPS = 128;

/** Pieza que acumula geometrías ya colocadas, por material, para fusionarlas. */
class Collector {
  private readonly parts = new Map<string, BufferGeometry[]>();
  readonly pieces: DecorPieceBounds[] = [];

  add(
    material: string,
    geometry: BufferGeometry,
    matrix: Matrix4,
    piece?: DecorPieceBounds
  ): void {
    geometry.applyMatrix4(matrix);
    if (piece) {
      geometry.computeBoundingBox();
      piece.box.union(geometry.boundingBox as Box3);
    }
    const list = this.parts.get(material) ?? [];
    list.push(geometry);
    this.parts.set(material, list);
  }

  piece(id: string, kind: DecorPieceKind): DecorPieceBounds {
    const piece = { id, kind, box: new Box3() };
    this.pieces.push(piece);
    return piece;
  }

  /** Una geometría fusionada por material; libera las partes. */
  merged(material: string): BufferGeometry | null {
    const list = this.parts.get(material);
    if (!list?.length) {
      return null;
    }
    const merged = mergeGeometries(list, false);
    list.forEach(geometry => geometry.dispose());
    this.parts.delete(material);
    return merged;
  }
}

function matrixOf(
  position: Vector3,
  rotation: Euler | number = 0,
  scale = 1
): Matrix4 {
  const quaternion = new Quaternion().setFromEuler(
    typeof rotation === 'number' ? new Euler(0, rotation, 0) : rotation
  );
  return new Matrix4().compose(
    position,
    quaternion,
    new Vector3(scale, scale, scale)
  );
}

function scaleUv(geometry: BufferGeometry, u: number, v: number): void {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  }
  uv.needsUpdate = true;
}

/**
 * Cojín: caja de esquinas y aristas redondeadas (la proyección de siempre de
 * `RoundedBoxGeometry`, con una malla de pocos segmentos) y cara abombada por
 * `cushionPuff`. Centrado, grosor en Z. Normales analíticas: sin costuras.
 */
export function createCushionGeometry(
  textiles: Pick<
    DecorTextilesConfig,
    'cushionSize' | 'cushionThickness' | 'cushionPuff' | 'cushionCorner'
  >
): BufferGeometry {
  const { cushionSize: size, cushionThickness: thick, cushionPuff } = textiles;
  const radius = Math.min(textiles.cushionCorner, thick / 2);
  const half = size / 2;
  const inner = new Vector3(half - radius, half - radius, thick / 2 - radius);
  const geometry = new BoxGeometry(size, size, thick, 8, 8, 4);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const shade = new Float32Array(position.count * 3);
  const point = new Vector3();
  const clamped = new Vector3();
  const direction = new Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    clamped.set(
      Math.max(-inner.x, Math.min(inner.x, point.x)),
      Math.max(-inner.y, Math.min(inner.y, point.y)),
      Math.max(-inner.z, Math.min(inner.z, point.z))
    );
    direction.subVectors(point, clamped).normalize();
    const xn = point.x / half;
    const yn = point.y / half;
    const sign = Math.sign(point.z);
    const bulge = (1 - xn * xn) * (1 - yn * yn);
    // Abombado: la superficie z = f(x, y) tiene normal ∝ (-fx, -fy, 1).
    const slope = (cushionPuff * sign) / half;
    const weight = Math.abs(direction.z);
    const nx = direction.x + weight * slope * 2 * xn * (1 - yn * yn);
    const ny = direction.y + weight * slope * 2 * yn * (1 - xn * xn);
    const length = Math.hypot(nx, ny, direction.z);
    position.setXYZ(
      i,
      clamped.x + direction.x * radius,
      clamped.y + direction.y * radius,
      clamped.z + direction.z * radius + sign * cushionPuff * bulge
    );
    normal.setXYZ(i, nx / length, ny / length, direction.z / length);
    // Costuras: oscurece hacia el borde (volumen sin más textura).
    const seam = Math.min(
      1,
      Math.max(0, (Math.max(Math.abs(xn), Math.abs(yn)) - 0.7) / 0.3)
    );
    const tone = 1 - 0.3 * seam * seam;
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = tone;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(shade, 3));
  return geometry;
}

/** Color por vértice uniforme sobre una geometría (para fusionarla con otras que lo llevan). */
function paint(
  geometry: BufferGeometry,
  color: Color,
  tone = 1
): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    data[i * 3] = color.r * tone;
    data[i * 3 + 1] = color.g * tone;
    data[i * 3 + 2] = color.b * tone;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
  return geometry;
}

/** Generador pseudoaleatorio determinista (mulberry32): la misma sala siempre. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Manta: losa de tela con grosor (dos capas y borde), pliegue ancho y suave,
 * un doblez a lo largo y caída de los bordes largos. En el plano XY, grosor en
 * Z; la cara superior es +Z.
 */
export function createThrowGeometry(
  blanket: DecorThrowConfig,
  tileSize: number
): BufferGeometry {
  const geometry = new BoxGeometry(
    blanket.width,
    blanket.depth,
    blanket.thickness,
    24,
    14,
    1
  );
  const position = geometry.getAttribute('position');
  const halfW = blanket.width / 2;
  const halfD = blanket.depth / 2;
  // Doblez a lo largo y caída de los bordes largos (y = ±depth/2), como sobre
  // el brazo o el puf: no dependen de x.
  const along = (y: number): number => {
    const crease = blanket.creaseHeight * Math.exp(-(((y + 0.12) / 0.07) ** 2));
    const edge = Math.max(0, Math.abs(y) / halfD - 0.55) / 0.45;
    return crease - blanket.drape * edge * edge;
  };
  const tone = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const wave =
      blanket.foldAmplitude *
      Math.sin((2 * Math.PI * (x + halfW)) / blanket.foldPeriod);
    // Arrugas suaves y deterministas: rompen la losa lisa sin más texturas.
    const wrinkle =
      0.003 * Math.sin(x * 31 + y * 17) * Math.sin(y * 23 - x * 11);
    position.setZ(i, position.getZ(i) + wave + wrinkle + along(y));
    // Dos franjas tejidas junto a cada extremo (color por vértice).
    const end = halfW - Math.abs(x);
    const stripe = Math.max(
      Math.exp(-(((end - 0.04) / 0.012) ** 2)),
      Math.exp(-(((end - 0.12) / 0.012) ** 2))
    );
    tone[i * 3] =
      tone[i * 3 + 1] =
      tone[i * 3 + 2] =
        1 - (1 - blanket.stripeTone) * stripe;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(tone, 3));
  geometry.computeVertexNormals();
  scaleUv(geometry, blanket.width / tileSize, blanket.depth / tileSize);

  // Flecos: tiras finas que cuelgan de los dos extremos cortos.
  const pieces: BufferGeometry[] = [geometry];
  const spacing = 0.036;
  const strands = Math.floor((blanket.depth - 0.04) / spacing);
  const fringeTone = new Color(1, 1, 1);
  for (const sign of [-1, 1]) {
    for (let k = 0; k <= strands; k++) {
      const y = -halfD + 0.02 + k * spacing;
      const strand = new BoxGeometry(blanket.fringe, 0.014, 0.004);
      strand.translate(sign * (blanket.fringe / 2 - 0.002), 0, 0);
      strand.rotateY(sign * 0.25);
      strand.translate(sign * halfW, y, along(y));
      pieces.push(paint(strand, fringeTone, 0.88));
    }
  }
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(piece => piece.dispose());
  return merged;
}

/**
 * Libros y un bote sobre las baldas de la estantería, ya colocados en la escena
 * y con color por vértice (lomo al frente, cortes claros). Determinista.
 */
export function createBooks(config: DecorBooksConfig): BufferGeometry[] {
  const random = seeded(2024);
  const result: BufferGeometry[] = [];
  const spine = new Color();
  const pages = new Color(0xe8dcc0);
  /** Pinta lomo (cara +Z), cortes (cara superior) y tapas (resto). */
  const book = (
    width: number,
    height: number,
    depth: number,
    color: Color
  ): BufferGeometry => {
    const geometry = new BoxGeometry(width, height, depth);
    const normal = geometry.getAttribute('normal');
    const data = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const source =
        normal.getZ(i) > 0.5 ? color : normal.getY(i) > 0.5 ? pages : color;
      const tone = normal.getZ(i) > 0.5 || normal.getY(i) > 0.5 ? 1 : 0.8;
      data[i * 3] = source.r * tone;
      data[i * 3 + 1] = source.g * tone;
      data[i * 3 + 2] = source.b * tone;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
    return geometry;
  };
  const pick = (): Color => {
    spine.setHex(config.palette[Math.floor(random() * config.palette.length)]);
    return spine.clone().multiplyScalar(0.85 + random() * 0.3);
  };
  for (const tier of config.tiers) {
    for (const run of tier.runs) {
      const lean = run.lean ?? 0;
      let cursor = run.from;
      const reserve = lean ? 0.3 : 0;
      for (;;) {
        const width = 0.028 + random() * 0.025;
        const height = 0.2 + random() * (tier.maxHeight - 0.2);
        if (cursor + width > run.to - reserve) {
          break;
        }
        const depth = Math.min(config.depth, 0.16 + random() * 0.06);
        result.push(
          book(width, height, depth, pick()).translate(
            cursor + width / 2,
            tier.top + height / 2,
            config.zCenter + (random() - 0.5) * 0.012
          )
        );
        cursor += width + 0.002;
      }
      if (lean) {
        // El último libro se apoya en el vecino: pivota sobre su arista inferior izquierda.
        const width = 0.04;
        const height = 0.3;
        const pivot = cursor + height * Math.sin(lean);
        result.push(
          book(width, height, 0.19, pick())
            .translate(width / 2, height / 2, 0)
            .rotateZ(lean)
            .translate(pivot, tier.top, config.zCenter)
        );
      }
    }
    if (tier.stack) {
      for (let k = 0; k < tier.stack.count; k++) {
        const width = 0.24 + random() * 0.05;
        const height = 0.032 + random() * 0.012;
        const base = tier.top + k * 0.04;
        result.push(
          book(width, height, 0.18, pick())
            .translate(width / 2, height / 2, 0)
            .rotateY((random() - 0.5) * 0.2)
            .translate(tier.stack.x, base, config.zCenter)
        );
      }
    }
    if (tier.jar !== undefined) {
      const jar = new CylinderGeometry(0.05, 0.058, 0.17, RADIAL_SEGMENTS);
      result.push(
        paint(
          jar.translate(tier.jar, tier.top + 0.085, config.zCenter),
          new Color(config.jarColor)
        )
      );
    }
  }
  return result;
}

/** Cilindro con el eje en Z, centrado (placas y brazos de los apliques, barra). */
function cylinderAlongZ(
  radiusTop: number,
  radiusBottom: number,
  length: number
): BufferGeometry {
  return new CylinderGeometry(
    radiusTop,
    radiusBottom,
    length,
    RADIAL_SEGMENTS
  ).rotateX(Math.PI / 2);
}

/** Textura de halo: radial blanca con caída suave, generada sin canvas. */
function createHaloTexture(): DataTexture {
  const data = new Uint8Array(HALO_SIZE * HALO_SIZE * 4);
  for (let y = 0; y < HALO_SIZE; y++) {
    for (let x = 0; x < HALO_SIZE; x++) {
      const dx = (x + 0.5) / HALO_SIZE - 0.5;
      const dy = (y + 0.5) / HALO_SIZE - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const falloff = (1 - r) * (1 - r);
      const i = (y * HALO_SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * falloff);
    }
  }
  const texture = new DataTexture(
    data,
    HALO_SIZE,
    HALO_SIZE,
    RGBAFormat,
    UnsignedByteType
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Degradado vertical del cristal (abajo → arriba), 1 × N. */
function createGlassTexture(from: number, to: number): DataTexture {
  const data = new Uint8Array(GLASS_STEPS * 4);
  const a = new Color(from);
  const b = new Color(to);
  const mixed = new Color();
  for (let y = 0; y < GLASS_STEPS; y++) {
    mixed.copy(a).lerp(b, y / (GLASS_STEPS - 1));
    const srgb = mixed.getHex(SRGBColorSpace);
    const i = y * 4;
    data[i] = (srgb >> 16) & 255;
    data[i + 1] = (srgb >> 8) & 255;
    data[i + 2] = srgb & 255;
    data[i + 3] = 255;
  }
  const texture = new DataTexture(
    data,
    1,
    GLASS_STEPS,
    RGBAFormat,
    UnsignedByteType
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Decoración procedural de las paredes y los textiles (spec 003, A.2 y B.3). */
@Injectable({ providedIn: 'root' })
export class DecorBuilderService {
  /**
   * Construye el grupo `decor3`. Sin trabajo por frame: todo es geometría
   * estática fusionada por material (un draw call por material).
   */
  build(config: Decor3Config, textures: DecorTextures = {}): DecorBuild {
    const owned = new Set<{ dispose: () => void }>();
    const own = <T extends { dispose: () => void }>(item: T): T => {
      owned.add(item);
      return item;
    };
    const tex = (key: string): Texture | null => {
      const texture = textures[key] ?? null;
      if (texture) {
        own(texture);
      }
      return texture;
    };
    // Las que llegan se toman aunque no se usen, para liberarlas todas.
    Object.keys(textures).forEach(key => tex(key));

    const linen = tex('fabric:linen');
    const linenNormal = tex('fabric:linen-nor');
    for (const fabric of [linen, linenNormal]) {
      if (fabric) {
        fabric.wrapS = fabric.wrapT = RepeatWrapping;
      }
    }
    if (linen) {
      linen.colorSpace = SRGBColorSpace;
    }

    const collector = new Collector();
    const materials = new Map<string, Material>();
    const material = (key: string, make: () => Material): string => {
      materials.set(key, own(make()));
      return key;
    };

    const standard = (
      color: number,
      roughness: number,
      extra: MeshStandardMaterialParameters = {}
    ): MeshStandardMaterial =>
      new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

    const linenMaterial = (
      color: number,
      roughness: number,
      normalScale: number,
      side?: Side
    ): MeshStandardMaterial => {
      const result = standard(color, roughness, {
        map: linen,
        normalMap: linenNormal,
        ...(side === undefined ? {} : { side }),
      });
      result.normalScale = new Vector2(normalScale, normalScale);
      return result;
    };

    // El lino de la difusa (nivel 20–95 %) oscurece el tinte: se compensa para
    // que crema y arena se lean como tales.
    const brighten = (
      result: MeshStandardMaterial,
      factor: number
    ): MeshStandardMaterial => {
      result.color.multiplyScalar(factor);
      return result;
    };

    const {
      frame,
      artworks,
      brass,
      sconces,
      window: win,
      curtains,
      floorLamp,
      textiles,
    } = config;

    // ── wall-art: marcos, paspartús y obras ────────────────────────────────
    const matKey = material('mat', () => standard(frame.matColor, 0.95));
    const frameKey = material('frame', () =>
      standard(frame.frameColor, frame.frameRoughness)
    );
    const artKeys = new Map<string, string>();
    for (const artwork of artworks) {
      const key = `art:${artwork.art}`;
      if (!artKeys.has(key)) {
        const map = tex(key);
        if (map) {
          map.colorSpace = SRGBColorSpace;
        }
        artKeys.set(
          key,
          material(key, () => standard(0xffffff, 0.9, { map }))
        );
      }
    }
    const artInnerW = frame.width - 2 * (frame.border + frame.mat);
    const artInnerH = frame.height - 2 * (frame.border + frame.mat);
    const matW = frame.width - 2 * frame.border;
    const matH = frame.height - 2 * frame.border;
    const matDepth = 0.01;
    for (const artwork of artworks) {
      const piece = collector.piece(artwork.id, 'frame');
      const origin = matrixOf(artwork.position, artwork.rotationY);
      const place = (x: number, y: number, z: number): Matrix4 =>
        new Matrix4().multiplyMatrices(origin, matrixOf(new Vector3(x, y, z)));
      const bars: [number, number, number, number][] = [
        // [ancho, alto, x, y] en el plano del marco
        [frame.width, frame.border, 0, (frame.height - frame.border) / 2],
        [frame.width, frame.border, 0, -(frame.height - frame.border) / 2],
        [
          frame.border,
          frame.height - 2 * frame.border,
          -(frame.width - frame.border) / 2,
          0,
        ],
        [
          frame.border,
          frame.height - 2 * frame.border,
          (frame.width - frame.border) / 2,
          0,
        ],
      ];
      for (const [w, h, x, y] of bars) {
        collector.add(
          frameKey,
          new BoxGeometry(w, h, frame.depth),
          place(x, y, 0),
          piece
        );
      }
      // Paspartú al fondo del marco y obra apenas por delante.
      const backZ = -frame.depth / 2 + matDepth / 2;
      collector.add(
        matKey,
        new BoxGeometry(matW, matH, matDepth),
        place(0, 0, backZ),
        piece
      );
      collector.add(
        artKeys.get(`art:${artwork.art}`) as string,
        new PlaneGeometry(artInnerW, artInnerH),
        place(0, 0, -frame.depth / 2 + matDepth + 0.003),
        piece
      );
    }

    // ── fixtures ───────────────────────────────────────────────────────────
    const brassKey = material('brass', () =>
      standard(brass.color, brass.roughness, { metalness: brass.metalness })
    );
    const sconceShadeKey = material('sconce-shade', () =>
      standard(sconces.shade.color, 0.6, {
        emissive: new Color(sconces.shade.emissive),
        emissiveIntensity: sconces.shade.emissiveIntensity,
        side: DoubleSide,
      })
    );
    const haloTexture = own(createHaloTexture());
    const haloKey = material(
      'halo',
      () =>
        new MeshBasicMaterial({
          color: sconces.halo.color,
          map: haloTexture,
          transparent: true,
          opacity: sconces.halo.opacity,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
    );

    sconces.positions.forEach((position, index) => {
      const piece = collector.piece(`sconce-${index}`, 'sconce');
      collector.add(
        brassKey,
        cylinderAlongZ(
          sconces.plateRadius,
          sconces.plateRadius,
          sconces.plateDepth
        ),
        matrixOf(position),
        piece
      );
      collector.add(
        brassKey,
        cylinderAlongZ(sconces.armRadius, sconces.armRadius, sconces.armLength),
        matrixOf(
          position
            .clone()
            .add(
              new Vector3(0, 0, sconces.plateDepth / 2 + sconces.armLength / 2)
            )
        ),
        piece
      );
      const { shade } = sconces;
      const shadeCenter = position
        .clone()
        .add(
          new Vector3(
            0,
            0,
            sconces.plateDepth / 2 +
              sconces.armLength +
              shade.radiusBottom * 0.5
          )
        );
      const shadeMatrix = matrixOf(shadeCenter);
      collector.add(
        sconceShadeKey,
        new CylinderGeometry(
          shade.radiusTop,
          shade.radiusBottom,
          shade.height,
          RADIAL_SEGMENTS,
          1,
          true
        ),
        shadeMatrix,
        piece
      );
      // Volumen: tapa superior, bombilla visible por la boca y casquillo de latón.
      collector.add(
        sconceShadeKey,
        new CircleGeometry(shade.radiusTop, RADIAL_SEGMENTS).rotateX(
          -Math.PI / 2
        ),
        matrixOf(shadeCenter.clone().add(new Vector3(0, shade.height / 2, 0))),
        piece
      );
      collector.add(
        sconceShadeKey,
        new SphereGeometry(shade.radiusTop * 0.62, 12, 9),
        matrixOf(
          shadeCenter.clone().add(new Vector3(0, -shade.height * 0.28, 0))
        ),
        piece
      );
      collector.add(
        brassKey,
        new CylinderGeometry(
          shade.radiusTop * 0.45,
          shade.radiusTop * 0.45,
          0.03,
          RADIAL_SEGMENTS
        ),
        matrixOf(
          shadeCenter.clone().add(new Vector3(0, shade.height / 2 + 0.015, 0))
        ),
        piece
      );
      collector.add(
        haloKey,
        new PlaneGeometry(sconces.halo.diameter, sconces.halo.diameter),
        matrixOf(position.clone().add(sconces.halo.offset)),
        collector.piece(`sconce-halo-${index}`, 'halo')
      );
    });

    // Ventana: marco, cruceta, antepecho, cristal y halo (modelados mirando a +Z).
    const winFrameKey = material('window-frame', () =>
      standard(win.frame.color, win.frame.roughness)
    );
    const glassTexture = own(createGlassTexture(win.glassFrom, win.glassTo));
    const glassKey = material(
      'glass',
      () =>
        new MeshBasicMaterial({
          map: glassTexture,
          toneMapped: false,
          fog: false,
        })
    );
    const winMatrix = matrixOf(win.position, win.rotationY);
    const toWindow = (x: number, y: number, z: number): Matrix4 =>
      new Matrix4().multiplyMatrices(winMatrix, matrixOf(new Vector3(x, y, z)));
    {
      const piece = collector.piece('window', 'window');
      const { glassWidth: gw, glassHeight: gh } = win;
      const { bar, depth, mullion } = win.frame;
      // El cristal queda a 0,01 m del muro: el marco ocupa de -0,01 a +0,04.
      const zFrame = -0.01 + depth / 2;
      collector.add(
        glassKey,
        new PlaneGeometry(gw, gh),
        toWindow(0, 0, 0),
        piece
      );
      const winBars: [number, number, number, number][] = [
        [gw + 2 * bar, bar, 0, (gh + bar) / 2],
        [gw + 2 * bar, bar, 0, -(gh + bar) / 2],
        [bar, gh, -(gw + bar) / 2, 0],
        [bar, gh, (gw + bar) / 2, 0],
        [mullion, gh, 0, 0],
        [gw, mullion, 0, 0],
      ];
      for (const [w, h, x, y] of winBars) {
        collector.add(
          winFrameKey,
          new BoxGeometry(w, h, depth),
          toWindow(x, y, zFrame),
          piece
        );
      }
      const { sill } = win;
      collector.add(
        winFrameKey,
        new BoxGeometry(sill.length, sill.thickness, sill.depth),
        toWindow(0, -gh / 2 - bar - sill.thickness / 2, -0.01 + sill.depth / 2),
        piece
      );
      collector.add(
        haloKey,
        new PlaneGeometry(win.halo.diameter, win.halo.diameter),
        toWindow(0, 0, win.halo.offset),
        collector.piece('window-halo', 'halo')
      );
    }

    // Cortinas: paños con pliegues senoidales y barra de latón.
    const curtainKey = material('curtain', () =>
      linenMaterial(
        curtains.color,
        curtains.roughness,
        textiles.normalScale,
        DoubleSide
      )
    );
    curtains.panelZ.forEach((z, index) => {
      const piece = collector.piece(`curtain-${index}`, 'curtain');
      const widthSegments = Math.round(
        (curtains.panelWidth / curtains.foldPeriod) * 8
      );
      const geometry = new PlaneGeometry(
        curtains.panelWidth,
        curtains.panelHeight,
        widthSegments,
        6
      );
      const position = geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        position.setZ(
          i,
          curtains.foldAmplitude *
            Math.sin(
              (2 * Math.PI * (x + curtains.panelWidth / 2)) /
                curtains.foldPeriod
            )
        );
      }
      geometry.computeVertexNormals();
      scaleUv(
        geometry,
        curtains.panelWidth / curtains.tileSize,
        curtains.panelHeight / curtains.tileSize
      );
      collector.add(
        curtainKey,
        geometry,
        matrixOf(
          new Vector3(
            curtains.x,
            curtains.bottom + curtains.panelHeight / 2,
            z
          ),
          Math.PI / 2
        ),
        piece
      );
    });
    {
      const { rod } = curtains;
      collector.add(
        brassKey,
        cylinderAlongZ(rod.radius, rod.radius, Math.abs(rod.zTo - rod.zFrom)),
        matrixOf(new Vector3(rod.x, rod.y, (rod.zFrom + rod.zTo) / 2)),
        collector.piece('curtain-rod', 'rod')
      );
    }

    // Lámpara de pie (no interactiva; su luz la pone RoomBuilderService).
    {
      const piece = collector.piece('floor-lamp', 'lamp');
      // `floorLamp:shade`: nombre y material propios (no fusionado con otros)
      // para que `PieceActionsRuntime` apague también la pantalla (R8-M4).
      const lampShadeKey = material('floorLamp:shade', () =>
        standard(floorLamp.shade.color, 0.7, {
          emissive: new Color(floorLamp.shade.emissive),
          emissiveIntensity: floorLamp.shade.emissiveIntensity,
          side: DoubleSide,
        })
      );
      const at = (y: number): Matrix4 =>
        matrixOf(floorLamp.position.clone().add(new Vector3(0, y, 0)));
      collector.add(
        brassKey,
        new CylinderGeometry(
          floorLamp.baseRadius,
          floorLamp.baseRadius,
          floorLamp.baseHeight,
          RADIAL_SEGMENTS
        ),
        at(floorLamp.baseHeight / 2),
        piece
      );
      const rodHeight = floorLamp.rodTop - floorLamp.baseHeight;
      collector.add(
        brassKey,
        new CylinderGeometry(
          floorLamp.rodRadius,
          floorLamp.rodRadius,
          rodHeight,
          12
        ),
        at(floorLamp.baseHeight + rodHeight / 2),
        piece
      );
      collector.add(
        lampShadeKey,
        new CylinderGeometry(
          floorLamp.shade.radiusTop,
          floorLamp.shade.radius,
          floorLamp.shade.height,
          RADIAL_SEGMENTS,
          1,
          true
        ),
        at(floorLamp.shade.bottom + floorLamp.shade.height / 2),
        piece
      );
      // Volumen: tapa, bombilla bajo la boca y remate de latón.
      collector.add(
        lampShadeKey,
        new CircleGeometry(floorLamp.shade.radiusTop, RADIAL_SEGMENTS).rotateX(
          -Math.PI / 2
        ),
        at(floorLamp.shade.bottom + floorLamp.shade.height),
        piece
      );
      collector.add(
        lampShadeKey,
        new SphereGeometry(0.055, 12, 9),
        at(floorLamp.shade.bottom + floorLamp.shade.height * 0.3),
        piece
      );
      collector.add(
        brassKey,
        new SphereGeometry(0.022, 12, 8),
        at(floorLamp.shade.bottom + floorLamp.shade.height + 0.018),
        piece
      );
    }

    // ── textiles: cojines y manta ──────────────────────────────────────────
    // Escriben stencil = 1 (ver `setSilhouette`): su silueta cuenta como parte
    // del mueble y el casco del contorno no los rellena. Con otro mueble
    // seleccionado conviene apagarlo (R8-M3).
    const silhouettes: Record<DecorSilhouetteHost, Material[]> = {
      sofa: [],
      bookshelf: [],
    };
    const textileMaterials = silhouettes.sofa;
    const textile = (
      key: string,
      color: number,
      normalScale: number
    ): string => {
      material(key, () => {
        const made = brighten(
          linenMaterial(color, textiles.roughness, normalScale),
          textiles.brightness
        );
        made.vertexColors = true;
        textileMaterials.push(made);
        return made;
      });
      return key;
    };
    const cushionKeys = textiles.cushions.map(cushion =>
      textile(`textile:${cushion.id}`, cushion.color, textiles.normalScale)
    );
    textiles.cushions.forEach((cushion, index) => {
      collector.add(
        cushionKeys[index],
        createCushionGeometry(textiles),
        matrixOf(cushion.position, cushion.rotation),
        collector.piece(cushion.id, 'cushion')
      );
    });
    {
      const blanket = textiles.throw;
      const throwKey = textile(
        'textile:throw',
        blanket.color,
        textiles.throwNormalScale
      );
      // La losa mira a +Z: se tumba para que su cara superior apunte arriba.
      collector.add(
        throwKey,
        createThrowGeometry(blanket, textiles.tileSize),
        matrixOf(
          blanket.position,
          new Euler(-Math.PI / 2, blanket.rotationY, 0, 'YXZ')
        ),
        collector.piece(blanket.id, 'throw')
      );
    }
    const setSilhouette = (
      host: DecorSilhouetteHost,
      active: boolean
    ): void => {
      for (const m of silhouettes[host]) {
        m.stencilWrite = active;
        m.stencilRef = 1;
        m.stencilFunc = AlwaysStencilFunc;
        m.stencilZPass = ReplaceStencilOp;
      }
    };

    // ── libros y bote sobre las baldas de la estantería (R8-M4) ─────────────
    const booksKey = material('books', () => {
      const made = standard(0xffffff, 0.85, { vertexColors: true });
      silhouettes.bookshelf.push(made);
      return made;
    });
    createBooks(config.books).forEach(geometry =>
      collector.add(booksKey, geometry, new Matrix4())
    );

    // ── ensamblado: una malla por material, en su grupo ────────────────────
    const group = new Group();
    group.name = 'decor3';
    const sub: Record<GroupName, Group> = {
      'wall-art': new Group(),
      fixtures: new Group(),
      textiles: new Group(),
    };
    (Object.keys(sub) as GroupName[]).forEach(name => {
      sub[name].name = name;
      group.add(sub[name]);
    });
    const destination = (key: string): GroupName => {
      if (key === 'mat' || key === 'frame' || key.startsWith('art:')) {
        return 'wall-art';
      }
      return key.startsWith('textile:') ? 'textiles' : 'fixtures';
    };
    const geometries: BufferGeometry[] = [];
    for (const [key, mat] of materials) {
      const geometry = collector.merged(key);
      if (!geometry) {
        continue;
      }
      geometries.push(geometry);
      const mesh = new Mesh(geometry, mat);
      mesh.name = key;
      mesh.castShadow = false;
      mesh.receiveShadow = mat instanceof MeshStandardMaterial;
      mesh.raycast = () => undefined;
      sub[destination(key)].add(mesh);
    }

    // Estado inicial: activos, como antes (sin cableado de selección no se rellenan).
    setSilhouette('sofa', true);
    setSilhouette('bookshelf', true);

    return {
      group,
      pieces: collector.pieces,
      setSilhouette,
      dispose: () => {
        geometries.forEach(geometry => geometry.dispose());
        owned.forEach(item => item.dispose());
        group.clear();
        sub['wall-art'].clear();
        sub.fixtures.clear();
        sub.textiles.clear();
        geometries.length = 0;
        owned.clear();
      },
    };
  }
}
