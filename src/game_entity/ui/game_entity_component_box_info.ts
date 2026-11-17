import type { GameEntityClass, GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';

/** Decimal places shown for box sizes. */
const GAME_ENTITY_BOX_INFO_DECIMALS = 3;

/** Read-only inspector row content describing a component's marker box. */
export interface GameEntityComponentBoxInfoRow {
  readonly label: string;
  readonly valueText: string;
  readonly helpText: string;
}

/**
 * Describes which box a component class gives the selected objects: its size in
 * meters and the field that picks it.
 */
export class GameEntityComponentBoxInfo {
  /**
   * Returns the box row of a class for the selected objects.
   *
   * @param gameClass Component class, or null when the game does not report it.
   * @param componentsList Overrides of every selected object.
   * @returns Row content, or null when the class declares no box.
   */
  static rowOf(
    gameClass: GameEntityClass | null,
    componentsList: readonly GameEntityComponents[],
  ): GameEntityComponentBoxInfoRow | null {
    if (gameClass === null || !GameEntityComponentBoxInfo.classDeclaresBox(gameClass)) {
      return null;
    }
    return {
      label: 'Box',
      valueText: GameEntityComponentBoxInfo.valueTextOf(gameClass, componentsList),
      helpText: `Width × height × depth in meters of the box the game gives this object${GameEntityComponentBoxInfo.sourceText(gameClass)}.`,
    };
  }

  /**
   * Returns the shared box size of the selected objects.
   *
   * @param gameClass Component class declaring boxes.
   * @param componentsList Overrides of every selected object.
   * @returns Size text, or a word saying the sizes differ or are missing.
   */
  private static valueTextOf(gameClass: GameEntityClass, componentsList: readonly GameEntityComponents[]): string {
    const sizeTexts = new Set(
      componentsList.map((components) => {
        const markerBox = GameEntityVisualMarkerBox.classBoxOf(gameClass, components);
        return markerBox === null ? 'none for this value' : GameEntityComponentBoxInfo.sizeText(markerBox);
      }),
    );
    return sizeTexts.size === 1 ? [...sizeTexts].join('') : 'differs per object';
  }

  /**
   * Returns whether a class declares any marker box.
   *
   * @param gameClass Component class.
   * @returns True when it has a plain box or boxes picked by a field.
   */
  private static classDeclaresBox(gameClass: GameEntityClass): boolean {
    return gameClass.marker_box !== undefined || Object.keys(gameClass.marker_boxes ?? {}).length > 0;
  }

  /**
   * Returns the size of a box as width × height × depth in meters.
   *
   * @param markerBox Marker box.
   * @returns Size text.
   */
  private static sizeText(markerBox: GameEntityMarkerBox): string {
    const edges = markerBox.size.map((edge) => String(Number(edge.toFixed(GAME_ENTITY_BOX_INFO_DECIMALS))));
    return `${edges.join(' × ')} m`;
  }

  /**
   * Returns the clause naming the field that picks the box.
   *
   * @param gameClass Component class.
   * @returns Text beginning with a comma, or empty when no field picks it.
   */
  private static sourceText(gameClass: GameEntityClass): string {
    const fieldPath = gameClass.marker_box_field;
    const field = fieldPath === undefined ? null : GameEntityComponentResolver.fieldFind(gameClass, fieldPath);
    return field === null ? '' : `, picked by its ${field.label}`;
  }
}
