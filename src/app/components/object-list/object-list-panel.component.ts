import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { collator } from '../../i18n/format';
import { LocaleService } from '../../i18n/locale.service';
import {
  FURNITURE_IDS,
  FurnitureId,
  GROUP_IDS,
  GroupId,
} from '../../i18n/messages';
import type { PieceConfig } from '../../pieces/pieces.config';
import { SceneService } from '../../services/scene.service';
import { ViewerStateService } from '../../services/viewer-state.service';
import {
  ObjectListComponent,
  ObjectListGroup,
  ObjectListItem,
} from './object-list.component';

/** Pared o techo que encuadra la fila «Ver pared» de cada grupo (el suelo no tiene). */
const GROUP_SURFACE: Partial<Record<GroupId, string>> = {
  greenWall: 'wallGreen',
  windowWall: 'wallWindow',
  tvWall: 'wallTv',
  deskWall: 'wallDesk',
  ceiling: 'ceiling',
};

/**
 * Lista de piezas del visor: arma los grupos con lo que ofrece la escena, los
 * textos del idioma activo y el estado de las piezas. Vive junto a la lista en
 * un chunk perezoso (`@defer` del visor), así el inicial no la paga.
 */
@Component({
  selector: 'app-object-list-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ObjectListComponent],
  template: `
    <app-object-list
      [groups]="groups()"
      [selectedId]="state.selected()?.id ?? null"
      (selectItem)="selectItem.emit($event)"
      (viewSurface)="viewSurface.emit($event)"
      (resetView)="resetView.emit()"
    />
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class ObjectListPanelComponent {
  readonly selectItem = output<string>();
  readonly viewSurface = output<string>();
  readonly resetView = output<void>();

  protected readonly state = inject(ViewerStateService);
  private readonly sceneService = inject(SceneService);
  private readonly i18n = inject(LocaleService);

  /** Orden y pertenencia a grupos viven en el chunk de piezas: se piden con sus textos. */
  private readonly pieceConfigs = signal<Readonly<
    Record<string, PieceConfig>
  > | null>(null);

  protected readonly groups = computed<ObjectListGroup[]>(() => {
    // El listado del servicio no es una señal: se recalcula con el estado.
    this.state.sceneReady();
    this.state.loadStatus();
    const messages = this.i18n.messages();
    const pieceTexts = this.i18n.pieceMessages();
    const configs = this.pieceConfigs();
    const pieceState = this.state.pieceState();
    const compare = collator(this.i18n.locale()).compare;

    const byGroup = new Map<string, (ObjectListItem & { order: number })[]>();
    for (const { id } of this.sceneService.getObjectList()) {
      const config = configs?.[id];
      const group =
        config?.group ??
        (FURNITURE_IDS.includes(id as FurnitureId) ? 'greenWall' : null);
      const name =
        pieceTexts?.pieces[id as keyof typeof pieceTexts.pieces]?.name ??
        messages.furniture[id as FurnitureId]?.name;
      if (!group || !name) continue;
      // Solo las piezas con acciones tienen estado (el tocadiscos gira, el resto se enciende).
      const actions = pieceState[id as keyof typeof pieceState];
      const on = id === 'turntable' ? actions?.spin : actions?.power;
      const entry = { id, name, on: !!on, order: config?.order ?? 0 };
      byGroup.set(group, [...(byGroup.get(group) ?? []), entry]);
    }

    const withSurfaces = pieceTexts !== null;
    return GROUP_IDS.filter(id => withSurfaces || byGroup.has(id)).map(id => ({
      id,
      name: messages.list.groups[id],
      surfaceId: withSurfaces ? GROUP_SURFACE[id] : undefined,
      items: (byGroup.get(id) ?? [])
        .sort((a, b) => a.order - b.order || compare(a.name, b.name))
        .map(({ id: itemId, name, on }) => ({ id: itemId, name, on })),
    }));
  });

  constructor() {
    effect(() => {
      if (this.i18n.pieceMessages() === null || this.pieceConfigs() !== null) {
        return;
      }
      void import('../../pieces/pieces.config').then(module =>
        this.pieceConfigs.set(module.PIECES_BY_ID)
      );
    });
  }
}
