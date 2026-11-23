import { Injectable } from '@angular/core';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  SpotLight,
} from 'three';
import { DEFAULT_SCENE_CONFIG } from '../config/scene.config';
import {
  DirectionalLightConfig,
  LightingConfiguration,
  RoomColors,
  RoomConfiguration,
} from '../interfaces/scene.interface';

@Injectable({
  providedIn: 'root',
})
export class RoomBuilderService {
  private readonly built: Object3D[] = [];

  buildRoom(
    scene: Scene,
    config: RoomConfiguration,
    lighting: LightingConfiguration = DEFAULT_SCENE_CONFIG.lighting
  ): void {
    const before = new Set(scene.children);
    this.setupSceneBackground(scene);
    this.createFloor(scene, config);
    this.createCeiling(scene, config);
    this.createWalls(scene, config);
    this.setupLighting(scene, lighting);
    this.built.push(...scene.children.filter(c => !before.has(c)));
  }

  /** Quita de la escena lo construido y libera geometrías y materiales. */
  dispose(scene: Scene): void {
    for (const object of this.built) {
      scene.remove(object);
      object.traverse(child => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (mesh.material as Material).dispose();
      });
      (object as DirectionalLight).shadow?.dispose();
    }
    this.built.length = 0;
  }

  private setupSceneBackground(scene: Scene): void {
    scene.background = new Color(0xf0f0f0);
  }

  private createFloor(scene: Scene, config: RoomConfiguration): void {
    const floorMaterial = this.createFloorMaterial(config.colors);
    const floorGeometry = new PlaneGeometry(config.width, config.depth);
    const floor = new Mesh(floorGeometry, floorMaterial);

    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    scene.add(floor);
  }

  private createCeiling(scene: Scene, config: RoomConfiguration): void {
    const ceilingMaterial = this.createCeilingMaterial(config.colors);
    const ceilingGeometry = new PlaneGeometry(config.width, config.depth);
    const ceiling = new Mesh(ceilingGeometry, ceilingMaterial);

    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = config.height;
    ceiling.receiveShadow = true;
    scene.add(ceiling);
  }

  private createWalls(scene: Scene, config: RoomConfiguration): void {
    this.createBackWall(scene, config);
    this.createFrontWall(scene, config);
    this.createLeftWall(scene, config);
    this.createRightWall(scene, config);
  }

  private createBackWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createWallMaterial(config.colors.accentWall);
    const wallGeometry = new PlaneGeometry(config.width, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.z = -config.depth / 2;
    wall.position.y = config.height / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private createFrontWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createWallMaterial(config.colors.mainWall);
    const wallGeometry = new PlaneGeometry(config.width, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.z = config.depth / 2;
    wall.position.y = config.height / 2;
    wall.rotation.y = Math.PI;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private createLeftWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createWallMaterial(config.colors.secondaryWall);
    const wallGeometry = new PlaneGeometry(config.depth, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.x = -config.width / 2;
    wall.position.y = config.height / 2;
    wall.rotation.y = Math.PI / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private createRightWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createWallMaterial(config.colors.mainWall);
    const wallGeometry = new PlaneGeometry(config.depth, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.x = config.width / 2;
    wall.position.y = config.height / 2;
    wall.rotation.y = -Math.PI / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private setupLighting(scene: Scene, lighting: LightingConfiguration): void {
    const { ambient, directional, spotlights } = lighting;
    scene.add(new AmbientLight(ambient.color, ambient.intensity));
    scene.add(this.createDirectionalLight(directional));
    for (const config of spotlights) {
      const light = new SpotLight(config.color, config.intensity);
      light.position.copy(config.position);
      light.target.position.copy(config.target);
      light.angle = config.angle;
      light.penumbra = config.penumbra;
      light.decay = config.decay;
      light.distance = config.distance;
      light.castShadow = config.castShadow;
      scene.add(light, light.target);
    }
  }

  /** Luz del sol con cámara de sombra que cubre toda la sala (sin recortes). */
  private createDirectionalLight(
    config: DirectionalLightConfig
  ): DirectionalLight {
    const light = new DirectionalLight(config.color, config.intensity);
    light.position.copy(config.position);
    light.castShadow = config.castShadow;
    const extent = config.shadowExtent ?? 10;
    const size = config.shadowMapSize ?? 2048;
    const camera = light.shadow.camera;
    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.near = 0.5;
    camera.far = config.position.length() + extent * 2;
    camera.updateProjectionMatrix();
    light.shadow.mapSize.set(size, size);
    light.shadow.bias = config.shadowBias ?? -0.0004;
    light.shadow.normalBias = config.shadowNormalBias ?? 0.03;
    light.shadow.radius = 3;
    return light;
  }

  private createFloorMaterial(colors: RoomColors): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: colors.floor,
      roughness: 0.6,
      metalness: 0,
    });
  }

  /** Muro mate de doble cara (red de seguridad si la cámara cruza el plano). */
  private createWallMaterial(color: number): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0,
      side: DoubleSide,
    });
  }

  private createCeilingMaterial(colors: RoomColors): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: colors.ceiling,
      roughness: 0.95,
      metalness: 0,
    });
  }
}
