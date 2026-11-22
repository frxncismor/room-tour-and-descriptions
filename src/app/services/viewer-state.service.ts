import { Injectable, signal } from '@angular/core';
import { ObjectInfo } from '../interfaces/scene.interface';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ViewerError {
  code: string;
  message: string;
  retry?: () => void;
}

/**
 * Estado compartido del visor (solo señales, sin lógica).
 * Lo escribe SceneService y lo leen los componentes.
 */
@Injectable({ providedIn: 'root' })
export class ViewerStateService {
  /** Progreso de carga agregado, 0–100. */
  readonly loadProgress = signal(0);
  readonly loadStatus = signal<LoadStatus>('idle');
  readonly error = signal<ViewerError | null>(null);
  readonly selected = signal<ObjectInfo | null>(null);
  /** Id del objeto bajo el cursor, o null. */
  readonly hovered = signal<string | null>(null);
  readonly sceneReady = signal(false);
}
