import { TestBed } from '@angular/core/testing';
import { initialPieceState, ViewerStateService } from './viewer-state.service';

describe('ViewerStateService', () => {
  let state: ViewerStateService;

  beforeEach(() => {
    state = TestBed.inject(ViewerStateService);
  });

  it('starts idle with no error or selection', () => {
    expect(state.loadStatus()).toBe('idle');
    expect(state.loadProgress()).toBe(0);
    expect(state.error()).toBeNull();
    expect(state.selected()).toBeNull();
    expect(state.selectedKind()).toBeNull();
    expect(state.hovered()).toBeNull();
    expect(state.sceneReady()).toBe(false);
  });

  it('starts with only the floor lamp switched on', () => {
    const pieces = state.pieceState();
    expect(Object.keys(pieces).sort()).toEqual([
      'deskLamp',
      'floorLamp',
      'monitor',
      'readingLamp',
      'turntable',
      'tv',
    ]);
    for (const [id, piece] of Object.entries(pieces)) {
      expect(piece.power).toBe(id === 'floorLamp');
      expect(piece.index).toBe(0);
      expect(piece.spin).toBe(false);
      expect(piece.sound).toBe(false);
    }
  });

  it('patchPiece() changes one piece and leaves the rest', () => {
    const before = state.pieceState();
    state.patchPiece('tv', { power: true, index: 3 });
    const after = state.pieceState();
    expect(after.tv).toEqual({
      power: true,
      index: 3,
      spin: false,
      sound: false,
    });
    expect(after.floorLamp).toBe(before.floorLamp);
    expect(before.tv.power).toBe(false);
  });

  it('initialPieceState() returns a fresh object each time', () => {
    expect(initialPieceState()).not.toBe(initialPieceState());
  });

  it('reset() restores the initial state', () => {
    state.loadStatus.set('error');
    state.loadProgress.set(80);
    state.error.set({ code: 'x' });
    state.selected.set({ id: 'sofa', kind: 'furniture' });
    state.selectedKind.set('furniture');
    state.patchPiece('tv', { power: true, index: 5 });
    state.patchPiece('floorLamp', { power: false });
    state.hovered.set('sofa');
    state.sceneReady.set(true);

    state.reset();

    expect(state.loadStatus()).toBe('idle');
    expect(state.loadProgress()).toBe(0);
    expect(state.error()).toBeNull();
    expect(state.selected()).toBeNull();
    expect(state.selectedKind()).toBeNull();
    expect(state.pieceState()).toEqual(initialPieceState());
    expect(state.hovered()).toBeNull();
    expect(state.sceneReady()).toBe(false);
  });

  it('selected accepts pieces and surfaces, and reset clears the wall tramo', () => {
    const state = TestBed.inject(ViewerStateService);
    state.selected.set({ id: 'tv', kind: 'piece' });
    state.selected.set({ id: 'wallGreen', kind: 'surface' });
    state.surfaceTramo.set({ tramo: 2, count: 3 });
    state.reset();
    expect(state.selected()).toBeNull();
    expect(state.surfaceTramo()).toBeNull();
  });
});
