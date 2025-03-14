import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

@Injectable({
  providedIn: 'root'
})
export class SceneService {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls!: PointerLockControls;
  private raycaster: THREE.Raycaster;
  private selectedObject: THREE.Object3D | null = null;
  private objects: Map<THREE.Object3D, { name: string, description: string }> = new Map();
  private walls: THREE.Mesh[] = [];
  private clickableObjects = new Map<THREE.Object3D, { name: string; description: string }>();
  private prevTime = performance.now();
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveSpeed = 0.1;
  private direction = new THREE.Vector3();
  private velocity = new THREE.Vector3();

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.raycaster = new THREE.Raycaster();
  }

  public initialize(container: HTMLElement): void {
    console.log('Initializing scene with container:', container);
    
    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    // Setup camera with better initial position for viewing the room
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 1.6, 5); // Move camera back to see the room
    this.camera.lookAt(new THREE.Vector3(0, 1.6, 0));

    // Setup renderer with better quality
    if (!(container instanceof HTMLCanvasElement)) {
      console.error('Container is not a canvas element:', container);
      return;
    }
    
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: container,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    // Set renderer size and pixel ratio
    const rect = container.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Setup controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    
    // Setup lighting for better visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);

    // Add fill lights for better visibility
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 1);
    fillLight1.position.set(-5, 3, -5);
    this.scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 1);
    fillLight2.position.set(5, 3, -5);
    this.scene.add(fillLight2);

    // Create room
    this.createRoom();

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    console.log('Scene initialized with camera position:', this.camera.position);
  }

  public async loadModel(path: string, position: THREE.Vector3, scale: number = 1, rotation: THREE.Euler = new THREE.Euler()): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      const cleanPath = path.replace(/^\/+/, '');
      const loader = new GLTFLoader();
      
      console.log('Loading model from path:', cleanPath);
      
      loader.load(
        cleanPath,
        (gltf: GLTF) => {
          const model = gltf.scene;
          
          // Apply transformations
          model.position.copy(position);
          model.rotation.copy(rotation);
          model.scale.setScalar(scale);

          // Center model if needed
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center).add(position);

          // Apply shadows to all meshes
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Update materials for better rendering
              if (mesh.material) {
                const material = mesh.material as THREE.Material;
                material.needsUpdate = true;
              }
            }
          });

          this.scene.add(model);
          console.log(`Model loaded successfully: ${path}`);
          resolve(model);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`Loading progress for ${path}: ${percent.toFixed(2)}%`);
        },
        (error) => {
          console.error(`Error loading model ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  // Movement control methods
  public setMoveForward(moving: boolean): void {
    this.moveForward = moving;
  }

  public setMoveBackward(moving: boolean): void {
    this.moveBackward = moving;
  }

  public setMoveLeft(moving: boolean): void {
    this.moveLeft = moving;
  }

  public setMoveRight(moving: boolean): void {
    this.moveRight = moving;
  }

  public lockControls(): void {
    this.controls.lock();
  }

  public isLocked(): boolean {
    return this.controls.isLocked;
  }

  public onMouseClick(event: MouseEvent): { name: string; description: string } | null {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, this.camera);

    // Get all objects that can be clicked
    const objects = Array.from(this.clickableObjects.keys());
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      // Find the parent object that is in our clickableObjects map
      let clickedObject = intersects[0].object;
      while (clickedObject && !this.clickableObjects.has(clickedObject)) {
        clickedObject = clickedObject.parent!;
      }

      if (clickedObject && this.clickableObjects.has(clickedObject)) {
        return this.clickableObjects.get(clickedObject)!;
      }
    }

    return null;
  }

  public addObject(object: THREE.Object3D, name: string, description: string): void {
    this.clickableObjects.set(object, { name, description });
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    // Handle movement
    if (this.controls.isLocked) {
      const velocity = new THREE.Vector3();
      const direction = new THREE.Vector3();

      // Get current camera direction
      this.camera.getWorldDirection(direction);
      direction.y = 0; // Keep movement in horizontal plane
      direction.normalize();

      // Calculate right vector (perpendicular to camera direction)
      const right = new THREE.Vector3();
      right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize(); // FORWARD × UP = RIGHT

      // Apply movement based on key states
      if (this.moveForward) velocity.add(direction.clone().multiplyScalar(this.moveSpeed));
      if (this.moveBackward) velocity.add(direction.clone().multiplyScalar(-this.moveSpeed));
      if (this.moveRight) velocity.add(right.clone().multiplyScalar(this.moveSpeed));
      if (this.moveLeft) velocity.add(right.clone().multiplyScalar(-this.moveSpeed));

      // Check collision before applying movement
      const nextPosition = this.camera.position.clone().add(velocity);
      if (!this.checkCollision(nextPosition)) {
        this.camera.position.add(velocity);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private checkCollision(position: THREE.Vector3): boolean {
    const playerRadius = 0.5;
    const playerBoundingSphere = new THREE.Sphere(position, playerRadius);

    // Check collision with walls
    for (const wall of this.walls) {
      const wallBox = new THREE.Box3().setFromObject(wall);
      if (wallBox.intersectsSphere(playerBoundingSphere)) {
        return true;
      }
    }

    return false;
  }

  private createRoom(): void {
    // Modern color palette
    const floorColor = 0xe0e0e0; // Light warm gray for polished concrete
    const mainWallColor = 0xf5e6d3; // Warm beige
    const accentWallColor = 0x2c4a52; // Deep teal
    const secondaryWallColor = 0xe6d5c9; // Soft terracotta
    const ceilingColor = 0xfaf4ec; // Warm off-white

    // Room dimensions
    const roomWidth = 20;
    const roomHeight = 4;
    const roomDepth = 20;

    // Create materials with better lighting properties
    const floorMaterial = new THREE.MeshPhysicalMaterial({
      color: floorColor,
      roughness: 0.7,
      metalness: 0.2,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4
    });

    const mainWallMaterial = new THREE.MeshPhysicalMaterial({
      color: mainWallColor,
      roughness: 0.95,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5
    });

    const accentWallMaterial = new THREE.MeshPhysicalMaterial({
      color: accentWallColor,
      roughness: 0.9,
      metalness: 0.15,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3
    });

    const secondaryWallMaterial = new THREE.MeshPhysicalMaterial({
      color: secondaryWallColor,
      roughness: 0.95,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5
    });

    const ceilingMaterial = new THREE.MeshPhysicalMaterial({
      color: ceilingColor,
      roughness: 0.9,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5
    });

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Create ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    ceiling.receiveShadow = true;
    this.scene.add(ceiling);

    // Create walls
    // Back wall (accent wall - deep teal)
    const backWallGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
    const backWall = new THREE.Mesh(backWallGeometry, accentWallMaterial);
    backWall.position.z = -roomDepth / 2;
    backWall.position.y = roomHeight / 2;
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Front wall (main wall - warm beige)
    const frontWallGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
    const frontWall = new THREE.Mesh(frontWallGeometry, mainWallMaterial);
    frontWall.position.z = roomDepth / 2;
    frontWall.position.y = roomHeight / 2;
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Left wall (secondary wall - soft terracotta)
    const leftWallGeometry = new THREE.PlaneGeometry(roomDepth, roomHeight);
    const leftWall = new THREE.Mesh(leftWallGeometry, secondaryWallMaterial);
    leftWall.position.x = -roomWidth / 2;
    leftWall.position.y = roomHeight / 2;
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // Right wall (main wall - warm beige)
    const rightWallGeometry = new THREE.PlaneGeometry(roomDepth, roomHeight);
    const rightWall = new THREE.Mesh(rightWallGeometry, mainWallMaterial);
    rightWall.position.x = roomWidth / 2;
    rightWall.position.y = roomHeight / 2;
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // Modern lighting setup
    // Main ceiling light with warmer tone
    const mainLight = new THREE.SpotLight(0xfff4e6, 1);
    mainLight.position.set(0, roomHeight - 0.1, 0);
    mainLight.angle = Math.PI / 3;
    mainLight.penumbra = 0.7;
    mainLight.decay = 1.5;
    mainLight.distance = roomWidth;
    mainLight.castShadow = true;
    mainLight.shadow.bias = -0.001;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    this.scene.add(mainLight);

    // Accent lighting for the teal wall
    const accentLight1 = new THREE.SpotLight(0xffffff, 0.6);
    accentLight1.position.set(-roomWidth / 4, roomHeight - 0.2, -roomDepth / 2 + 1);
    accentLight1.target.position.set(-roomWidth / 4, 0, -roomDepth / 2);
    accentLight1.angle = Math.PI / 6;
    accentLight1.penumbra = 0.8;
    accentLight1.decay = 1.5;
    accentLight1.distance = roomHeight * 2;
    this.scene.add(accentLight1);
    this.scene.add(accentLight1.target);

    const accentLight2 = new THREE.SpotLight(0xffffff, 0.6);
    accentLight2.position.set(roomWidth / 4, roomHeight - 0.2, -roomDepth / 2 + 1);
    accentLight2.target.position.set(roomWidth / 4, 0, -roomDepth / 2);
    accentLight2.angle = Math.PI / 6;
    accentLight2.penumbra = 0.8;
    accentLight2.decay = 1.5;
    accentLight2.distance = roomHeight * 2;
    this.scene.add(accentLight2);
    this.scene.add(accentLight2.target);

    // Warm ambient light for better overall illumination
    const ambientLight = new THREE.AmbientLight(0xfff4e6, 0.4);
    this.scene.add(ambientLight);

    // Add subtle ambient occlusion with warmer undertones
    const aoLight = new THREE.HemisphereLight(0xfff4e6, 0x444444, 0.5);
    this.scene.add(aoLight);

    // Store walls for collision detection
    this.walls = [backWall, frontWall, leftWall, rightWall];
  }

  private onWindowResize(): void {
    if (!(this.renderer.domElement instanceof HTMLCanvasElement)) {
      return;
    }

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(rect.width, rect.height, false);
  }

  getObjectInfo(object: THREE.Object3D): { name: string, description: string } | undefined {
    return this.objects.get(object);
  }

  getRaycaster(): THREE.Raycaster {
    return this.raycaster;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
