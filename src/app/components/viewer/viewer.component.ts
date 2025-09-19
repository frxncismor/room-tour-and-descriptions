import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ObjectInfo, UI_TEXT } from '../../interfaces/scene.interface';
import { SceneService } from '../../services/scene.service';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
})
export class ViewerComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  selectedObject: ObjectInfo | null = null;
  hideInstructions = false;
  uiText = UI_TEXT;

  private isDragging = false;
  private dragStartTime = 0;

  private readonly sceneService = inject(SceneService);

  ngOnInit(): void {
    this.validateCanvasReference();
    this.initializeViewer();
  }

  ngOnDestroy(): void {
    this.sceneService.dispose();
  }

  private validateCanvasReference(): void {
    if (!this.canvasRef) {
      console.error('Canvas reference not found');
      throw new Error('Canvas element is required for 3D rendering');
    }
  }

  private async initializeViewer(): Promise<void> {
    try {
      this.sceneService.initialize(this.canvasRef.nativeElement);
      await this.loadModels();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize viewer:', error);
    }
  }

  private setupEventListeners(): void {
    this.setupDragDetection();
    this.setupClickHandler();
  }

  private setupDragDetection(): void {
    this.canvasRef.nativeElement.addEventListener('mousedown', () => {
      this.isDragging = false;
      this.dragStartTime = Date.now();
    });

    this.canvasRef.nativeElement.addEventListener('mousemove', () => {
      if (Date.now() - this.dragStartTime > 100) {
        this.isDragging = true;
      }
    });
  }

  private setupClickHandler(): void {
    this.canvasRef.nativeElement.addEventListener(
      'click',
      (event: MouseEvent) => {
        if (!this.isDragging) {
          this.handleClick(event);
        }
      }
    );
  }

  private async handleClick(event: MouseEvent): Promise<void> {
    try {
      const objectInfo = await this.sceneService.onMouseClick(event);
      this.selectedObject = objectInfo;
    } catch (error) {
      console.error('Error handling click:', error);
    }
  }

  private async loadModels(): Promise<void> {
    try {
      await this.sceneService.loadSofa();
      await this.sceneService.loadPokerTable();
      await this.sceneService.loadBookshelf();
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  onCloseInstructions(): void {
    this.hideInstructions = true;
  }
}
