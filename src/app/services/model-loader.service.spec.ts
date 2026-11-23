import { TestBed } from '@angular/core/testing';
import {
  Box3,
  BoxGeometry,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelConfiguration } from '../interfaces/scene.interface';
import { ModelLoaderService, disposeObject3D } from './model-loader.service';

function config(
  overrides: Partial<ModelConfiguration> = {}
): ModelConfiguration {
  return {
    path: '/assets/models/x/scene.gltf',
    position: new Vector3(3, 0.7, -2),
    scale: 1,
    rotation: new Euler(),
    metadata: { name: 'X', description: 'y' },
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

  it('reports real byte progress and 0 total when unknown (no Infinity)', async () => {
    const calls: [number, number][] = [];
    await service.loadModel(config(), (l, t) => calls.push([l, t]));
    expect(calls).toEqual([
      [50, 200],
      [70, 0],
    ]);
    expect(
      calls.every(([l, t]) => Number.isFinite(l) && Number.isFinite(t))
    ).toBe(true);
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
