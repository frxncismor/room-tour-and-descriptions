/**
 * Pegamento perezoso de las piezas (spec 004, T-488): todo lo que `SceneService`
 * necesita de `pieces/**` va aquí, en un solo chunk que se importa junto a la
 * decoración 3. Así el bundle inicial no paga builders, runtime ni audio.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DECOR3 } from '../config/decor.config';
import { FURNITURE_IDS } from '../i18n/messages';
import type { PieceInfo } from '../interfaces/scene.interface';
import {
  PieceActionsRuntime,
  PieceActionsOptions,
  Plate,
} from '../pieces/piece-actions.runtime';
import {
  PiecesBuild,
  PiecesBuilderService,
  PieceModelSpec,
  pieceModelSpecs,
} from '../pieces/pieces-builder.service';
import type { PieceId } from '../pieces/piece-ids';
import { PIECES, PIECES_BY_ID } from '../pieces/pieces.config';
import { TurntableAudio } from '../pieces/turntable-audio';
import type { ObjectInteractionService } from './object-interaction.service';
import { freezeMatrices } from './model-loader.service';

export { PiecesBuilderService, PieceActionsRuntime, TurntableAudio, PIECES };

/** Láminas nuevas E–H (clave de carga → archivo). */
export const PLATE_TEXTURES = {
  'plate:e': 'assets/textures/art/e.webp',
  'plate:f': 'assets/textures/art/f.webp',
  'plate:g': 'assets/textures/art/g.webp',
  'plate:h': 'assets/textures/art/h.webp',
} as const;
export type PlateKey = keyof typeof PLATE_TEXTURES;

/** Las 8 obras de la TV, en orden de pase (títulos = nombres propios, no se traducen). */
export const PLATE_SEQUENCE: readonly { key: string; title: string }[] = [
  {
    key: 'art:spiraea',
    title: 'Spiraea aruncus (Tyrol), Anna Atkins, 1851–54',
  },
  { key: 'art:felce', title: 'Felce, William Henry Fox Talbot, 1839' },
  {
    key: 'art:osmunda',
    title: 'Osmunda regalis (Australia), Anna Atkins, c. 1850',
  },
  { key: 'art:pteris', title: 'Pteris aquilina, Anna Atkins, c. 1850' },
  {
    key: 'plate:e',
    title: 'Asplenium Braziliense, S. America, Anna Atkins, 1854',
  },
  { key: 'plate:f', title: 'Foreign Ferns, Anna Atkins, 1845/1855' },
  { key: 'plate:g', title: 'New Zealand, Anna Atkins, 1848/1859' },
  { key: 'plate:h', title: 'Carex (America), Anna Atkins, 1848/1853' },
];

/** Dónde cuelga cada lámina nueva (de `pieces.config`). */
function platePlacements(): {
  key: PlateKey;
  position: Vector3;
  rotationY: number;
}[] {
  const front = PIECES_BY_ID.printsFront;
  const at = (
    key: PlateKey,
    position: readonly [number, number, number],
    rotationY: number
  ) => ({ key, position: new Vector3(...position), rotationY });
  return [
    at('plate:e', front.proxies[0].position, front.rotationY),
    at('plate:f', front.proxies[1].position, front.rotationY),
    at(
      'plate:g',
      PIECES_BY_ID.printNook.position,
      PIECES_BY_ID.printNook.rotationY
    ),
    at(
      'plate:h',
      PIECES_BY_ID.printRight.position,
      PIECES_BY_ID.printRight.rotationY
    ),
  ];
}

