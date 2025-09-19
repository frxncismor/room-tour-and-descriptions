import { Injectable } from '@angular/core';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Scene,
  SpotLight,
} from 'three';
import { RoomColors, RoomConfiguration } from '../interfaces/scene.interface';

@Injectable({
  providedIn: 'root',
})
export class RoomBuilderService {
  buildRoom(scene: Scene, config: RoomConfiguration): void {
    this.setupSceneBackground(scene);
    this.createFloor(scene, config);
    this.createCeiling(scene, config);
    this.createWalls(scene, config);
    this.setupLighting(scene, config);
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
    const wallMaterial = this.createAccentWallMaterial(config.colors);
    const wallGeometry = new PlaneGeometry(config.width, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.z = -config.depth / 2;
    wall.position.y = config.height / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private createFrontWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createMainWallMaterial(config.colors);
    const wallGeometry = new PlaneGeometry(config.width, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.z = config.depth / 2;
    wall.position.y = config.height / 2;
    wall.rotation.y = Math.PI;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private createLeftWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createSecondaryWallMaterial(config.colors);
    const wallGeometry = new PlaneGeometry(config.depth, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.x = -config.width / 2;
    wall.position.y = config.height / 2;
    wall.rotation.y = Math.PI / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private createRightWall(scene: Scene, config: RoomConfiguration): void {
    const wallMaterial = this.createMainWallMaterial(config.colors);
    const wallGeometry = new PlaneGeometry(config.depth, config.height);
    const wall = new Mesh(wallGeometry, wallMaterial);

    wall.position.x = config.width / 2;
    wall.position.y = config.height / 2;
    wall.rotation.y = -Math.PI / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  private setupLighting(scene: Scene, config: RoomConfiguration): void {
    this.addAmbientLight(scene);
    this.addDirectionalLight(scene);
    this.addSpotlights(scene, config);
  }

  private addAmbientLight(scene: Scene): void {
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
  }

  private addDirectionalLight(scene: Scene): void {
    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
  }

  private addSpotlights(scene: Scene, config: RoomConfiguration): void {
    this.addMainSpotlight(scene, config);
    this.addAccentSpotlights(scene, config);
  }

  private addMainSpotlight(scene: Scene, config: RoomConfiguration): void {
    const mainLight = new SpotLight(0xfff4e6, 1);
    mainLight.position.set(0, config.height - 0.1, 0);
    mainLight.angle = Math.PI / 3;
    mainLight.penumbra = 0.7;
    mainLight.decay = 1.5;
    mainLight.distance = config.height * 2;
    mainLight.castShadow = true;
    mainLight.shadow.bias = -0.001;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);
  }

  private addAccentSpotlights(scene: Scene, config: RoomConfiguration): void {
    const accentLight1 = this.createAccentLight(
      -config.width / 4,
      config.height - 0.2,
      -config.depth / 2 + 1,
      -config.width / 4,
      0,
      -config.depth / 2,
      config.height
    );
    scene.add(accentLight1);
    scene.add(accentLight1.target);

    const accentLight2 = this.createAccentLight(
      config.width / 4,
      config.height - 0.2,
      -config.depth / 2 + 1,
      config.width / 4,
      0,
      -config.depth / 2,
      config.height
    );
    scene.add(accentLight2);
    scene.add(accentLight2.target);
  }

  private createAccentLight(
    x: number,
    y: number,
    z: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    roomHeight: number
  ): SpotLight {
    const light = new SpotLight(0xffffff, 0.6);
    light.position.set(x, y, z);
    light.target.position.set(targetX, targetY, targetZ);
    light.angle = Math.PI / 6;
    light.penumbra = 0.5;
    light.decay = 1.5;
    light.distance = roomHeight * 1.5;
    light.castShadow = true;
    return light;
  }

  private createFloorMaterial(colors: RoomColors): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({
      color: colors.floor,
      roughness: 0.7,
      metalness: 0.2,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
    });
  }

  private createMainWallMaterial(colors: RoomColors): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({
      color: colors.mainWall,
      roughness: 0.95,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5,
    });
  }

  private createAccentWallMaterial(colors: RoomColors): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({
      color: colors.accentWall,
      roughness: 0.9,
      metalness: 0.15,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3,
    });
  }

  private createSecondaryWallMaterial(
    colors: RoomColors
  ): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({
      color: colors.secondaryWall,
      roughness: 0.95,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5,
    });
  }

  private createCeilingMaterial(colors: RoomColors): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({
      color: colors.ceiling,
      roughness: 0.9,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5,
    });
  }
}
