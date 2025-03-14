import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneService } from '../../services/scene.service';
import * as THREE from 'three';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('rendererCanvas') rendererCanvas!: ElementRef<HTMLCanvasElement>;
  
  selectedObject: { name: string; description: string } | null = null;
  isLocked = false;
  private keyHandlers: { [key: string]: () => void } = {};

  constructor(private sceneService: SceneService) {
    // Initialize key handlers
    this.keyHandlers = {
      'KeyW': () => this.sceneService.setMoveForward(true),
      'ArrowUp': () => this.sceneService.setMoveForward(true),
      'KeyS': () => this.sceneService.setMoveBackward(true),
      'ArrowDown': () => this.sceneService.setMoveBackward(true),
      'KeyA': () => this.sceneService.setMoveLeft(true),
      'ArrowLeft': () => this.sceneService.setMoveLeft(true),
      'KeyD': () => this.sceneService.setMoveRight(true),
      'ArrowRight': () => this.sceneService.setMoveRight(true)
    };
  }

  ngOnInit() {
    // Add event listeners
    this.setupControls();
  }

  async ngAfterViewInit() {
    try {
      console.log('Canvas element:', this.rendererCanvas?.nativeElement);
      
      // Wait for the canvas to be properly sized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First initialize the scene
      await this.sceneService.initialize(this.rendererCanvas.nativeElement);
      
      // Then load the models
      await this.loadModels();
      
      console.log('Scene initialized successfully');
    } catch (error) {
      console.error('Error initializing scene:', error);
    }
  }

  private setupControls() {
    document.addEventListener('click', (event) => this.onClick(event));
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
    document.addEventListener('keyup', (event) => this.onKeyUp(event));
  }

  onClick(event: MouseEvent) {
    if (!this.isLocked) {
      this.sceneService.lockControls();
      this.isLocked = true;
      return;
    }

    const objectInfo = this.sceneService.onMouseClick(event);
    if (objectInfo) {
      this.selectedObject = objectInfo;
    } else {
      this.selectedObject = null;
    }
  }

  onKeyDown(event: KeyboardEvent) {
    const handler = this.keyHandlers[event.code];
    if (handler) {
      handler();
    }
  }

  onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.sceneService.setMoveForward(false);
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.sceneService.setMoveBackward(false);
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.sceneService.setMoveLeft(false);
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.sceneService.setMoveRight(false);
        break;
      case 'Escape':
        this.isLocked = false;
        break;
    }
  }

  ngOnDestroy() {
    // Remove event listeners
    document.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }

  private async loadModels() {
    try {
      console.log('Starting to load models...');
      
      // Load sofa - positioned at (-3, 0, -3) with 45-degree rotation
      const sofa = await this.sceneService.loadModel(
        'assets/models/sofa/scene.gltf',
        new THREE.Vector3(-3, 0.7, -3),
        1, // Scale to fit the room
        new THREE.Euler(0, Math.PI / 4, 0) // 45 degrees rotation
      );
      this.sceneService.addObject(sofa, 'Sofá Moderno', 'Un sofá moderno y cómodo perfecto para tu sala de estar.');
      console.log('Sofa loaded successfully');

      // Temporarily use poker table as dining table - positioned at (3, 0, -3)
      const table = await this.sceneService.loadModel(
        'assets/models/poker_table/scene.gltf',
        new THREE.Vector3(3, 0.5, -3),
        1, // Scale to fit the room
        new THREE.Euler(0, 0, 0) // No rotation
      );
      this.sceneService.addObject(table, 'Mesa de Comedor', 'Mesa de comedor con sillas, perfecta para reuniones familiares.');
      console.log('Table loaded successfully');

      // Load bookshelf - positioned at (-8, 0, -8)
      const bookshelf = await this.sceneService.loadModel(
        'assets/models/bookshelf/scene.gltf',
        new THREE.Vector3(-8, 1.2, -9.5),
        1, // Scale to fit the room
        new THREE.Euler(0, 0, 0) // No rotation
      );
      this.sceneService.addObject(bookshelf, 'Librería', 'Librería moderna con múltiples compartimentos para tus libros y decoraciones.');
      console.log('Bookshelf loaded successfully');

    } catch (error) {
      console.error('Error loading models:', error);
      throw error;
    }
  }
}
