import {
  AdditiveBlending,
  BufferGeometry,
  DataTexture,
  Euler,
  Group,
  LinearFilter,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PieceId } from '../piece-ids';
import type { PieceConfig } from '../pieces.config';
import { triangleCount } from './geometry';

/** Zonas de la sala: cada una es un `Group` con su esfera envolvente. */
export const ZONE_IDS = [
  'tvLounge',
  'work',
  'reading',
  'music',
  'tvWall',
  'ceiling',
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/**
 * Texturas ya cargadas, por clave (`floor:diffuse`, `floor:normal`,
 * `rug:diffuse`, `rug:normal`, `art:<id>`…). Ausentes o `null` dejan el color
 * plano. Quien construye asume su propiedad y las libera en `dispose`.
 */
export type PieceTextures = Readonly<
  Record<string, Texture | null | undefined>
>;

/** Mallas y partes visibles de una pieza (para el contorno y las acciones). */
export interface PieceBuildEntry {
  id: PieceId;
  zone: ZoneId;
  /**
   * Mallas que dibujan la pieza entera (el contorno sigue su silueta). Vacío
   * si la pieza comparte mallas fusionadas: el contorno usa entonces sus cajas
   * proxy.
   */
  visuals: Mesh[];
  /** Partes con nombre (`tv:screenA`, `turntable:platter`…). */
  parts: Record<string, Object3D>;
}

/** Colocador de una pieza: coordenadas locales (x ancho, z frente) → escena. */
export class Placer {
  private readonly origin: Matrix4;

  constructor(
    private readonly kit: BuildKit,
    readonly config: PieceConfig,
    readonly zone: ZoneId,
    /** Origen y giro: y siempre en coordenadas de escena (suelo = 0). */
    originOverride?: { position: Vector3; rotationY: number }
  ) {
    const position =
      originOverride?.position ??
      new Vector3(config.position[0], 0, config.position[2]);
    const rotation = originOverride?.rotationY ?? config.rotationY;
    this.origin = new Matrix4().compose(
      position,
      new Quaternion().setFromEuler(new Euler(0, rotation, 0)),
      new Vector3(1, 1, 1)
    );
  }

  /** Punto local → escena. */
  pointAt(x: number, y: number, z: number): Vector3 {
    return new Vector3().setFromMatrixPosition(this.matrix(x, y, z));
  }

  /** Matriz local → escena con posición (x, y, z) y giros opcionales. */
  matrix(x: number, y: number, z: number, rotation?: Euler): Matrix4 {
    const local = new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion().setFromEuler(rotation ?? new Euler()),
      new Vector3(1, 1, 1)
    );
    return new Matrix4().multiplyMatrices(this.origin, local);
  }

  /** Añade geometría a la malla fusionada del material en esta zona. */
  add(
    material: string,
    geometry: BufferGeometry,
    x: number,
    y: number,
    z: number,
    rotation?: Euler
  ): void {
    this.kit.addMerged(
      this.zone,
      material,
      geometry,
      this.matrix(x, y, z, rotation)
    );
  }

  /**
   * Malla propia con nombre (partes animadas o que otras pistas buscan por
   * nombre). Queda dentro de la zona; no se fusiona.
   */
  mesh(
    name: string,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    options: { rotation?: Euler; visual?: boolean; animated?: boolean } = {}
  ): Mesh {
    const mesh = this.kit.addMesh(
      this.zone,
      name,
      geometry,
      material,
      this.matrix(x, y, z, options.rotation),
      options.animated ?? false
    );
    if (options.visual)
      this.kit.entry(this.config.id, this.zone).visuals.push(mesh);
    this.kit.entry(this.config.id, this.zone).parts[name] = mesh;
    return mesh;
  }

  /** Registra un objeto (no malla) como parte con nombre de la pieza. */
  part(name: string, object: Object3D): void {
    this.kit.entry(this.config.id, this.zone).parts[name] = object;
  }
}

const SIZE_HALO = 64;

