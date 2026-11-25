import { Injectable } from '@angular/core';
import {
  Box3,
  BoxGeometry,
  Color,
  Euler,
  Frustum,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ModelConfiguration } from '../interfaces/scene.interface';
import type { PieceId } from './piece-ids';
import type { PieceConfig, Vec3 } from './pieces.config';
import { buildCornice } from './builders/cornice';
import { buildCredenza } from './builders/credenza';
import { buildDesk } from './builders/desk';
import { buildDoor } from './builders/door';
import {
  buildDeskLamp,
  buildFloorLampGlow,
  buildReadingLamp,
} from './builders/lamps';
import { buildMonitor } from './builders/monitor';
import {
  MIRROR_ENV_KEY,
  MirrorFinish,
  buildArchMirror,
} from './builders/mirror';
import { buildPlant } from './builders/plant';
import { buildRugs } from './builders/rugs';
import { buildDeskShelf, buildDisplayObjects } from './builders/shelves';
import { buildTurntable } from './builders/turntable';
import { buildTv } from './builders/tv';
import {
  BuildKit,
  PieceBuildEntry,
  PieceTextures,
  ZONE_IDS,
  ZoneId,
} from './builders/kit';

export type { PieceBuildEntry, PieceTextures, ZoneId };
export { ZONE_IDS };

/**
 * Acabado del vidrio del espejo de arco (decisión del informe de la pista:
 * `env` con un PMREM de `RoomEnvironment` si hay renderer; si no, ahumado).
 */
export const MIRROR_FINISH: MirrorFinish = 'smoked';

/** Opciones de `build`. */
export interface PiecesBuildOptions {
  /** Jarrón de la sala: el aparador pone un clon (comparte geometría y material). */
  vase?: Object3D;
  /** Con renderer, el espejo usa un `envMap` PMREM propio (liberado en `dispose`). */
  renderer?: WebGLRenderer;
  /** Fuerza el acabado del espejo (por defecto `MIRROR_FINISH`). */
  mirrorFinish?: MirrorFinish;
}

/** Resultado de construir las piezas procedurales. */
export interface PiecesBuild {
  /** Grupo `pieces`: las zonas y `piece-proxies`. */
  group: Group;
  /** Un `Group` por zona (con su esfera en `zoneSpheres`). */
  zones: Record<ZoneId, Group>;
  zoneSpheres: Partial<Record<ZoneId, Sphere>>;
  /** Cajas de raycast invisibles de las piezas `pick: 'proxy'`. */
  proxies: Mesh[];
  proxiesByPiece: Partial<Record<PieceId, Mesh[]>>;
  /** Mallas y partes visibles por pieza (para contorno y acciones). */
  pieces: Partial<Record<PieceId, PieceBuildEntry>>;
  /** Objeto con nombre (`tv:screenA`, `turntable:platter`…). */
  named: (name: string) => Object3D | undefined;
  /** Mallas visibles (sin proxies) y triángulos procedurales. */
  stats: { meshes: number; triangles: number };
  /** Oculta las zonas cuya esfera no toca el frustum. */
  cullZones: (frustum: Frustum) => void;
  /** Libera geometrías, materiales y texturas y vacía el grupo. */
  dispose: () => void;
}

/** Piezas procedurales de cada zona, en un solo sitio. */
function buildAll(
  kit: BuildKit,
  byId: Partial<Record<PieceId, PieceConfig>>,
  finish: MirrorFinish
): void {
  const { tv, credenza, door, archMirror, plantFicus } = byId;
  if (tv) buildTv(kit, tv);
  if (credenza) buildCredenza(kit, credenza);
  if (door) buildDoor(kit, door);
  if (archMirror) buildArchMirror(kit, archMirror, finish);
  if (plantFicus) buildPlant(kit, plantFicus);
  const { desk, monitor, deskLamp, displayShelves } = byId;
  if (desk) {
    buildDesk(kit, desk);
    buildDeskShelf(kit, desk);
  }
  if (monitor) buildMonitor(kit, monitor);
  if (deskLamp) buildDeskLamp(kit, deskLamp);
  if (displayShelves) buildDisplayObjects(kit, displayShelves);
  const { readingLamp, turntable, floorLamp } = byId;
  if (readingLamp) buildReadingLamp(kit, readingLamp);
  if (turntable) buildTurntable(kit, turntable);
  if (floorLamp) buildFloorLampGlow(kit, floorLamp);
  buildRugs(kit);
  buildCornice(kit);
}