/** Carga E–H; cada una informa su fracción (0–1). Las que fallen se omiten y se listan. */
export async function loadPlateTextures(
  onProgress: (key: PlateKey, fraction: number) => void
): Promise<{
  textures: Partial<Record<PlateKey, Texture>>;
  failed: PlateKey[];
  reasons: unknown[];
}> {
  const loader = new TextureLoader();
  const keys = Object.keys(PLATE_TEXTURES) as PlateKey[];
  const textures: Partial<Record<PlateKey, Texture>> = {};
  const failed: PlateKey[] = [];
  const reasons: unknown[] = [];
  await Promise.all(
    keys.map(async key => {
      try {
        const texture = await loader.loadAsync(PLATE_TEXTURES[key], event => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(key, event.loaded / event.total);
          }
        });
        texture.colorSpace = SRGBColorSpace;
        textures[key] = texture;
      } catch (error) {
        failed.push(key);
        reasons.push(error);
      }
    })
  );
  return { textures, failed, reasons };
}

/** Marcos y láminas E–H como las de la 003 (marco, paspartú y obra), una malla por material y lámina. */
export function buildPlateFrames(
  textures: Partial<Record<PlateKey, Texture>>
): { group: Group; dispose: () => void } {
  const { frame } = DECOR3;
  const group = new Group();
  group.name = 'plates-efgh';
  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];
  const standard = (color: number, roughness: number, map?: Texture) => {
    const material = new MeshStandardMaterial({
      color,
      roughness,
      metalness: 0,
      ...(map ? { map } : {}),
    });
    materials.push(material);
    return material;
  };
  const frameMaterial = standard(frame.frameColor, frame.frameRoughness);
  const matMaterial = standard(frame.matColor, 0.95);
  const innerW = frame.width - 2 * (frame.border + frame.mat);
  const innerH = frame.height - 2 * (frame.border + frame.mat);
  const matDepth = 0.01;
  const own = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  for (const { key, position, rotationY } of platePlacements()) {
    const plate = new Group();
    plate.name = key.replace('plate:', 'plate-');
    plate.position.copy(position);
    plate.rotation.y = rotationY;
    const bars: [number, number, number, number][] = [
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
    const barGeometries = bars.map(([w, h, x, y]) =>
      new BoxGeometry(w, h, frame.depth).translate(x, y, 0)
    );
    const merged = mergeGeometries(barGeometries);
    barGeometries.forEach(g => g.dispose());
    if (merged) plate.add(new Mesh(own(merged), frameMaterial));
    const mat = new Mesh(
      own(
        new BoxGeometry(
          frame.width - 2 * frame.border,
          frame.height - 2 * frame.border,
          matDepth
        ).translate(0, 0, -frame.depth / 2 + matDepth / 2)
      ),
      matMaterial
    );
    plate.add(mat);
    const texture = textures[key];
    const art = new Mesh(
      own(
        new PlaneGeometry(innerW, innerH).translate(
          0,
          0,
          -frame.depth / 2 + matDepth + 0.003
        )
      ),
      standard(texture ? 0xffffff : 0xd9d4c8, 0.9, texture)
    );
    plate.add(art);
    group.add(plate);
  }
  group.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.isMesh) mesh.raycast = () => undefined;
  });
  freezeMatrices(group);
  return {
    group,
    dispose: () => {
      geometries.forEach(g => g.dispose());
      materials.forEach(m => {
        m.map?.dispose();
        m.dispose();
      });
      group.clear();
    },
  };
}

/** Los 9 glTF nuevos y la segunda librería (misma malla que la del fondo, a la izquierda). */
export function allModelSpecs(): PieceModelSpec[] {
  const specs = pieceModelSpecs(PIECES);
  const left = PIECES_BY_ID.bookcaseLeft;
  specs.push({
    id: 'bookcaseLeft',
    piece: 'bookcaseLeft',
    path: 'assets/models/wooden_bookshelf_worn/scene.gltf',
    position: left.position,
    rotationY: left.rotationY,
    scale: 1,
    yOffset: 0,
    castShadow: false,
  });
  return specs;
}

