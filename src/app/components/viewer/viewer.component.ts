import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import type { SurfaceId } from '../../pieces/piece-ids';
import { SceneService } from '../../services/scene.service';
import { ViewerStateService } from '../../services/viewer-state.service';
import { BrandLabelComponent } from '../brand-label/brand-label.component';
import { DescriptionPanelComponent } from '../description-panel/description-panel.component';
import { ErrorBannerComponent } from '../error-banner/error-banner.component';
import { ErrorOverlayComponent } from '../error-overlay/error-overlay.component';
import { HelpPanelComponent } from '../help-panel/help-panel.component';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { LoadingScreenComponent } from '../loading-screen/loading-screen.component';
import { ObjectListPanelComponent } from '../object-list/object-list-panel.component';

/** Distancia (px) a partir de la cual un gesto es arrastre y no clic (C10). */
const DRAG_THRESHOLD_PX = 5;

const BLOCKING_ERRORS = ['webgl-unavailable', 'webgl-context-lost'];

@Component({
  selector: 'app-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrandLabelComponent,
    DescriptionPanelComponent,
    ErrorBannerComponent,
    ErrorOverlayComponent,
    HelpPanelComponent,
    LanguageSwitcherComponent,
    LoadingScreenComponent,
    ObjectListPanelComponent,
  ],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(document:keydown)': 'onDocumentKey($event)',
  },
})
export class ViewerComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly sceneService = inject(SceneService);
  protected readonly state = inject(ViewerStateService);
  private readonly i18n = inject(LocaleService);
  protected readonly canvasLabel = computed(
    () => this.i18n.messages().canvasLabel
  );

  protected readonly dragging = signal(false);
  /** Primer gesto de navegación: la ayuda se da por vista (H3). */
  protected readonly interacted = signal(false);

  protected readonly cursor = computed(() => {
    if (this.dragging()) return 'grabbing';
    return this.state.hovered() ? 'pointer' : 'grab';
  });

  protected readonly panelInfo = computed(() => this.state.selected());

  protected readonly blockingError = computed(() => {
    const error = this.state.error();
    return error && BLOCKING_ERRORS.includes(error.code) ? error : null;
  });

  protected readonly bannerError = computed(() => {
    const error = this.state.error();
    return error && !BLOCKING_ERRORS.includes(error.code) ? error : null;
  });

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private startPoint = { x: 0, y: 0 };
  private moved = false;
  private multiTouch = false;

  ngAfterViewInit(): void {
    this.sceneService.initialize(this.canvasRef().nativeElement);
    if (this.state.loadStatus() !== 'error') {
      void this.sceneService.loadAll();
    }
  }

  ngOnDestroy(): void {
    this.sceneService.dispose();
  }

  // ── Puntero ────────────────────────────────────────────────────────

  protected onPointerDown(event: PointerEvent): void {
    this.capturePointer(event, true);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.startPoint = { x: event.clientX, y: event.clientY };
      this.moved = false;
      this.multiTouch = false;
    } else {
      this.multiTouch = true;
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.pointers.has(event.pointerId)) {
      if (
        !this.moved &&
        Math.hypot(
          event.clientX - this.startPoint.x,
          event.clientY - this.startPoint.y
        ) >= DRAG_THRESHOLD_PX
      ) {
        this.moved = true;
        this.interacted.set(true);
        this.dragging.set(true);
      }
      return;
    }
    if (event.pointerType === 'mouse') {
      this.sceneService.handlePointerMove({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    this.capturePointer(event, false);
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    const isClick =
      !this.moved &&
      !this.multiTouch &&
      event.button === 0 &&
      this.pointers.size === 0;
    if (this.pointers.size === 0) {
      this.moved = false;
      this.multiTouch = false;
      this.dragging.set(false);
    }
    if (isClick) {
      void this.sceneService.handlePointerSelect({
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
    }
  }

  protected onPointerCancel(event: PointerEvent): void {
    this.capturePointer(event, false);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) {
      this.moved = false;
      this.multiTouch = false;
      this.dragging.set(false);
    }
  }

  /** Captura/libera el puntero; un `pointerId` inválido (p. ej. ya liberado) no debe romper la interacción. */
  private capturePointer(event: PointerEvent, capture: boolean): void {
    const target = event.currentTarget as Element | null;
    try {
      if (capture) target?.setPointerCapture?.(event.pointerId);
      else target?.releasePointerCapture?.(event.pointerId);
    } catch {
      // NotFoundError: el puntero ya no existe; se ignora.
    }
  }

  protected onPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && this.pointers.size === 0) {
      this.sceneService.handlePointerMove(null);
    }
  }

  // ── Teclado y acciones ─────────────────────────────────────────────

  protected onEscape(): void {
    if (this.state.selected()) this.closePanel();
  }

  protected onCanvasKey(event: KeyboardEvent): void {
    if (event.key !== 'Tab' && event.key !== 'Shift') this.interacted.set(true);
  }

  /**
   * Av Pág / Re Pág recorren los tramos de una pared encuadrada con el foco
   * donde esté (tras «Ver pared» sigue en la lista). Solo se intercepta si
   * hay varios tramos y el foco no está en un campo de texto: sin tramos
   * que recorrer, la lista se desplaza con normalidad.
   */
  protected onDocumentKey(event: KeyboardEvent): void {
    if (event.key !== 'PageDown' && event.key !== 'PageUp') return;
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (this.state.selectedKind() !== 'surface') return;
    if ((this.state.surfaceTramo()?.count ?? 0) < 2) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, [contenteditable]')
    ) {
      return;
    }
    event.preventDefault();
    this.interacted.set(true);
    this.sceneService.stepSurfaceSection(event.key === 'PageDown' ? 1 : -1);
  }

  protected onHome(event: Event): void {
    event.preventDefault();
    this.sceneService.clearSelection();
    this.sceneService.resetView();
  }

  protected closePanel(): void {
    this.sceneService.clearSelection();
    this.focusCanvas();
  }

  protected selectObject(id: string): void {
    this.interacted.set(true);
    this.sceneService.selectObject(id);
  }

  protected viewSurface(id: SurfaceId): void {
    this.interacted.set(true);
    this.sceneService.viewSurface(id);
  }

  protected resetView(): void {
    this.interacted.set(true);
    this.sceneService.clearSelection();
    this.sceneService.resetView();
  }

  protected retry(): void {
    const retry = this.state.error()?.retry;
    if (retry) retry();
    else void this.sceneService.retryLoad();
  }

  private focusCanvas(): void {
    this.canvasRef().nativeElement.focus({ preventScroll: true });
  }
}
