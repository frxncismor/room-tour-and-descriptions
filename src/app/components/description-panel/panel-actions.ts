import { inject, InjectionToken } from '@angular/core';
import { ActionId, ActionPieceId } from '../../pieces/piece-ids';
import { SceneService } from '../../services/scene.service';

/** Resultado de ejecutar una acción: si cambió algo y qué anunciar. */
export interface PanelActionResult {
  changed: boolean;
  announcement: string | null;
}

/**
 * Lo que la ficha necesita de la escena. Es un puerto: los tests lo sustituyen
 * y la ficha no conoce three.
 */
export interface PanelActions {
  run(id: ActionPieceId, action: ActionId): PanelActionResult;
  /** Va al tramo `n` (1..m) de la pared encuadrada. */
  focusTramo(tramo: number): void;
  /** Obra que muestra la TV ahora, o `null` si está apagada. */
  workOnScreen(): string | null;
}

/** Superficie de `SceneService` que usa la ficha (la implementa la pista de escena). */
interface SceneActions {
  runAction?(id: ActionPieceId, action: ActionId): PanelActionResult;
  focusSurfaceTramo?(tramo: number): void;
  workOnScreen?(): string | null;
}

export const PANEL_ACTIONS = new InjectionToken<PanelActions>('PANEL_ACTIONS', {
  providedIn: 'root',
  factory: () => {
    const scene = inject(SceneService) as SceneService & SceneActions;
    return {
      run: (id, action) =>
        scene.runAction?.(id, action) ?? { changed: false, announcement: null },
      focusTramo: tramo => scene.focusSurfaceTramo?.(tramo),
      workOnScreen: () => scene.workOnScreen?.() ?? null,
    };
  },
});
