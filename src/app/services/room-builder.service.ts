import { Injectable } from '@angular/core';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  DEFAULT_SCENE_CONFIG,
  FLOOR_TEXTURES,
  RUG_TEXTURES,
  TRIM,
} from '../config/scene.config';
import {
  DirectionalLightConfig,
  LightingConfiguration,
  RoomColors,
  RoomConfiguration,
} from '../interfaces/scene.interface';
import { TEXTURE_ANISOTROPY } from './model-loader.service';

/** Conjuntos de texturas de la sala que se cargan de forma asíncrona. */
export type RoomTextureSet = 'floor' | 'rug';

@Injectable({
  providedIn: 'root',
})
export class RoomBuilderService {
  private readonly built: Object3D[] = [];
  private readonly textures: Texture[] = [];
  private floorMaterial: MeshStandardMaterial | null = null;
  private rugMaterial: MeshStandardMaterial | null = null;
  /** Cambia en cada `dispose` para descartar cargas que llegan tarde. */
  private epoch = 0;

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
    this.createTrim(scene, config);
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
    this.releaseTextures();
    this.floorMaterial = null;
    this.rugMaterial = null;
    this.epoch++;
  }

  /**
   * Carga las texturas del suelo o de la alfombra y las aplica al terminar.
   * Si alguna falla, libera las que sí llegaron, conserva el color plano y
   * rechaza (el llamante avisa). `onProgress` recibe una fracción 0–1.
   */
  async loadTextures(
    set: RoomTextureSet,
    onProgress?: (fraction: number) => void
  ): Promise<void> {
    const material = set === 'floor' ? this.floorMaterial : this.rugMaterial;
    if (!material) return;
    const epoch = this.epoch;
    const slots = this.textureSlots(set);
    const fractions = slots.map(() => 0);
    const report = () =>
      onProgress?.(fractions.reduce((a, b) => a + b, 0) / slots.length);

    const loader = new TextureLoader();
    const results = await Promise.allSettled(
      slots.map(async (slot, i) => {
        const texture = await loader.loadAsync(slot.path, event => {
          if (event.lengthComputable && event.total > 0) {
            fractions[i] = Math.min(event.loaded / event.total, 0.99);
            report();
          }
        });
        fractions[i] = 1;
        report();
        return texture;
      })
    );
    const loaded = results.flatMap(r =>
      r.status === 'fulfilled' ? [r.value] : []
    );
    const failure = results.find(r => r.status === 'rejected');
    if (failure || epoch !== this.epoch) {
      loaded.forEach(texture => texture.dispose());
      if (failure) throw (failure as PromiseRejectedResult).reason;
      return;
    }

    const config = set === 'floor' ? FLOOR_TEXTURES : RUG_TEXTURES;
    slots.forEach((slot, i) => {
      const texture = loaded[i];
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(config.repeat.x, config.repeat.y);
      texture.anisotropy = TEXTURE_ANISOTROPY;
      texture.colorSpace = slot.srgb ? SRGBColorSpace : NoColorSpace;
      this.textures.push(texture);
      material[slot.slot] = texture;
    });
    if (set === 'floor') {
      material.normalScale.setScalar(FLOOR_TEXTURES.normalScale);
      material.roughness = 1;
      // La madera aporta el color: sin multiplicar por el gris de reserva.
      material.color.set(0xffffff);
    } else {
      material.normalScale.setScalar(0.6);
    }
    material.needsUpdate = true;
  }

  private textureSlots(set: RoomTextureSet): {
    path: string;
    slot: 'map' | 'normalMap' | 'roughnessMap';
    srgb: boolean;
  }[] {
    return set === 'floor'
      ? [
          { path: FLOOR_TEXTURES.diffuse, slot: 'map', srgb: true },
          { path: FLOOR_TEXTURES.normal, slot: 'normalMap', srgb: false },
          { path: FLOOR_TEXTURES.arm, slot: 'roughnessMap', srgb: false },
        ]
      : [
          { path: RUG_TEXTURES.diffuse, slot: 'map', srgb: true },
          { path: RUG_TEXTURES.normal, slot: 'normalMap', srgb: false },
        ];
  }

  private releaseTextures(): void {
    this.textures.forEach(texture => texture.dispose());
    this.textures.length = 0;
  }

  private setupSceneBackground(scene: Scene): void {
    scene.background = new Color(0xece2d1);
  }

  private createFloor(scene: Scene, config: RoomConfiguration): void {
    const floorMaterial = this.createFloorMaterial(config.colors);
    this.floorMaterial = floorMaterial;
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

  /** Zócalo (una malla fusionada de 4 tramos) y alfombra, en un grupo aparte. */
  private createTrim(scene: Scene, config: RoomConfiguration): void {
    const group = new Group();
    group.name = 'room-trim';
    const { height, depth } = TRIM;
    const runs: [number, number, number, number][] = [
      // [ancho, fondo, x, z]
      [config.width, depth, 0, -config.depth / 2 + depth / 2],
      [config.width, depth, 0, config.depth / 2 - depth / 2],
      [depth, config.depth, -config.width / 2 + depth / 2, 0],
      [depth, config.depth, config.width / 2 - depth / 2, 0],
    ];
    const geometry = mergeGeometries(
      runs.map(([w, d, x, z]) =>
        new BoxGeometry(w, height, d).translate(x, height / 2, z)
      )
    );
    const skirting = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: TRIM.color,
        roughness: TRIM.roughness,
        metalness: 0,
      })
    );
    skirting.name = 'skirting';
    skirting.receiveShadow = true;
    skirting.raycast = () => undefined;
    group.add(skirting);

    this.rugMaterial = new MeshStandardMaterial({
      color: RUG_TEXTURES.tint,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    // Ribete claro: da lectura a la alfombra a la distancia de la vista inicial.
    const border = new Mesh(
      new PlaneGeometry(
        RUG_TEXTURES.width + 2 * RUG_TEXTURES.borderWidth,
        RUG_TEXTURES.depth + 2 * RUG_TEXTURES.borderWidth
      ),
      new MeshStandardMaterial({
        color: RUG_TEXTURES.borderColor,
        roughness: 1,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    border.name = 'rug-border';
    border.rotation.order = 'YXZ';
    border.rotation.set(-Math.PI / 2, RUG_TEXTURES.rotationY, 0);
    border.position.set(
      RUG_TEXTURES.center.x,
      RUG_TEXTURES.y - 0.002,
      RUG_TEXTURES.center.y
    );
    border.receiveShadow = true;
    border.raycast = () => undefined;
    group.add(border);
    const rug = new Mesh(
      new PlaneGeometry(RUG_TEXTURES.width, RUG_TEXTURES.depth),
      this.rugMaterial
    );
    rug.name = 'rug';
    rug.rotation.order = 'YXZ';
    rug.rotation.set(-Math.PI / 2, RUG_TEXTURES.rotationY, 0);
    rug.position.set(
      RUG_TEXTURES.center.x,
      RUG_TEXTURES.y,
      RUG_TEXTURES.center.y
    );
    rug.receiveShadow = true;
    rug.raycast = () => undefined;
    group.add(rug);
    scene.add(group);
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
