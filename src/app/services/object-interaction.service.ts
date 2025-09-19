import { Injectable } from '@angular/core';
import {
  AdditiveBlending,
  BackSide,
  Box3,
  BoxGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';
import {
  InteractionResult,
  ObjectInfo,
  RoomLimits,
} from '../interfaces/scene.interface';

@Injectable({
  providedIn: 'root',
})
export class ObjectInteractionService {
  private raycaster: Raycaster;
  private objects: Map<Object3D, ObjectInfo>;
  private outlineMaterial: Material;
  private outlineMesh: Mesh | null = null;
  private roomLimits: RoomLimits;

  constructor() {
    this.raycaster = new Raycaster();
    this.objects = new Map();
    this.roomLimits = {
      minX: -8,
      maxX: 8,
      minZ: -8,
      maxZ: 8,
    };
    this.outlineMaterial = this.createOutlineMaterial();
  }

  private createOutlineMaterial(): Material {
    return new MeshBasicMaterial({
      color: 0x2c4a52,
      side: BackSide,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  }

  setRoomLimits(limits: RoomLimits): void {
    this.roomLimits = limits;
  }

  async handleClick(
    event: MouseEvent,
    camera: unknown,
    scene: unknown
  ): Promise<InteractionResult> {
    try {
      const mousePosition = this.getMousePosition(event);
      this.raycaster.setFromCamera(mousePosition, camera);
      const intersects = this.raycaster.intersectObjects(scene.children, true);

      this.removeOutline();

      for (const intersect of intersects) {
        const object = intersect.object;

        if (this.isFloorClick(object)) {
          const teleportResult = this.handleFloorClick(intersect.point);
          if (teleportResult) {
            return { objectInfo: null, success: true };
          }
          continue;
        }

        const objectInfo = this.handleObjectClick(object);
        if (objectInfo) {
          return { objectInfo, success: true };
        }
      }

      return { objectInfo: null, success: true };
    } catch (error) {
      return {
        objectInfo: null,
        success: false,
        error: error instanceof Error ? error.message : 'Interaction failed',
      };
    }
  }

  private getMousePosition(event: MouseEvent): Vector2 {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return new Vector2(x, y);
  }

  private isFloorClick(object: Object3D): boolean {
    return object.name === 'floor';
  }

  private handleFloorClick(point: Vector3): boolean {
    const targetPosition = this.validateTeleportationPosition(point);
    return targetPosition !== null;
  }

  private handleObjectClick(object: Object3D): ObjectInfo | null {
    const rootObject = this.findRootObject(object);
    if (rootObject && this.objects.has(rootObject)) {
      this.createOutline(rootObject);
      return this.objects.get(rootObject) || null;
    }
    return null;
  }

  private validateTeleportationPosition(position: Vector3): Vector3 | null {
    const clampedX = Math.max(
      this.roomLimits.minX + 1.5,
      Math.min(this.roomLimits.maxX - 1.5, position.x)
    );
    const clampedZ = Math.max(
      this.roomLimits.minZ + 1.5,
      Math.min(this.roomLimits.maxZ - 1.5, position.z)
    );

    if (
      Math.abs(clampedX - position.x) > 2 ||
      Math.abs(clampedZ - position.z) > 2
    ) {
      return null;
    }

    return new Vector3(clampedX, position.y, clampedZ);
  }

  private findRootObject(object: Object3D): Object3D | null {
    let current = object;
    while (current.parent && !this.objects.has(current)) {
      current = current.parent;
    }
    return this.objects.has(current) ? current : null;
  }

  createOutline(object: Object3D): void {
    const bbox = new Box3().setFromObject(object);
    const size = new Vector3();
    bbox.getSize(size);

    const outlineGeometry = new BoxGeometry(
      size.x * 1.02,
      size.y * 1.02,
      size.z * 1.02
    );

    this.outlineMesh = new Mesh(outlineGeometry, this.outlineMaterial);

    const center = new Vector3();
    bbox.getCenter(center);
    this.outlineMesh.position.copy(center);
    this.outlineMesh.quaternion.copy(object.quaternion);

    this.animateOutline();
  }

  private animateOutline(): void {
    if (!this.outlineMesh) return;

    const animate = () => {
      if (this.outlineMesh) {
        this.outlineMaterial.opacity = 0.3 + Math.sin(Date.now() * 0.002) * 0.1;
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  removeOutline(): void {
    if (this.outlineMesh) {
      this.outlineMesh = null;
    }
  }

  addObject(object: Object3D, info: ObjectInfo): void {
    this.objects.set(object, info);
  }

  removeObject(object: Object3D): void {
    this.objects.delete(object);
  }

  getObjectInfo(object: Object3D): ObjectInfo | undefined {
    return this.objects.get(object);
  }

  dispose(): void {
    this.objects.clear();
    this.removeOutline();
  }
}