/** PMREM barato de `RoomEnvironment`, creado una vez para el espejo. */
function createMirrorEnvironment(kit: BuildKit, renderer: WebGLRenderer): void {
  const generator = new PMREMGenerator(renderer);
  const scene = new RoomEnvironment();
  const target = generator.fromScene(scene, 0.04);
  generator.dispose();
  scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
      m => m.dispose()
    );
  });
  kit.own(target);
  kit.provide(MIRROR_ENV_KEY, target.texture);
}

/** Cajas proxy invisibles: una geometría y un material compartidos. */
function buildProxies(pieces: readonly PieceConfig[]): {
  group: Group;
  meshes: Mesh[];
  byPiece: Partial<Record<PieceId, Mesh[]>>;
  dispose: () => void;
} {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ visible: false });
  material.name = 'piece-proxy';
  const group = new Group();
  group.name = 'piece-proxies';
  const meshes: Mesh[] = [];
  const byPiece: Partial<Record<PieceId, Mesh[]>> = {};
  for (const piece of pieces) {
    if (piece.pick !== 'proxy') continue;
    piece.proxies.forEach((proxy, index) => {
      const mesh = new Mesh(geometry, material);
      mesh.name = `proxy:${piece.id}:${index}`;
      mesh.visible = false;
      mesh.position.set(...proxy.position);
      mesh.rotation.y = proxy.rotationY;
      mesh.scale.set(...proxy.size);
      mesh.userData['pieceId'] = piece.id;
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      meshes.push(mesh);
      (byPiece[piece.id] ??= []).push(mesh);
    });
  }
  return {
    group,
    meshes,
    byPiece,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      group.clear();
      meshes.length = 0;
    },
  };
}

/** Modelo glTF nuevo de una pieza (spec A.2). */
export interface PieceModelSpec {
  /** Id del activo (para errores y para recoger el resultado). */
  id: string;
  piece: PieceId;
  path: string;
  /** Centro (x, z) en la escena; la base queda en `yOffset`. */
  position: Vec3;
  rotationY: number;
  scale: number;
  yOffset: number;
  castShadow: boolean;
  /** Teñido con `map` anulado (armario crema, silla de roble). */
  tint?: { color: number; roughness?: number };
}

const MODELS_DIR = 'assets/models';

/**
 * Los 9 glTF nuevos con su colocación sacada de `PIECES`. El escalado y el
 * frente son los de la spec (A.2); las rotaciones «≈» se afinan en F4.
 */
