import { Injectable } from '@angular/core';
import { Box3, Material, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelConfiguration } from '../interfaces/scene.interface';

@Injectable({
  providedIn: 'root',
})
export class ModelLoaderService {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  async loadModel(config: ModelConfiguration): Promise<Object3D> {
    return new Promise((resolve, reject) => {
      const cleanPath = config.path.replace(/^\/+/, '');

      this.loader.load(
        cleanPath,
        gltf => {
          const model = gltf.scene;
          this.applyTransformations(model, config);
          this.setupShadows(model);
          this.updateMaterials(model);
          resolve(model);
        },
        progress => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(
            `Loading progress for ${config.path}: ${percent.toFixed(2)}%`
          );
        },
        error => {
          console.error(`Error loading model ${config.path}:`, error);
          reject(error);
        }
      );
    });
  }

  private applyTransformations(
    model: Object3D,
    config: ModelConfiguration
  ): void {
    model.position.copy(config.position);
    model.rotation.copy(config.rotation);
    model.scale.setScalar(config.scale);

    // Center model if needed
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    model.position.sub(center).add(config.position);
  }

  private setupShadows(model: Object3D): void {
    model.traverse(child => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  private updateMaterials(model: Object3D): void {
    model.traverse(child => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material) {
          const material = mesh.material as Material;
          material.needsUpdate = true;
        }
      }
    });
  }

  dispose(): void {
    this.loader = new GLTFLoader();
  }
}
