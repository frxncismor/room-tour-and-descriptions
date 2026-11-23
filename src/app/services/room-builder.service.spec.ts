import { TestBed } from '@angular/core/testing';
import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import {
  DEFAULT_SCENE_CONFIG,
  FLOOR_TEXTURES,
  RUG_TEXTURES,
  TRIM,
} from '../config/scene.config';
import { RoomBuilderService } from './room-builder.service';

describe('RoomBuilderService', () => {
  let service: RoomBuilderService;
  let scene: Scene;
  const { room, lighting } = DEFAULT_SCENE_CONFIG;

  beforeEach(() => {
    service = TestBed.inject(RoomBuilderService);
    scene = new Scene();
    service.buildRoom(scene, room);
  });

  const meshes = () => scene.children.filter(c => (c as Mesh).isMesh) as Mesh[];

  it('creates a floor, a ceiling and four walls', () => {
    expect(meshes()).toHaveLength(6);
    expect(scene.getObjectByName('floor')).toBeDefined();
  });

  it('uses matte double-sided standard materials for the walls', () => {
    const walls = meshes().filter(m => m.position.y === room.height / 2);
    expect(walls).toHaveLength(4);
    for (const wall of walls) {
      const material = wall.material as MeshStandardMaterial;
      expect(material.type).toBe('MeshStandardMaterial');
      expect(material.side).toBe(DoubleSide);
      expect(material.roughness).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('builds the lights from the configuration', () => {
    expect(
      scene.children.filter(c => (c as AmbientLight).isAmbientLight)
    ).toHaveLength(1);
    const spots = scene.children.filter(
      c => (c as SpotLight).isSpotLight
    ) as SpotLight[];
    expect(spots).toHaveLength(lighting.spotlights.length);
    expect(spots.every(s => !s.castShadow)).toBe(true);
  });

  it('sizes the directional shadow camera to cover the whole room', () => {
    const sun = scene.children.find(
      c => (c as DirectionalLight).isDirectionalLight
    ) as DirectionalLight;
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.width).toBe(2048);
    expect(sun.shadow.camera.right).toBeGreaterThanOrEqual(room.width / 2 + 2);
    expect(sun.shadow.camera.far).toBeGreaterThan(
      sun.position.length() + room.width / 2
    );
    expect(sun.shadow.normalBias).toBeGreaterThan(0);
  });

  it('is the only shadow-casting light', () => {
    const casters = scene.children.filter(
      c => (c as DirectionalLight).castShadow
    );
    expect(casters).toHaveLength(1);
  });

  it('dispose removes everything it built and frees the materials', () => {
    const material = meshes()[0].material as MeshStandardMaterial;
    const spy = vi.spyOn(material, 'dispose');
    service.dispose(scene);
    expect(scene.children).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  it('uses the paper-sunk scene background', () => {
    expect((scene.background as Color).getHex()).toBe(0xece2d1);
  });

  describe('trim and rug (room-trim group)', () => {
    const trim = () => scene.getObjectByName('room-trim') as Group;

    it('keeps the six room meshes outside the trim group', () => {
      expect(trim().isGroup).toBe(true);
      expect(meshes()).toHaveLength(6);
    });

    it('builds the skirting as one merged mesh of four runs', () => {
      const skirting = trim().getObjectByName('skirting') as Mesh;
      expect(skirting.isMesh).toBe(true);
      expect(skirting.geometry.index!.count / 3).toBe(48);
      const material = skirting.material as MeshStandardMaterial;
      expect(material.color.getHex()).toBe(TRIM.color);
      expect(material.roughness).toBe(TRIM.roughness);
      skirting.geometry.computeBoundingBox();
      const box = skirting.geometry.boundingBox!;
      expect(box.max.y - box.min.y).toBeCloseTo(TRIM.height);
      expect(box.max.x).toBeCloseTo(room.width / 2);
    });

    it('lays a rug that ignores raycasts so clicks fall on the floor', () => {
      const rug = trim().getObjectByName('rug') as Mesh;
      expect(rug.position.y).toBeCloseTo(RUG_TEXTURES.y);
      expect(rug.rotation.y).toBeCloseTo(RUG_TEXTURES.rotationY);
      expect((rug.material as MeshStandardMaterial).polygonOffset).toBe(true);
      const hits: unknown[] = [];
      rug.raycast({ ray: {} } as never, hits as never);
      expect(hits).toHaveLength(0);
    });
  });

  describe('loadTextures', () => {
    let loadAsync: ReturnType<typeof vi.spyOn>;
    const floor = () => scene.getObjectByName('floor') as Mesh;
    const rugMaterial = () =>
      (scene.getObjectByName('rug') as Mesh).material as MeshStandardMaterial;

    beforeEach(() => {
      loadAsync = vi
        .spyOn(TextureLoader.prototype, 'loadAsync')
        .mockImplementation(async () => new Texture());
    });

    afterEach(() => vi.restoreAllMocks());

    it('applies map, normalMap and roughnessMap to the floor', async () => {
      await service.loadTextures('floor');
      const m = floor().material as MeshStandardMaterial;
      expect(m.map!.colorSpace).toBe(SRGBColorSpace);
      expect(m.normalMap!.colorSpace).not.toBe(SRGBColorSpace);
      expect(m.roughnessMap!.colorSpace).not.toBe(SRGBColorSpace);
      expect(m.map!.wrapS).toBe(RepeatWrapping);
      expect(m.map!.repeat.x).toBeCloseTo(FLOOR_TEXTURES.repeat.x);
      expect(m.map!.anisotropy).toBeLessThanOrEqual(8);
      expect(m.normalScale.x).toBeCloseTo(FLOOR_TEXTURES.normalScale);
      expect(m.roughness).toBe(1);
    });

    it('applies map and normalMap to the tinted rug', async () => {
      await service.loadTextures('rug');
      const m = rugMaterial();
      expect(m.map).toBeInstanceOf(Texture);
      expect(m.normalMap).toBeInstanceOf(Texture);
      expect(m.color.getHex()).toBe(RUG_TEXTURES.tint);
      expect(m.map!.repeat.x).toBeCloseTo(RUG_TEXTURES.repeat.x);
    });

    it('reports progress up to 1', async () => {
      const seen: number[] = [];
      await service.loadTextures('floor', f => seen.push(f));
      expect(seen.at(-1)).toBe(1);
      expect(seen).toEqual([...seen].sort((a, b) => a - b));
    });

    it('keeps the flat colour, frees partial textures and rejects on failure', async () => {
      const ok = new Texture();
      const dispose = vi.spyOn(ok, 'dispose');
      loadAsync.mockReset();
      loadAsync
        .mockResolvedValueOnce(ok)
        .mockRejectedValueOnce(new Error('404'))
        .mockResolvedValueOnce(new Texture());
      await expect(service.loadTextures('floor')).rejects.toThrow();
      const m = floor().material as MeshStandardMaterial;
      expect(m.map).toBeNull();
      expect(m.color.getHex()).toBe(room.colors.floor);
      expect(dispose).toHaveBeenCalled();
    });

    it('dispose frees the five textures and leaves the scene empty', async () => {
      await service.loadTextures('floor');
      await service.loadTextures('rug');
      const spies = [
        (floor().material as MeshStandardMaterial).map!,
        (floor().material as MeshStandardMaterial).normalMap!,
        (floor().material as MeshStandardMaterial).roughnessMap!,
        rugMaterial().map!,
        rugMaterial().normalMap!,
      ].map(t => vi.spyOn(t, 'dispose'));
      service.dispose(scene);
      expect(scene.children).toHaveLength(0);
      for (const spy of spies) expect(spy).toHaveBeenCalled();
    });

    it('drops textures that arrive after dispose', async () => {
      const late = new Texture();
      const dispose = vi.spyOn(late, 'dispose');
      loadAsync.mockReset();
      loadAsync.mockImplementation(async () => {
        service.dispose(scene);
        return late;
      });
      await service.loadTextures('rug');
      expect(dispose).toHaveBeenCalled();
    });
  });
});