export function pieceModelSpecs(
  pieces: readonly PieceConfig[]
): PieceModelSpec[] {
  const byId = Object.fromEntries(pieces.map(p => [p.id, p])) as Partial<
    Record<PieceId, PieceConfig>
  >;
  const specs: PieceModelSpec[] = [];
  const add = (
    piece: PieceId,
    id: string,
    folder: string,
    extra: Partial<PieceModelSpec> & {
      position?: Vec3;
      rotationY?: number;
    } = {}
  ): void => {
    const config = byId[piece];
    if (!config) return;
    specs.push({
      id,
      piece,
      path: `${MODELS_DIR}/${folder}/scene.gltf`,
      position: extra.position ?? config.position,
      rotationY: extra.rotationY ?? config.rotationY,
      scale: extra.scale ?? 1,
      yOffset: extra.yOffset ?? 0,
      castShadow: extra.castShadow ?? false,
      ...(extra.tint ? { tint: extra.tint } : {}),
    });
  };
  const chairSide = byId.readingChair?.proxies[1];
  const deskChair = byId.desk?.proxies[1];
  const pendant = byId.pendant;
  add('readingChair', 'readingChair', 'mid_century_lounge_chair', {
    castShadow: true,
  });
  if (chairSide) {
    add('readingChair', 'readingTable', 'side_table_01', {
      position: chairSide.position,
      rotationY: chairSide.rotationY,
    });
  }
  add('sideboard', 'sideboard', 'vintage_wooden_drawer_01', { scale: 0.6 });
  add('tallCabinet', 'tallCabinet', 'painted_wooden_cabinet_02', {
    castShadow: true,
    tint: { color: 0xc4986a, roughness: 0.6 },
  });
  if (deskChair) {
    add('desk', 'deskChair', 'painted_wooden_chair_02', {
      position: deskChair.position,
      rotationY: deskChair.rotationY,
      tint: { color: 0xb98a58, roughness: 0.6 },
    });
  }
  add('displayShelves', 'displayShelves', 'wooden_display_shelves_01');
  add('armchair', 'armchair', 'modern_arm_chair_01', { castShadow: true });
  add('coffeeTable', 'coffeeTable', 'modern_coffee_table_01');
  if (pendant) {
    add('pendant', 'pendant', 'modern_ceiling_lamp_01', {
      yOffset: pendant.position[1] - pendant.size[1] / 2,
    });
  }
  return specs;
}

/** Lo que necesitamos del cargador de modelos (lo implementa `ModelLoaderService`). */
export interface PieceModelLoader {
  loadModel(
    config: Omit<ModelConfiguration, 'metadata'>,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Object3D>;
}

/** Error de carga en la forma de `ViewerError` (sin el reintento). */
export interface PieceLoadError {
  code: 'pieces-load-failed';
  params: { names: string[] };
}

export interface PieceModelsResult {
  /** Modelos cargados por id de activo; los que fallan se omiten. */
  models: Record<string, Object3D>;
  /** `null` si todo cargó; si no, los activos que fallaron. */
  error: PieceLoadError | null;
}

/**
 * Tiñe un modelo sin tocar sus materiales originales: cada material se clona
 * (una vez por original), se le pone el color, la rugosidad y `map: null`, y
 * se libera el original y su textura de color, que ya no se usa.
 */
export function tintModel(
  root: Object3D,
  tint: { color: number; roughness?: number }
): void {
  const clones = new Map<Material, Material>();
  const retired = new Set<Material>();
  root.traverse(child => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const swap = (material: Material): Material => {
      const standard = material as MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) return material;
      let clone = clones.get(material);
      if (!clone) {
        const copy = standard.clone();
        copy.color = new Color(tint.color);
        if (tint.roughness !== undefined) copy.roughness = tint.roughness;
        copy.map = null;
        copy.needsUpdate = true;
        clones.set(material, copy);
        retired.add(material);
        clone = copy;
      }
      return clone;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(swap)
      : swap(mesh.material);
  });
  retired.forEach(material => {
    (material as MeshStandardMaterial).map?.dispose();
    material.dispose();
  });
}

/** Dentro de esta tolerancia (m) se considera que el modelo mide lo esperado. */
export const MODEL_SIZE_TOLERANCE = 0.1;

/** Caja del modelo en la escena (para comprobar su medida frente a A.2). */
export function modelBox(model: Object3D): Box3 {
  model.updateMatrixWorld(true);
  return new Box3().setFromObject(model);
}

