import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
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
export class ViewerComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  
  selectedObject: { name: string; description: string } | null = null;
  hideInstructions = false;

  constructor(private sceneService: SceneService) {}

  ngOnInit(): void {
    if (!this.canvasRef) {
      console.error('Canvas reference not found');
      return;
    }
    this.initializeViewer();
  }

  ngOnDestroy(): void {
    // Clean up Three.js resources
    this.sceneService.dispose();
  }

  private async initializeViewer(): Promise<void> {
    // Initialize scene with canvas element
    this.sceneService.initialize(this.canvasRef.nativeElement);
    
    // Load models with descriptions
    await this.loadModels();

    // Track drag state
    let isDragging = false;
    let dragStartTime = 0;

    this.canvasRef.nativeElement.addEventListener('mousedown', () => {
      isDragging = false;
      dragStartTime = Date.now();
    });

    this.canvasRef.nativeElement.addEventListener('mousemove', () => {
      if (Date.now() - dragStartTime > 100) {
        isDragging = true;
      }
    });

    // Add click event listener with drag check
    this.canvasRef.nativeElement.addEventListener('click', (event: MouseEvent) => {
      if (!isDragging) {
        this.handleClick(event);
      }
    });
  }

  private handleClick = (event: MouseEvent) => {
    const objectInfo = this.sceneService.onMouseClick(event);
    if (objectInfo) {
      this.selectedObject = objectInfo;
    }
  };

  private async loadModels(): Promise<void> {
    try {
      // Load sofa with 45-degree rotation
      const sofaRotation = new THREE.Euler(0, Math.PI / 4, 0); // 45 degrees in radians
      const sofa = await this.sceneService.loadModel(
        'assets/models/sofa/scene.gltf',
        new THREE.Vector3(-3, 0.7, -3),
        1,
        sofaRotation
      );
      this.sceneService.addObject(sofa, 'Sofá Moderno', 'Un elegante sofá de diseño contemporáneo perfecto para tu sala de estar.');

      // Load poker table
      const diningTable = await this.sceneService.loadModel(
        'assets/models/poker_table/scene.gltf',
        new THREE.Vector3(3, 0.5, -3),
        1
      );
      this.sceneService.addObject(diningTable, 'Mesa de Poker', 'Mesa de poker profesional para tus juegos con amigos.');

      // Load bookshelf - ajustado posición para mejor visibilidad
      const bookshelf = await this.sceneService.loadModel(
        'assets/models/bookshelf/scene.gltf',
        new THREE.Vector3(0, 1.2, -7.5),
        1
      );
      this.sceneService.addObject(bookshelf, 'Librero', 'Librero moderno y espacioso para organizar tus libros y decoración.');

    } catch (error) {
      console.error('Error loading models:', error);
    }
  }
}
