import { AmbientLight, BackSide, Box3, BoxGeometry, Color, DirectionalLight, Euler, Material, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, SpotLight, Vector2, Vector3, WebGLRenderer, AdditiveBlending } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SceneService {
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private controls!: OrbitControls;
  private raycaster: Raycaster;
  private loader: GLTFLoader;
  private objects: Map<Object3D, { name: string; description: string }>;
  private outlineMaterial: Material;
  private outlineMesh: Mesh | null = null;
  private initialCameraHeight = 1.7; // Store initial camera height
  private isAnimating = false;
  private isOrbitEnabled = true;

  private readonly ROOM_LIMITS = {
    minX: -8,
    maxX: 8,
    minZ: -8,
    maxZ: 8
  };

  constructor() {
    this.raycaster = new Raycaster();
    this.loader = new GLTFLoader();
    this.objects = new Map();
    
    // Create outline material for selected objects with a more elegant style
    this.outlineMaterial = new MeshBasicMaterial({
      color: 0x2c4a52, // Deep teal color matching our UI
      side: BackSide,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false
    });
  }

  public initialize(canvas: HTMLCanvasElement): void {
    // Scene setup
    this.scene = new Scene();
    this.scene.background = new Color(0xf0f0f0);

    // Camera setup with better initial position
    this.camera = new PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, this.initialCameraHeight, 3);

    // Renderer setup
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Controls setup with smoother constraints
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minPolarAngle = 0.1;
    this.controls.target.y = this.initialCameraHeight * 0.8;
    this.controls.rotateSpeed = 0.7;
    this.controls.enablePan = false; // Disable panning

    // Add event listener for control changes
    this.controls.addEventListener('change', () => {
      // Maintain camera height during orbit
      this.camera.position.y = this.initialCameraHeight;
      this.controls.target.y = this.initialCameraHeight * 0.8;
    });

    // Add lights
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Create room and start animation
    this.createRoom();
    this.animate();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private onWindowResize(): void {
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  public onMouseClick(event: MouseEvent): { name: string; description: string } | null {
    if (this.isAnimating) return null; // Prevent clicks during animation

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new Vector2(x, y), this.camera);
    
    // Get all intersected objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Remove previous outline if it exists
    if (this.outlineMesh) {
      this.scene.remove(this.outlineMesh);
      this.outlineMesh = null;
    }

    for (const intersect of intersects) {
      let object = intersect.object;
      
      // Check if we clicked on the floor for teleportation
      if (object.name === 'floor') {
        const targetPosition = intersect.point.clone();
        
        // Más permisivo con los límites pero manteniendo seguridad
        const clampedX = Math.max(this.ROOM_LIMITS.minX + 1.5, Math.min(this.ROOM_LIMITS.maxX - 1.5, targetPosition.x));
        const clampedZ = Math.max(this.ROOM_LIMITS.minZ + 1.5, Math.min(this.ROOM_LIMITS.maxZ - 1.5, targetPosition.z));
        
        // Solo validamos si está muy fuera de los límites
        if (Math.abs(clampedX - targetPosition.x) > 2 || Math.abs(clampedZ - targetPosition.z) > 2) {
          return null; // Prevent teleportation outside bounds
        }

        targetPosition.x = clampedX;
        targetPosition.z = clampedZ;
        targetPosition.y = this.initialCameraHeight;

        this.teleportTo(targetPosition);
        return null;
      }

      // Find the root object (the loaded model)
      while (object.parent && !this.objects.has(object)) {
        object = object.parent;
      }

      if (this.objects.has(object)) {
        // Create outline for selected object
        this.createOutline(object);
        return this.objects.get(object) || null;
      }
    }

    return null;
  }

  private createOutline(object: Object3D): void {
    // Get the bounding box of the object
    const bbox = new Box3().setFromObject(object);
    const size = new Vector3();
    bbox.getSize(size);
    
    // Create slightly larger geometry for outline
    const outlineGeometry = new BoxGeometry(
      size.x * 1.02, // Reduced scale for more subtle effect
      size.y * 1.02,
      size.z * 1.02
    );
    
    // Create outline mesh
    this.outlineMesh = new Mesh(outlineGeometry, this.outlineMaterial);
    
    // Position outline at object's center
    const center = new Vector3();
    bbox.getCenter(center);
    this.outlineMesh.position.copy(center);
    this.outlineMesh.quaternion.copy(object.quaternion);

    // Add subtle animation
    const animate = () => {
      if (this.outlineMesh) {
        this.outlineMaterial.opacity = 0.3 + Math.sin(Date.now() * 0.002) * 0.1;
        requestAnimationFrame(animate);
      }
    };
    animate();
    
    this.scene.add(this.outlineMesh);
  }

  private teleportTo(position: Vector3): void {
    if (this.isAnimating) return;
    
    // Validación final de posición más permisiva
    const clampedX = Math.max(this.ROOM_LIMITS.minX + 1.5, Math.min(this.ROOM_LIMITS.maxX - 1.5, position.x));
    const clampedZ = Math.max(this.ROOM_LIMITS.minZ + 1.5, Math.min(this.ROOM_LIMITS.maxZ - 1.5, position.z));
    
    // Solo cancelamos si está muy fuera de los límites
    if (Math.abs(clampedX - position.x) > 2 || Math.abs(clampedZ - position.z) > 2) {
      return;
    }

    position.x = clampedX;
    position.z = clampedZ;
    position.y = this.initialCameraHeight;

    this.isAnimating = true;
    this.isOrbitEnabled = false;

    const duration = 1200; // Movimiento más suave
    const startPosition = this.camera.position.clone();
    const startTime = Date.now();
    const startRotation = this.camera.quaternion.clone();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = this.easeInOutQuad(progress);

      // Movimiento más suave de la cámara
      const newPosition = startPosition.clone().lerp(position, easeProgress);
      newPosition.y = this.initialCameraHeight;
      this.camera.position.copy(newPosition);

      // Actualizar el target de manera más suave
      const targetPosition = new Vector3(
        newPosition.x,
        this.initialCameraHeight * 0.8,
        newPosition.z - 2 // Mirar siempre un poco hacia adelante
      );
      this.controls.target.lerp(targetPosition, easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.isOrbitEnabled = true;
        this.camera.position.y = this.initialCameraHeight;
        this.controls.target.y = this.initialCameraHeight * 0.8;
      }
    };

    animate();
  }

  // Función de suavizado mejorada
  private easeInOutQuad(t: number): number {
    t *= 2;
    if (t < 1) return 0.5 * t * t;
    t--;
    return -0.5 * (t * (t - 2) - 1);
  }

  public addObject(object: Object3D, name: string, description: string): void {
    this.objects.set(object, { name, description });
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private createRoom(): void {
    // Modern color palette
    const floorColor = 0xe0e0e0; // Light warm gray for polished concrete
    const mainWallColor = 0xf5e6d3; // Warm beige
    const accentWallColor = 0x2c4a52; // Deep teal
    const secondaryWallColor = 0xe6d5c9; // Soft terracotta
    const ceilingColor = 0xfaf4ec; // Warm off-white

    // Room dimensions
    const roomWidth = 16;
    const roomHeight = 4;
    const roomDepth = 16;

    // Create materials with better lighting properties
    const floorMaterial = new MeshPhysicalMaterial({
      color: floorColor,
      roughness: 0.7,
      metalness: 0.2,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4
    });

    const mainWallMaterial = new MeshPhysicalMaterial({
      color: mainWallColor,
      roughness: 0.95,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5
    });

    const accentWallMaterial = new MeshPhysicalMaterial({
      color: accentWallColor,
      roughness: 0.9,
      metalness: 0.15,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3
    });

    const secondaryWallMaterial = new MeshPhysicalMaterial({
      color: secondaryWallColor,
      roughness: 0.95,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5
    });

    const ceilingMaterial = new MeshPhysicalMaterial({
      color: ceilingColor,
      roughness: 0.9,
      metalness: 0.1,
      clearcoat: 0.05,
      clearcoatRoughness: 0.5
    });

    // Create floor
    const floorGeometry = new PlaneGeometry(roomWidth, roomDepth);
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);

    // Create ceiling
    const ceilingGeometry = new PlaneGeometry(roomWidth, roomDepth);
    const ceiling = new Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    ceiling.receiveShadow = true;
    this.scene.add(ceiling);

    // Create walls
    // Back wall (accent wall - deep teal)
    const backWallGeometry = new PlaneGeometry(roomWidth, roomHeight);
    const backWall = new Mesh(backWallGeometry, accentWallMaterial);
    backWall.position.z = -roomDepth / 2;
    backWall.position.y = roomHeight / 2;
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Front wall (main wall - warm beige)
    const frontWallGeometry = new PlaneGeometry(roomWidth, roomHeight);
    const frontWall = new Mesh(frontWallGeometry, mainWallMaterial);
    frontWall.position.z = roomDepth / 2;
    frontWall.position.y = roomHeight / 2;
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Left wall (secondary wall - soft terracotta)
    const leftWallGeometry = new PlaneGeometry(roomDepth, roomHeight);
    const leftWall = new Mesh(leftWallGeometry, secondaryWallMaterial);
    leftWall.position.x = -roomWidth / 2;
    leftWall.position.y = roomHeight / 2;
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // Right wall (main wall - warm beige)
    const rightWallGeometry = new PlaneGeometry(roomDepth, roomHeight);
    const rightWall = new Mesh(rightWallGeometry, mainWallMaterial);
    rightWall.position.x = roomWidth / 2;
    rightWall.position.y = roomHeight / 2;
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // Modern lighting setup
    // Main ceiling light with warmer tone
    const mainLight = new SpotLight(0xfff4e6, 1);
    mainLight.position.set(0, roomHeight - 0.1, 0);
    mainLight.angle = Math.PI / 3;
    mainLight.penumbra = 0.7;
    mainLight.decay = 1.5;
    mainLight.distance = roomHeight * 2;
    mainLight.castShadow = true;
    mainLight.shadow.bias = -0.001;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    this.scene.add(mainLight);

    // Accent lighting for the teal wall
    const accentLight1 = new SpotLight(0xffffff, 0.6);
    accentLight1.position.set(-roomWidth / 4, roomHeight - 0.2, -roomDepth / 2 + 1);
    accentLight1.target.position.set(-roomWidth / 4, 0, -roomDepth / 2);
    accentLight1.angle = Math.PI / 6;
    accentLight1.penumbra = 0.5;
    accentLight1.decay = 1.5;
    accentLight1.distance = roomHeight * 1.5;
    accentLight1.castShadow = true;
    this.scene.add(accentLight1);
    this.scene.add(accentLight1.target);

    const accentLight2 = new SpotLight(0xffffff, 0.6);
    accentLight2.position.set(roomWidth / 4, roomHeight - 0.2, -roomDepth / 2 + 1);
    accentLight2.target.position.set(roomWidth / 4, 0, -roomDepth / 2);
    accentLight2.angle = Math.PI / 6;
    accentLight2.penumbra = 0.5;
    accentLight2.decay = 1.5;
    accentLight2.distance = roomHeight * 1.5;
    accentLight2.castShadow = true;
    this.scene.add(accentLight2);
    this.scene.add(accentLight2.target);

    // Warm ambient light for better overall illumination
    const ambientLight = new AmbientLight(0xfff4e6, 0.4);
    this.scene.add(ambientLight);

    // Add subtle ambient occlusion with warmer undertones
    const aoLight = new AmbientLight(0xfff4e6, 0.4);
    this.scene.add(aoLight);
  }

  getObjectInfo(object: Object3D): { name: string, description: string } | undefined {
    return this.objects.get(object);
  }

  getRaycaster(): Raycaster {
    return this.raycaster;
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): PerspectiveCamera {
    return this.camera;
  }

  public async loadModel(path: string, position: Vector3, scale: number = 1, rotation: Euler = new Euler()): Promise<Object3D> {
    return new Promise((resolve, reject) => {
      const cleanPath = path.replace(/^\/+/, '');
      
      this.loader.load(
        cleanPath,
        (gltf) => {
          const model = gltf.scene;
          
          // Apply transformations
          model.position.copy(position);
          model.rotation.copy(rotation);
          model.scale.setScalar(scale);

          // Center model if needed
          const box = new Box3().setFromObject(model);
          const center = box.getCenter(new Vector3());
          model.position.sub(center).add(position);

          // Apply shadows to all meshes
          model.traverse((child) => {
            if ((child as Mesh).isMesh) {
              const mesh = child as Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Update materials for better rendering
              if (mesh.material) {
                const material = mesh.material as Material;
                material.needsUpdate = true;
              }
            }
          });

          this.scene.add(model);
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

  public dispose(): void {
    // Clean up Three.js resources
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    // Clean up controls
    if (this.controls) {
      this.controls.dispose();
    }

    // Clean up geometries and materials
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize);
  }
}
