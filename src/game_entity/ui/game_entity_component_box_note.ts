import type { GameEntityClass, GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';

/** Decimal places shown for box sizes. */
const GAME_ENTITY_BOX_NOTE_DECIMALS = 3;

/**
 * Writes the read-only line that tells which box a component class gives the
 * selected objects: its size in meters and the field that picks it.
 */
export class GameEntityComponentBoxNote {
  /**
   * Returns the box line of a class for the selected objects.
   *
   * @param gameClass Component class, or null when the game does not report it.
   * @param componentsList Overrides of every selected object.
   * @returns Line text, or null when the class declares no box.
   */
  static textOf(gameClass: GameEntityClass | null, componentsList: readonly GameEntityComponents[]): string | null {
    if (gameClass === null || !GameEntityComponentBoxNote.classDeclaresBox(gameClass)) {
      return null;
    }
    const boxKeys = new Set(
      componentsList.map((components) => {
        const markerBox = GameEntityVisualMarkerBox.classBoxOf(gameClass, components);
        return markerBox === null ? 'none' : GameEntityComponentBoxNote.sizeText(markerBox);
      }),
    );
    const sizeText = boxKeys.size === 1 ? [...boxKeys][0] : 'differs per object';
    return `Box: ${sizeText === 'none' ? 'none for this value' : sizeText}${GameEntityComponentBoxNote.sourceText(gameClass)}`;
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
    const edges = markerBox.size.map((edge) => String(Number(edge.toFixed(GAME_ENTITY_BOX_NOTE_DECIMALS))));
    return `${edges.join(' × ')} m (W × H × D)`;
  }

  /**
   * Returns the note naming the field that picks the box.
   *
   * @param gameClass Component class.
   * @returns Text beginning with a comma, or empty when no field picks it.
   */
  private static sourceText(gameClass: GameEntityClass): string {
    const fieldPath = gameClass.marker_box_field;
    const field = fieldPath === undefined ? null : GameEntityComponentResolver.fieldFind(gameClass, fieldPath);
    return field === null ? '' : `, set by ${field.label}`;
  }
}