@Injectable({ providedIn: 'root' })
export class PiecesBuilderService {
  /**
   * Construye las piezas procedurales por zona: cada zona es un `Group` con
   * mallas fusionadas por material, mallas propias para lo animado o buscado
   * por nombre, y cajas proxy invisibles para el raycast. Las texturas que
   * llegan pasan a ser del resultado (se liberan en `dispose`). 0 luces.
   */
  build(
    pieces: readonly PieceConfig[],
    textures: PieceTextures = {},
    options: PiecesBuildOptions = {}
  ): PiecesBuild {
    const kit = new BuildKit(textures);
    kit.vase = options.vase ?? null;
    const finish = options.mirrorFinish ?? MIRROR_FINISH;
    if (finish === 'env' && options.renderer) {
      createMirrorEnvironment(kit, options.renderer);
    }
    const byId = Object.fromEntries(pieces.map(p => [p.id, p])) as Partial<
      Record<PieceId, PieceConfig>
    >;
    buildAll(
      kit,
      byId,
      finish === 'env' && kit.texture(MIRROR_ENV_KEY) ? 'env' : 'smoked'
    );
    kit.finish();

    // El aparador de nogal es de los casters nuevos (≤ 6).
    const credenzaWood = kit.named.get('tvWall:walnut');
    if (credenzaWood) credenzaWood.castShadow = true;

    const proxies = buildProxies(pieces);
    const group = new Group();
    group.name = 'pieces';
    const zoneSpheres: Partial<Record<ZoneId, Sphere>> = {};
    for (const id of ZONE_IDS) {
      const zone = kit.zones[id];
      group.add(zone);
      if (zone.children.length === 0) continue;
      zone.updateMatrixWorld(true);
      const box = new Box3().setFromObject(zone);
      if (box.isEmpty()) continue;
      const sphere = box.getBoundingSphere(new Sphere());
      zoneSpheres[id] = sphere;
      zone.userData['boundingSphere'] = sphere;
    }
    group.add(proxies.group);
    group.updateMatrixWorld(true);

    const entries = Object.fromEntries(kit.entries) as Partial<
      Record<PieceId, PieceBuildEntry>
    >;
    const stats = { meshes: kit.meshes.length, triangles: kit.triangles() };
    let disposed = false;
    return {
      group,
      zones: kit.zones,
      zoneSpheres,
      proxies: proxies.meshes,
      proxiesByPiece: proxies.byPiece,
      pieces: entries,
      named: name => kit.named.get(name),
      stats,
      cullZones: frustum => {
        for (const id of ZONE_IDS) {
          const sphere = zoneSpheres[id];
          if (sphere) kit.zones[id].visible = frustum.intersectsSphere(sphere);
        }
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        proxies.dispose();
        kit.dispose();
        group.clear();
      },
    };
  }

  /**
   * Carga los glTF nuevos con el cargador de modelos (por interfaz) y aplica
   * el tinte. Un fallo no rompe el resto: devuelve lo que cargó y un error
   * `pieces-load-failed` con los ids de los activos que fallaron.
   */
  async loadModels(
    loader: PieceModelLoader,
    specs: readonly PieceModelSpec[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<PieceModelsResult> {
    const fractions = specs.map(() => 0);
    const report = (): void =>
      onProgress?.(
        fractions.reduce((sum, value) => sum + value, 0),
        specs.length
      );
    const results = await Promise.allSettled(
      specs.map(async (spec, index) => {
        const model = await loader.loadModel(
          {
            path: spec.path,
            position: new Vector3(spec.position[0], 0, spec.position[2]),
            scale: spec.scale,
            rotation: new Euler(0, spec.rotationY, 0),
            yOffset: spec.yOffset,
            castShadow: spec.castShadow,
            mergeMeshes: true,
          },
          (loaded, total) => {
            fractions[index] = total > 0 ? Math.min(loaded / total, 1) : 0;
            report();
          }
        );
        fractions[index] = 1;
        report();
        if (spec.tint) tintModel(model, spec.tint);
        return model;
      })
    );
    const models: Record<string, Object3D> = {};
    const failed: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') models[specs[index].id] = result.value;
      else failed.push(specs[index].id);
    });
    return {
      models,
      error: failed.length
        ? { code: 'pieces-load-failed', params: { names: failed } }
        : null,
    };
  }
}
