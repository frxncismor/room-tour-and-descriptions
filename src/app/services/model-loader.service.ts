import { Injectable } from '@angular/core';
import {
  Box3,
  Color,
  LoadingManager,
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

/** Hace que ninguna malla del árbol reciba clics ni hover (la decoración). */
export function disableRaycast(root: Object3D): void {
  root.traverse(child => {
    if ((child as Mesh).isMesh) child.raycast = () => undefined;
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
  /** Cada carga usa su propio `LoadingManager` para contar .bin y texturas de ese modelo. */
  private createLoader(manager: LoadingManager): GLTFLoader {
    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }

  /**
   * Carga un modelo y lo coloca por su base sobre el suelo.
   * `onProgress(loaded, total)` va en unidades de recurso: cada fichero que el
   * manager descubre (gltf, .bin, texturas) cuenta 1, y el fichero principal
   * aporta su fracción de bytes mientras descarga. Así el progreso incluye los
   * ficheros secundarios y no salta al final. `total` crece al descubrirlos.
   */
  async loadModel(
    config: Omit<ModelConfiguration, 'metadata'>,
    onProgress?: LoadProgressCallback
  ): Promise<Object3D> {
    const cleanPath = config.path.replace(/^\/+/, '');
    let itemsLoaded = 0;
    let itemsTotal = 0;
    let mainFraction = 0;
    const report = () => {
      const total = Math.max(itemsTotal, 1);
      // Cuando el principal ya terminó, `itemsLoaded` ya lo cuenta.
      const partial = itemsLoaded === 0 ? mainFraction : 0;
      onProgress?.(Math.min(itemsLoaded + partial, total), total);
    };
    const manager = new LoadingManager();
    manager.onStart = (_url, loaded, total) => {
      itemsLoaded = loaded;
      itemsTotal = total;
      report();
    };
    manager.onProgress = (_url, loaded, total) => {
      itemsLoaded = loaded;
      itemsTotal = total;
      report();
    };

    const gltf = await this.createLoader(manager).loadAsync(
      cleanPath,
      event => {
        mainFraction =
          event.lengthComputable && event.total > 0
            ? Math.min(event.loaded / event.total, 1)
            : 0;
        report();
      }
    );
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
    config: Omit<ModelConfiguration, 'metadata'>
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
}
