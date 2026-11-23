import { TestBed } from '@angular/core/testing';
import {
  Box3,
  BoxGeometry,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelConfiguration } from '../interfaces/scene.interface';
import {
  ModelLoaderService,
  TEXTURE_ANISOTROPY,
  applyMaterialOverride,
  disableRaycast,
  disposeObject3D,
} from './model-loader.service';

function config(
  overrides: Partial<ModelConfiguration> = {}
): ModelConfiguration {
  return {
    path: '/assets/models/x/scene.gltf',
    position: new Vector3(3, 0.7, -2),
    scale: 1,
    rotation: new Euler(),
    metadata: { id: 'sofa' },
    ...overrides,
  };
}

function fakeScene(): Group {
  const group = new Group();
  // Caja de 2×1×2 con el centro a 5 m de altura.
  const mesh = new Mesh(new BoxGeometry(2, 1, 2), new MeshBasicMaterial());
  mesh.position.set(10, 5, 10);
  group.add(mesh);
  return group;
}

describe('ModelLoaderService', () => {
  let service: ModelLoaderService;
  let loadAsync: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = TestBed.inject(ModelLoaderService);
    loadAsync = vi
      .spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockImplementation(((
        _url: string,
        onProgress?: (e: ProgressEvent) => void
      ) => {
        onProgress?.({
          lengthComputable: true,
          loaded: 50,
          total: 200,
        } as ProgressEvent);
        onProgress?.({
          lengthComputable: false,
          loaded: 70,
          total: 0,
        } as ProgressEvent);
        return Promise.resolve({ scene: fakeScene() });
      }) as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it('reports finite resource-unit progress and never exceeds the total', async () => {
    const calls: [number, number][] = [];
    await service.loadModel(config(), (l, t) => calls.push([l, t]));
    // 50/200 bytes del principal = 0.25 de 1 recurso; sin longitud conocida = 0.
    expect(calls).toEqual([
      [0.25, 1],
      [0, 1],
    ]);
    expect(calls.every(([l, t]) => Number.isFinite(l) && l <= t)).toBe(true);
  });

  it('counts secondary files (.bin, textures) through the loading manager', async () => {
    loadAsync.mockImplementationOnce(function (this: GLTFLoader) {
      const m = this.manager;
      m.itemStart('scene.gltf');
      m.itemStart('scene.bin');
      m.itemStart('tex.webp');
      m.itemEnd('scene.gltf');
      m.itemEnd('scene.bin');
      m.itemEnd('tex.webp');
      return Promise.resolve({ scene: fakeScene() });
    } as never);
    const calls: [number, number][] = [];
    await service.loadModel(config(), (l, t) => calls.push([l, t]));
    expect(calls.at(-1)).toEqual([3, 3]);
    const fractions = calls.map(([l, t]) => l / t);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    // El primer recurso terminado no es el 100 %.
    expect(calls.find(([l]) => l === 1)?.[1]).toBe(3);
  });

  it('strips the leading slash from the path', async () => {
    await service.loadModel(config());
    expect(loadAsync.mock.calls[0][0]).toBe('assets/models/x/scene.gltf');
  });

  it('places the base on the floor and centres X/Z on the configured position', async () => {
    const model = await service.loadModel(config());
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    expect(box.min.y).toBeCloseTo(0);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(3);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(-2);
  });

  it('does not cast shadows when castShadow is false, but still receives them', async () => {
    const model = await service.loadModel(config({ castShadow: false }));
    const meshes: Mesh[] = [];
    model.traverse(c => (c as Mesh).isMesh && meshes.push(c as Mesh));
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.every(m => !m.castShadow && m.receiveShadow)).toBe(true);
  });

  it('casts shadows by default on opaque meshes', async () => {
    const model = await service.loadModel(config());
    const mesh = model.children[0] as Mesh;
    expect(mesh.castShadow).toBe(true);
  });

  describe('mergeMeshes', () => {
    function multiMeshScene(): Group {
      const group = new Group();
      const shared = new MeshStandardMaterial();
      const other = new MeshStandardMaterial();
      const make = (
        x: number,
        material: MeshStandardMaterial,
        name: string
      ) => {
        const geometry = new BoxGeometry(1, 1, 1);
        geometry.clearGroups();
        // Posiciones cuantizadas (i16 normalizado) como las del pipeline meshopt.
        const mesh = new Mesh(geometry, material);
        mesh.name = name;
        mesh.position.set(x, 0.5, 0);
        mesh.rotation.y = 0.3;
        group.add(mesh);
        return mesh;
      };
      make(0, shared, 'a');
      make(2, shared, 'b');
      make(4, shared, 'c');
      make(6, other, 'd');
      return group;
    }

    const meshesOf = (root: Group | Object3D) => {
      const out: Mesh[] = [];
      root.traverse(c => (c as Mesh).isMesh && out.push(c as Mesh));
      return out;
    };

    it('merges meshes that share a material and keeps the overall box', async () => {
      loadAsync.mockImplementation((() =>
        Promise.resolve({ scene: multiMeshScene() })) as never);
      const plain = await service.loadModel(config());
      const merged = await service.loadModel(config({ mergeMeshes: true }));

      expect(meshesOf(plain)).toHaveLength(4);
      expect(meshesOf(merged)).toHaveLength(2);
      const sizeOf = (o: Object3D) =>
        new Box3().setFromObject(o).getSize(new Vector3());
      expect(sizeOf(merged).x).toBeCloseTo(sizeOf(plain).x, 4);
      expect(sizeOf(merged).y).toBeCloseTo(sizeOf(plain).y, 4);
      const triangles = (o: Object3D) =>
        meshesOf(o).reduce((n, m) => n + m.geometry.index!.count / 3, 0);
      expect(triangles(merged)).toBe(triangles(plain));
    });

    it('keeps shadows, raycast target and a single shared material per merged mesh', async () => {
      loadAsync.mockImplementation((() =>
        Promise.resolve({ scene: multiMeshScene() })) as never);
      const merged = await service.loadModel(
        config({ mergeMeshes: true, castShadow: false })
      );
      const meshes = meshesOf(merged);
      expect(meshes.every(m => !m.castShadow && m.receiveShadow)).toBe(true);
      expect(new Set(meshes.map(m => m.material)).size).toBe(2);
      merged.updateMatrixWorld(true);
      const ray = new Raycaster(new Vector3(2, 5, -2), new Vector3(0, -1, 0));
      expect(ray.intersectObject(merged, true).length).toBeGreaterThan(0);
    });
  });

  it('applies yOffset on top of the floor', async () => {
    const model = await service.loadModel(config({ yOffset: 0.25 }));
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    expect(box.min.y).toBeCloseTo(0.25);
  });

  it('propagates load errors', async () => {
    loadAsync.mockRejectedValueOnce(new Error('404'));
    await expect(service.loadModel(config())).rejects.toThrow('404');
  });

  it('disposeObject3D frees geometry, material (single or array) and textures', () => {
    const texture = new Texture();
    const mapMaterial = new MeshBasicMaterial({ map: texture });
    const other = new MeshBasicMaterial();
    const a = new Mesh(new BoxGeometry(), mapMaterial);
    const b = new Mesh(new BoxGeometry(), [other]);
    const root = new Group().add(a, b);

    const spies = [
      vi.spyOn(a.geometry, 'dispose'),
      vi.spyOn(b.geometry, 'dispose'),
      vi.spyOn(mapMaterial, 'dispose'),
      vi.spyOn(other, 'dispose'),
      vi.spyOn(texture, 'dispose'),
    ];
    disposeObject3D(root);
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
  });
});

