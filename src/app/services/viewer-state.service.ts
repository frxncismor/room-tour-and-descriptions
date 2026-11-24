import { Injectable, signal } from '@angular/core';
import { ObjectKind, SelectedInfo } from '../interfaces/scene.interface';
import { ActionPieceId, PIECE_IDS_WITH_ACTIONS } from '../pieces/piece-ids';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ViewerError {
  code: string;
  /** Ids de los activos afectados (muebles o `AssetLabelId`), no etiquetas. */
  params?: { names?: string[] };
  retry?: () => void;
}

/**
 * Estado de sesión de una pieza interactiva (spec B.1); no se guarda.
 * `power`: encendida (TV, monitor, lámparas). `index`: lámina de la TV (0..7).
 * `spin`: disco puesto y plato girando. `sound`: sonido activado.
 */
export interface PieceRuntimeState {
  power: boolean;
  index: number;
  spin: boolean;
  sound: boolean;
}

/** Estado de todas las piezas con acciones. */
export type PieceStateMap = Record<ActionPieceId, PieceRuntimeState>;

/** Estado inicial (B.1): todo apagado salvo la lámpara de pie. Objeto nuevo en cada llamada. */
export function initialPieceState(): PieceStateMap {
  const state = {} as PieceStateMap;
  for (const id of Object.keys(PIECE_IDS_WITH_ACTIONS) as ActionPieceId[]) {
    state[id] = {
      power: id === 'floorLamp',
      index: 0,
      spin: false,
      sound: false,
    };
  }
  return state;
}

/**
 * Estado compartido del visor (solo señales).
 * Lo escribe SceneService (solo en eventos discretos, nunca dentro del frame)
 * y lo leen los componentes.
 */
@Injectable({ providedIn: 'root' })
export class ViewerStateService {
  /** Progreso de carga agregado, 0–100. */
  readonly loadProgress = signal(0);
  readonly loadStatus = signal<LoadStatus>('idle');
  readonly error = signal<ViewerError | null>(null);
  readonly selected = signal<SelectedInfo | null>(null);
  /** Tipo de lo seleccionado (mueble, pieza o superficie), o null. */
  readonly selectedKind = signal<ObjectKind | null>(null);
  /** Pared encuadrada: tramo actual y nº de tramos (null si no hay pared seleccionada). */
  readonly surfaceTramo = signal<{ tramo: number; count: number } | null>(null);
  /**
   * Estado de las piezas con acciones. Lo escribe el runtime de acciones solo
   * en eventos discretos (clic, temporizador de la TV): sin `effect` ni
   * trabajo por frame (la app es zoneless).
   */
  readonly pieceState = signal<PieceStateMap>(initialPieceState());
  /** Id del objeto bajo el cursor, o null. */
  readonly hovered = signal<string | null>(null);
  readonly sceneReady = signal(false);

  /** Cambia parte del estado de una pieza (inmutable: la señal emite una vez). */
  patchPiece(id: ActionPieceId, patch: Partial<PieceRuntimeState>): void {
    this.pieceState.update(state => ({
      ...state,
      [id]: { ...state[id], ...patch },
    }));
  }

  /** Vuelve al estado inicial (p. ej. en `dispose`). */
  reset(): void {
    this.loadProgress.set(0);
    this.loadStatus.set('idle');
    this.error.set(null);
    this.selected.set(null);
    this.selectedKind.set(null);
    this.surfaceTramo.set(null);
    this.pieceState.set(initialPieceState());
    this.hovered.set(null);
    this.sceneReady.set(false);
  }
}