/** Las TV de la ficha: láminas por orden, solo las que cargaron. */
export function buildPlates(
  art: ReadonlyMap<string, Texture>,
  plates: Partial<Record<PlateKey, Texture>>
): Plate[] {
  const result: Plate[] = [];
  for (const { key, title } of PLATE_SEQUENCE) {
    const source = key.startsWith('plate:')
      ? plates[key as PlateKey]
      : art.get(key);
    if (!source) continue;
    // Las de la 003 son del builder de decoración: copia que comparte imagen y GPU.
    const texture = key.startsWith('plate:') ? source : source.clone();
    texture.colorSpace = SRGBColorSpace;
    result.push({ title, texture });
  }
  return result;
}

const isFurniture = (id: PieceId): boolean =>
  (FURNITURE_IDS as readonly string[]).includes(id);

/** Registra proxies de las piezas procedurales/decorativas (reloj y jarrón incluidos). */
export function registerProxyPieces(
  interaction: ObjectInteractionService,
  build: PiecesBuild,
  decor: Readonly<{
    clock?: Object3D;
    vase?: Object3D;
    floorLampShade?: Object3D;
  }>
): void {
  for (const piece of PIECES) {
    if (isFurniture(piece.id) || piece.pick !== 'proxy') continue;
    const proxies = build.proxiesByPiece[piece.id];
    if (!proxies?.length) continue;
    const info: PieceInfo = { id: piece.id as PieceInfo['id'], kind: 'piece' };
    const visuals: Object3D[] = [
      ...(build.pieces[piece.id]?.visuals ?? []),
      ...(piece.id === 'clock' && decor.clock ? [decor.clock] : []),
      ...(piece.id === 'vase' && decor.vase ? [decor.vase] : []),
      // Pantalla propia (material único); el resto de la lámpara va fundido.
      ...(piece.id === 'floorLamp' && decor.floorLampShade
        ? [decor.floorLampShade]
        : []),
    ];
    interaction.registerPiece(info, proxies, {
      ...(visuals.length ? { visuals } : {}),
      // Sin malla propia no hay casco: se dibujan las aristas de la caja.
      ...(piece.id === 'floorLamp' ? { withProxyEdges: true } : {}),
    });
  }
}

/** Registra los glTF de las piezas `pick: 'object'` (la silueta real recibe el clic). */
export function registerModelPieces(
  interaction: ObjectInteractionService,
  models: Readonly<Record<string, Object3D>>,
  specs: readonly PieceModelSpec[]
): void {
  for (const piece of PIECES) {
    if (isFurniture(piece.id) || piece.pick !== 'object') continue;
    const objects = specs
      .filter(spec => spec.piece === piece.id && models[spec.id])
      .map(spec => models[spec.id]);
    if (objects.length === 0) continue;
    interaction.registerPiece(
      { id: piece.id as PieceInfo['id'], kind: 'piece' },
      objects
    );
  }
}

/** Primera `PointLight` de la escena: la lámpara de pie (la única luz puntual). */
export function findFloorLight(scene: Scene): PointLight | null {
  let found: PointLight | null = null;
  scene.traverse(object => {
    if (!found && (object as PointLight).isPointLight) {
      found = object as PointLight;
    }
  });
  return found;
}

/** ¿Es un renderer WebGL de verdad (para el entorno del espejo)? */
export function asWebGLRenderer(renderer: unknown): WebGLRenderer | undefined {
  return typeof (renderer as { getContext?: unknown })?.getContext ===
    'function'
    ? (renderer as WebGLRenderer)
    : undefined;
}

/** Cuenta mallas con `castShadow` bajo `roots` (presupuesto de casters nuevos ≤ 6). */
export function countCasters(...roots: Object3D[]): number {
  let count = 0;
  for (const root of roots) {
    root.traverse(object => {
      if ((object as Mesh).isMesh && object.castShadow) count++;
    });
  }
  return count;
}

export type { PieceActionsOptions, PiecesBuild, PieceModelSpec, Plate };