/** Textura radial blanca con caída suave (halos y charcos de luz). */
function radialTexture(): DataTexture {
  const data = new Uint8Array(SIZE_HALO * SIZE_HALO * 4);
  for (let y = 0; y < SIZE_HALO; y++) {
    for (let x = 0; x < SIZE_HALO; x++) {
      const dx = (x + 0.5) / SIZE_HALO - 0.5;
      const dy = (y + 0.5) / SIZE_HALO - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const i = (y * SIZE_HALO + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * (1 - r) * (1 - r));
    }
  }
  const texture = new DataTexture(
    data,
    SIZE_HALO,
    SIZE_HALO,
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
 * Contexto de construcción: materiales con clave (únicos y de su propiedad),
 * geometrías acumuladas por (zona, material) para fusionarlas, mallas con
 * nombre y el registro de piezas. `finish()` cierra y entrega todo.
 */
export class BuildKit {
  readonly zones = Object.fromEntries(
    ZONE_IDS.map(id => {
      const group = new Group();
      group.name = `zone:${id}`;
      return [id, group];
    })
  ) as Record<ZoneId, Group>;
  readonly entries = new Map<PieceId, PieceBuildEntry>();
  readonly named = new Map<string, Object3D>();
  readonly meshes: Mesh[] = [];
  /** Plantilla del jarrón de la sala (el aparador pone un clon); opcional. */
  vase: Object3D | null = null;

  private readonly materials = new Map<string, Material>();
  private readonly owned = new Set<{ dispose: () => void }>();
  private readonly buckets = new Map<string, BufferGeometry[]>();
  private readonly geometries = new Set<BufferGeometry>();
  private radial: DataTexture | null = null;
  private readonly claims = new Map<string, PieceId>();
  private readonly provided = new Map<string, Texture>();

  constructor(private readonly textures: PieceTextures) {
    // Las que llegan se toman aunque no se usen, para liberarlas todas.
    for (const texture of Object.values(textures)) {
      if (texture) this.own(texture);
    }
  }

  /** Punto de origen (para colocadores con origen propio). */
  origin(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z);
  }

  own<T extends { dispose: () => void }>(item: T): T {
    this.owned.add(item);
    return item;
  }

  /** Geometría propia (se libera en `dispose`). */
  geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry);
    return geometry;
  }

  texture(key: string): Texture | null {
    return this.provided.get(key) ?? this.textures[key] ?? null;
  }

  /** Añade una textura propia (p. ej. el `envMap` del espejo). */
  provide(key: string, texture: Texture): void {
    this.provided.set(key, texture);
    this.own(texture);
  }

  /** Textura radial compartida para halos y charcos. */
  radialMap(): DataTexture {
    this.radial ??= this.own(radialTexture());
    return this.radial;
  }

  /** Material por clave: se crea una vez y se comparte. */
  material<T extends Material>(key: string, make: () => T): T {
    const existing = this.materials.get(key);
    if (existing) return existing as T;
    const created = make();
    created.name = key;
    this.materials.set(key, created);
    return created;
  }

  /** Textura con repetición (suelo y alfombra). */
  tiled(key: string, colorSpace?: typeof SRGBColorSpace): Texture | null {
    const texture = this.texture(key);
    if (texture) {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      if (colorSpace) texture.colorSpace = colorSpace;
    }
    return texture;
  }

  /** Material aditivo de halo/charco (sin luz, sin tone mapping). */
  glowMaterial(key: string, color: number, opacity = 0): MeshBasicMaterial {
    return this.material(
      key,
      () =>
        new MeshBasicMaterial({
          color,
          map: this.radialMap(),
          transparent: true,
          opacity,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
    );
  }

  /**
   * La pieza es la única que usa este material en esta zona: su malla fusionada
   * cuenta como `visual` (el contorno sigue su silueta).
   */
  claim(id: PieceId, zone: ZoneId, material: string): void {
    this.claims.set(`${zone}|${material}`, id);
    this.entry(id, zone);
  }

  entry(id: PieceId, zone: ZoneId): PieceBuildEntry {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = { id, zone, visuals: [], parts: {} };
      this.entries.set(id, entry);
    }
    return entry;
  }

  addMerged(
    zone: ZoneId,
    material: string,
    geometry: BufferGeometry,
    matrix: Matrix4
  ): void {
    // Todo sin indexar y con position/normal/uv: así se puede fundir cualquier mezcla.
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    for (const name of Object.keys(flat.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name))
        flat.deleteAttribute(name);
    }
    flat.applyMatrix4(matrix);
    const key = `${zone}|${material}`;
    const list = this.buckets.get(key) ?? [];
    list.push(flat);
    this.buckets.set(key, list);
  }

  addMesh(
    zone: ZoneId,
    name: string,
    geometry: BufferGeometry,
    material: Material,
    matrix: Matrix4,
    animated: boolean
  ): Mesh {
    this.geometry(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.receiveShadow = material instanceof MeshStandardMaterial;
    mesh.raycast = () => undefined;
    if (!animated) {
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
    }
    this.zones[zone].add(mesh);
    this.named.set(name, mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  /** Funde cada (zona, material), crea las mallas y devuelve los recursos. */
  finish(): void {
    for (const [key, list] of this.buckets) {
      const [zone, materialKey] = key.split('|') as [ZoneId, string];
      const merged = mergeGeometries(list, false);
      list.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      const material = this.materials.get(materialKey);
      if (!material) {
        merged.dispose();
        continue;
      }
      this.geometry(merged);
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, material);
      mesh.name = `${zone}:${materialKey}`;
      mesh.receiveShadow = material instanceof MeshStandardMaterial;
      mesh.raycast = () => undefined;
      mesh.matrixAutoUpdate = false;
      this.zones[zone].add(mesh);
      this.named.set(mesh.name, mesh);
      this.meshes.push(mesh);
      const claimant = this.claims.get(key);
      if (claimant) this.entry(claimant, zone).visuals.push(mesh);
    }
    this.buckets.clear();
    this.claims.clear();
  }

  triangles(): number {
    return this.meshes.reduce(
      (sum, mesh) => sum + triangleCount(mesh.geometry),
      0
    );
  }

  /** Libera geometrías, materiales y texturas propios. */
  dispose(): void {
    this.geometries.forEach(geometry => geometry.dispose());
    this.geometries.clear();
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
    this.owned.forEach(item => item.dispose());
    this.owned.clear();
    this.provided.clear();
    this.buckets.forEach(list => list.forEach(g => g.dispose()));
    this.buckets.clear();
    Object.values(this.zones).forEach(zone => zone.clear());
    this.meshes.length = 0;
    this.named.clear();
    this.entries.clear();
  }
}

/** Material estándar con atajos. */
export function standard(
  color: number,
  roughness: number,
  extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

/** Paleta y materiales compartidos (spec A.1.6). */
export const PALETTE = {
  walnut: 0x5a4333,
  brass: 0xa8823f,
  cream: 0xe8dcc3,
  leaf: 0x4d7048,
  matte: 0xf4efe6,
  frame: 0x1f1b18,
  oak: 0xb98a58,
} as const;

/** Textura de veta de madera (gris, tileable), generada una vez sin canvas. */
export function grainTexture(size = 128): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Vetas largas en la dirección V con ondulación y poro fino.
      const stripe =
        Math.sin(
          (x / size) * Math.PI * 14 + Math.sin((y / size) * 6.28) * 1.4
        ) *
          0.5 +
        0.5;
      const pore = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = pore - Math.floor(pore);
      const v = 0.8 + 0.14 * stripe + 0.06 * noise;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(255 * Math.min(v, 1));
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
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Nogal compartido (con veta propia). */
export function walnutMaterial(kit: BuildKit): MeshStandardMaterial {
  return kit.material('walnut', () =>
    standard(PALETTE.walnut, 0.55, {
      map: kit.own(grainTexture()),
    })
  );
}

/** Latón compartido. */
export function brassMaterial(kit: BuildKit): MeshStandardMaterial {
  return kit.material('brass', () =>
    standard(PALETTE.brass, 0.42, { metalness: 0.6 })
  );
}

/** Roble: textura del suelo si hay, si no tono liso. */
export function oakMaterial(kit: BuildKit): MeshStandardMaterial {
  return kit.material('oak', () => {
    const map = kit.tiled('floor:diffuse', SRGBColorSpace);
    const normalMap = kit.tiled('floor:normal');
    return standard(map ? 0xffffff : PALETTE.oak, 0.6, {
      ...(map ? { map } : {}),
      ...(normalMap ? { normalMap } : {}),
    });
  });
}