describe('applyMaterialOverride', () => {
  it('overrides color/roughness/metalness and sets texture anisotropy', () => {
    const material = new MeshStandardMaterial({ color: 0x888888 });
    material.map = new Texture();
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), material));
    applyMaterialOverride(root, {
      color: 0xa65f3a,
      roughness: 0.9,
      metalness: 0,
    });
    expect(material.color.getHex()).toBe(0xa65f3a);
    expect(material.roughness).toBe(0.9);
    expect(material.map.anisotropy).toBe(TEXTURE_ANISOTROPY);
  });

  it('keeps the original material when there is no override', () => {
    const material = new MeshStandardMaterial({ color: 0x123456 });
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), material));
    applyMaterialOverride(root, undefined);
    expect(material.color.getHex()).toBe(0x123456);
  });
});

describe('MODEL_CONFIGURATIONS grounding', () => {
  it('places every model base at its yOffset (the floor unless hung)', async () => {
    const { MODEL_CONFIGURATIONS } = await import('../config/scene.config');
    const service = TestBed.inject(ModelLoaderService);
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((() =>
      Promise.resolve({ scene: fakeScene() })) as never);
    for (const cfg of Object.values(MODEL_CONFIGURATIONS)) {
      const model = await service.loadModel(cfg);
      expect(new Box3().setFromObject(model).min.y).toBeCloseTo(
        cfg.yOffset ?? 0,
        2
      );
    }
    vi.restoreAllMocks();
  });
});

describe('disableRaycast', () => {
  it('makes every mesh of the tree invisible to raycasters', () => {
    const group = fakeScene();
    const ray = new Raycaster(new Vector3(10, 5, 20), new Vector3(0, 0, -1));
    group.updateMatrixWorld(true);
    expect(ray.intersectObject(group, true).length).toBeGreaterThan(0);
    disableRaycast(group);
    expect(ray.intersectObject(group, true)).toEqual([]);
  });
});
