import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  DataTexture,
  Frustum,
  Group,
  Light,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Texture,
  Vector3,
} from 'three';
import {
  PiecesBuild,
  PiecesBuilderService,
  pieceModelSpecs,
  tintModel,
  ZONE_IDS,
} from './pieces-builder.service';
import { PIECES, PIECES_BY_ID } from './pieces.config';
import type { PieceId } from './piece-ids';
import {
  triangleCount,
  chamferBox,
  profileFrame,
  rectOutline,
} from './builders/geometry';

const service = new PiecesBuilderService();
const GLOW = /halo|pool|rug|cornice|proxy|monitor:screen/;

/** Tris procedurales de una pieza sola (sin alfombras ni cornisa). */
function solo(
  id: PieceId,
  patch: object = {}
): { build: PiecesBuild; tris: number } {
  const baseline = service.build([]);
  const base = baseline.stats.triangles;
  baseline.dispose();
  const build = service.build([{ ...PIECES_BY_ID[id], ...patch }]);
  return { build, tris: build.stats.triangles - base };
}

/** Caja de las mallas visibles de la pieza (sin brillos, alfombras ni cornisa). */
function boxOf(build: PiecesBuild, skip: RegExp = GLOW): Box3 {
  const box = new Box3();
  build.group.traverse(o => {
    const mesh = o as Mesh;
    if (mesh.isMesh && !skip.test(mesh.name)) box.expandByObject(mesh);
  });
  return box;
}

function expectBox(box: Box3, id: PieceId, tolerance = 0.011): void {
  const c = PIECES_BY_ID[id];
  const size = box.getSize(new Vector3());
  // Ancho/fondo según el giro de la pieza (múltiplos de π/2).
  const turned = Math.abs(Math.sin(c.rotationY)) > 0.5;
  const [w, h, d] = c.size;
  expect(Math.abs(size.x - (turned ? d : w))).toBeLessThan(tolerance);
  expect(Math.abs(size.y - h)).toBeLessThan(tolerance);
  expect(Math.abs(size.z - (turned ? w : d))).toBeLessThan(tolerance);
}

describe('PiecesBuilderService.build (todas las piezas)', () => {
  let build: PiecesBuild;
  beforeAll(() => {
    build = service.build(PIECES);
  });
  afterAll(() => build.dispose());

  it('respeta los presupuestos de mallas y triángulos y no añade luces', () => {
    expect(build.stats.meshes).toBeLessThanOrEqual(56);
    expect(build.stats.triangles).toBeLessThanOrEqual(12000);
    let lights = 0;
    build.group.traverse(o => {
      if ((o as Light).isLight) lights++;
    });
    expect(lights).toBe(0);
  });

  it('tiene las 6 zonas con su esfera y ninguna malla recibe raycast', () => {
    for (const id of ZONE_IDS) {
      expect(build.zones[id].children.length).toBeGreaterThan(0);
      expect(build.zoneSpheres[id]?.radius).toBeGreaterThan(0);
    }
    const hit = new Raycaster(new Vector3(0, 1.4, 5), new Vector3(0, 0, 1));
    const visible: Object3D[] = [];
    for (const id of ZONE_IDS) visible.push(build.zones[id]);
    expect(hit.intersectObjects(visible, true)).toEqual([]);
  });

  it('crea cajas proxy compartidas que el raycast encuentra', () => {
    const expected = PIECES.filter(p => p.pick === 'proxy').reduce(
      (n, p) => n + p.proxies.length,
      0
    );
    expect(build.proxies.length).toBe(expected);
    expect(new Set(build.proxies.map(p => p.geometry)).size).toBe(1);
    expect(new Set(build.proxies.map(p => p.material)).size).toBe(1);
    const ray = new Raycaster(new Vector3(0, 1.4, 5), new Vector3(0, 0, 1));
    const hits = ray.intersectObjects(build.proxies, false);
    expect(hits[0].object.userData['pieceId']).toBe('tv');
  });

  it('cullZones oculta las zonas fuera del frustum', () => {
    const camera = new PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 1.7, 0);
    camera.lookAt(0, 1.7, -8);
    camera.updateMatrixWorld(true);
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );
    build.cullZones(frustum);
    expect(build.zones.tvWall.visible).toBe(false);
    build.cullZones(
      new Frustum().setFromProjectionMatrix(new Matrix4().identity())
    );
  });

  it('expone partes por nombre (pantallas, halos, plato, brazo) y materiales de pantalla únicos', () => {
    for (const name of [
      'tv:screen',
      'tv:screen-b',
      'tv:halo',
      'monitor:screen',
      'monitor:halo',
      'turntable:platter',
      'turntable:arm',
      'deskLamp:shade',
      'deskLamp:halo',
      'deskLamp:pool',
      'readingLamp:shade',
      'readingLamp:pool',
      'floorLamp:halo',
      'floorLamp:pool',
    ]) {
      expect(build.named(name)).toBeDefined();
    }
    const shades = ['deskLamp', 'readingLamp'].map(
      id => (build.named(`${id}:shade`) as Mesh).material as Material
    );
    expect(shades[0]).not.toBe(shades[1]);
    const glow = (build.named('tv:halo') as Mesh).material as Material;
    expect(glow.depthWrite).toBe(false);
  });

  it('el contorno de las piezas con mallas propias sale de sus visuals', () => {
    expect(build.pieces.plantFicus?.visuals.length).toBeGreaterThan(0);
    expect(build.pieces.tv?.visuals.length).toBeGreaterThan(0);
    expect(build.pieces.archMirror?.visuals.length).toBe(2);
  });

  it('la lámina del arco usa la textura recibida y liberar su clon no toca la original', () => {
    const original = new DataTexture(new Uint8Array(4), 1, 1);
    const spyOriginal = vi.spyOn(original, 'dispose');
    const own = service.build(PIECES, { 'mirror:art': original.clone() });
    const glass = own.named('archMirror:glass') as Mesh;
    expect((glass.material as MeshStandardMaterial).map).not.toBeNull();
    expect((glass.material as MeshStandardMaterial).map).not.toBe(original);
    own.dispose();
    expect(spyOriginal).not.toHaveBeenCalled();
    expect(original.image).toBeDefined();
  });

  it('dispose libera geometrías, materiales y texturas y vacía el grupo', () => {
    const texture = new DataTexture(new Uint8Array(4), 1, 1);
    const spyTexture = vi.spyOn(texture, 'dispose');
    const local = service.build(PIECES, { 'floor:diffuse': texture });
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    local.group.traverse(o => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      [mesh.material].flat().forEach(m => materials.add(m));
    });
    const spies = [...geometries, ...materials].map(x =>
      vi.spyOn(x, 'dispose')
    );
    local.dispose();
    expect(spies.length).toBeGreaterThan(40);
    spies.forEach(spy => expect(spy).toHaveBeenCalled());
    expect(spyTexture).toHaveBeenCalled();
    expect(local.group.children.length).toBe(0);
    for (const id of ZONE_IDS) expect(local.zones[id].children.length).toBe(0);
  });
});

