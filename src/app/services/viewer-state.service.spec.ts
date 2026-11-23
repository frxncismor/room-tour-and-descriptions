import { TestBed } from '@angular/core/testing';
import { ViewerStateService } from './viewer-state.service';

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
    expect(state.hovered()).toBeNull();
    expect(state.sceneReady()).toBe(false);
  });

  it('reset() restores the initial state', () => {
    state.loadStatus.set('error');
    state.loadProgress.set(80);
    state.error.set({ code: 'x' });
    state.selected.set({ id: 'sofa' });
    state.hovered.set('sofa');
    state.sceneReady.set(true);

    state.reset();

    expect(state.loadStatus()).toBe('idle');
    expect(state.loadProgress()).toBe(0);
    expect(state.error()).toBeNull();
    expect(state.selected()).toBeNull();
    expect(state.hovered()).toBeNull();
    expect(state.sceneReady()).toBe(false);
  });
});
