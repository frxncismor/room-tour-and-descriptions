import { TestBed } from '@angular/core/testing';
import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SpotLight,
} from 'three';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
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
});