describe('presupuestos y medidas por builder', () => {
  const budgets: [PieceId, number][] = [
    ['tv', 70],
    ['monitor', 140],
    ['credenza', 3342],
    ['desk', 1626],
    ['readingLamp', 230],
    ['deskLamp', 220],
    ['door', 260],
    ['archMirror', 220],
    ['plantFicus', 620],
  ];
  it.each(budgets)('%s: tris ≤ estimación + 25 %', (id, estimate) => {
    const { build, tris } = solo(id);
    expect(tris).toBeLessThanOrEqual(estimate * 1.25);
    build.dispose();
  });

  it('tocadiscos ≤ 650 tris, con plato y brazo con nombre', () => {
    const { build, tris } = solo('turntable');
    expect(tris).toBeLessThanOrEqual(650);
    expect(build.named('turntable:platter')).toBeDefined();
    expect(build.named('turntable:arm')?.rotation.y).toBe(0);
    build.dispose();
  });

  it('cornisa: 1 malla ≤ 220 tris con sombra recibida y sin raycast', () => {
    const build = service.build([]);
    const cornice = build.named('cornice') as Mesh;
    expect(cornice.isMesh).toBe(true);
    expect(triangleCount(cornice.geometry)).toBeLessThanOrEqual(220);
    expect(cornice.receiveShadow).toBe(true);
    expect(cornice.raycast).not.toBe(Mesh.prototype.raycast);
    build.dispose();
  });

  it.each(['tv', 'archMirror'] as PieceId[])(
    '%s mide lo de A.2 (±1 cm)',
    id => {
      const { build } = solo(id);
      expectBox(boxOf(build), id);
      build.dispose();
    }
  );

  it('puerta, lámparas y escritorio miden lo de A.2 (±1 cm)', () => {
    const door = solo('door');
    expectBox(boxOf(door.build, /halo|pool|rug|cornice|proxy|brass/), 'door');
    door.build.dispose();
    for (const id of ['deskLamp', 'readingLamp'] as PieceId[]) {
      const lamp = solo(id);
      expectBox(boxOf(lamp.build), id);
      lamp.build.dispose();
    }
    const desk = solo('desk', {
      proxies: PIECES_BY_ID.desk.proxies.slice(0, 2),
    });
    const box = boxOf(desk.build);
    const size = box.getSize(new Vector3());
    expect(Math.abs(size.y - 0.75)).toBeLessThan(0.011);
    expect(Math.abs(size.z - 1.5)).toBeLessThan(0.011);
    expect(Math.abs(size.x - 0.7)).toBeLessThan(0.011);
    desk.build.dispose();
  });

  it('el aparador y el ficus caben en su caja de A.2', () => {
    const vase = new Group();
    vase.add(
      new Mesh(new BoxGeometry(0.2, 0.4, 0.2), new MeshStandardMaterial())
    );
    const credenza = service.build([PIECES_BY_ID.credenza], {}, { vase });
    const box = boxOf(credenza);
    const size = box.getSize(new Vector3());
    expect(Math.abs(size.x - 2)).toBeLessThan(0.011);
    expect(size.y).toBeLessThanOrEqual(0.9 + 0.011);
    expect(size.z).toBeLessThanOrEqual(0.5 + 0.011);
    expect(credenza.named('credenza:vase')).toBeUndefined();
    expect(credenza.pieces.credenza?.parts['credenza:vase']).toBeDefined();
    credenza.dispose();
    const ficus = solo('plantFicus');
    const fs = boxOf(ficus.build).getSize(new Vector3());
    expect(fs.x).toBeLessThanOrEqual(0.9);
    expect(fs.z).toBeLessThanOrEqual(0.9);
    expect(Math.abs(fs.y - 1.75)).toBeLessThan(0.05);
    ficus.build.dispose();
  });
});

