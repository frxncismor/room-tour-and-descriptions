import { Injectable } from '@angular/core';
import {
  Box3,
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  LoadProgressCallback,
  MaterialOverride,
  ModelConfiguration,
} from '../interfaces/scene.interface';

/** Libera geometrías, materiales y texturas de un árbol de objetos. */
export function disposeObject3D(root: Object3D): void {
  root.traverse(child => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials: Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && (value as Texture).isTexture) {
          (value as Texture).dispose();
        }
      }
      material.dispose();
    }
  });
}

/** Anisotropía pedida a las texturas (la GPU la limita a su máximo). */
export const TEXTURE_ANISOTROPY = 8;

/** Aplica color/rugosidad/metalicidad configurados y afina el filtrado de las texturas. */
export function applyMaterialOverride(
  root: Object3D,
  override?: MaterialOverride
): void {
  root.traverse(child => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const materials: Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      const standard = material as MeshStandardMaterial;
      if (!standard?.isMeshStandardMaterial) continue;
      if (override?.color !== undefined) {
        standard.color = new Color(override.color);
      }
      if (override?.roughness !== undefined) {
        standard.roughness = override.roughness;
      }
      if (override?.metalness !== undefined) {
        standard.metalness = override.metalness;
      }
      for (const value of Object.values(standard)) {
        if (value && (value as Texture).isTexture) {
          (value as Texture).anisotropy = TEXTURE_ANISOTROPY;
        }
      }
      standard.needsUpdate = true;
    }
  });
}

@Injectable({
  providedIn: 'root',
})
export class ModelLoaderService {
  private loader: GLTFLoader;

  constructor() {
    this.loader = this.createLoader();
  }

  private createLoader(): GLTFLoader {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }

  /**
   * Carga un modelo y lo coloca por su base sobre el suelo.
   * `onProgress` recibe bytes reales; `total` es 0 si el servidor no lo informa.
   */
  async loadModel(
    config: ModelConfiguration,
    onProgress?: LoadProgressCallback
  ): Promise<Object3D> {
    const cleanPath = config.path.replace(/^\/+/, '');
    const gltf = await this.loader.loadAsync(cleanPath, event => {
      const total = event.lengthComputable && event.total > 0 ? event.total : 0;
      onProgress?.(event.loaded, total);
    });
    const model = gltf.scene;
    applyMaterialOverride(model, config.materialOverride);
    this.applyTransformations(model, config);
    this.setupShadows(model);
    return model;
  }

  /**
   * Escala y rota el modelo, centra su caja en X/Z sobre `config.position`
   * y apoya su base (minY) en `yOffset` (0 = suelo).
   */
  private applyTransformations(
    model: Object3D,
    config: ModelConfiguration
  ): void {
    model.position.set(0, 0, 0);
    model.rotation.copy(config.rotation);
    model.scale.setScalar(config.scale);
    model.updateMatrixWorld(true);

    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    model.position.set(
      config.position.x - center.x,
      (config.yOffset ?? 0) - box.min.y,
      config.position.z - center.z
    );
    model.updateMatrixWorld(true);
  }

  /** Proyecta/recibe sombras solo en mallas opacas (las transparentes no proyectan). */
  private setupShadows(model: Object3D): void {
    model.traverse(child => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      mesh.castShadow = !materials.some(m => m?.transparent);
      mesh.receiveShadow = true;
    });
  }

  dispose(): void {
    this.loader = this.createLoader();
  }
}