describe('geometría base', () => {
  it('chamferBox tiene 44 triángulos y la caja pedida', () => {
    const g = chamferBox(1, 0.4, 0.5, 0.02);
    expect(triangleCount(g)).toBe(44);
    g.computeBoundingBox();
    expect(g.boundingBox?.max.x).toBeCloseTo(0.5);
    expect(g.boundingBox?.max.y).toBeCloseTo(0.2);
  });

  it('profileFrame apunta sus normales hacia fuera y están normalizadas', () => {
    const g = profileFrame(rectOutline(1, 1), [
      { inset: 0, z: -0.02 },
      { inset: 0, z: 0.02 },
      { inset: 0.1, z: 0.02 },
    ]);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      const normal = new Vector3().fromBufferAttribute(n, i);
      expect(normal.length()).toBeCloseTo(1, 4);
    }
    // La cara frontal mira a +Z.
    let front = 0;
    for (let i = 0; i < n.count; i++) if (n.getZ(i) > 0.99) front++;
    expect(front).toBe(24);
  });
});

describe('modelos glTF y tinte', () => {
  const makeModel = (): { model: Group; original: MeshStandardMaterial } => {
    const map = new Texture();
    const original = new MeshStandardMaterial({ color: 0x336699, map });
    const model = new Group();
    model.add(new Mesh(new BoxGeometry(1, 1, 1), original));
    return { model, original };
  };

  it('tintModel cambia el color y anula el mapa sin tocar el original', () => {
    const { model, original } = makeModel();
    const map = original.map as Texture;
    const spy = vi.spyOn(map, 'dispose');
    tintModel(model, { color: 0xe6dcc6, roughness: 0.6 });
    const tinted = (model.children[0] as Mesh).material as MeshStandardMaterial;
    expect(tinted).not.toBe(original);
    expect(tinted.color.getHex()).toBe(0xe6dcc6);
    expect(tinted.map).toBeNull();
    expect(original.color.getHex()).toBe(0x336699);
    expect(spy).toHaveBeenCalled();
  });

  it('pieceModelSpecs saca los 9 modelos de PIECES', () => {
    const specs = pieceModelSpecs(PIECES);
    expect(specs.length).toBe(9);
    expect(specs.find(s => s.id === 'sideboard')?.scale).toBe(0.6);
    expect(specs.find(s => s.id === 'tallCabinet')?.tint).toBeDefined();
    expect(specs.filter(s => s.castShadow).length).toBeLessThanOrEqual(3);
  });

  it('loadModels tiñe, informa el progreso y devuelve ViewerError con los activos fallidos', async () => {
    const specs = pieceModelSpecs(PIECES);
    const loader = {
      loadModel: vi.fn(
        async (
          config: { path: string },
          onProgress?: (a: number, b: number) => void
        ) => {
          onProgress?.(1, 1);
          if (
            config.path.includes('armoire') ||
            config.path.includes('modern_arm_chair')
          ) {
            throw new Error('404');
          }
          return makeModel().model as Object3D;
        }
      ),
    };
    const progress: number[] = [];
    const result = await service.loadModels(loader, specs, (l, t) =>
      progress.push(l / t)
    );
    expect(result.error?.code).toBe('pieces-load-failed');
    expect(result.error?.params.names).toEqual(['armchair']);
    expect(Object.keys(result.models)).not.toContain('armchair');
    expect(Object.keys(result.models).length).toBe(8);
    expect(progress[progress.length - 1]).toBeCloseTo(1, 1);
    const cabinet = result.models['tallCabinet'].children[0] as Mesh;
    expect((cabinet.material as MeshStandardMaterial).map).toBeNull();
  });

  it('sin fallos no hay error', async () => {
    const loader = { loadModel: async () => makeModel().model as Object3D };
    const result = await service.loadModels(loader, pieceModelSpecs(PIECES));
    expect(result.error).toBeNull();
  });
});
