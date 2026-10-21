import type * as THREE from 'three';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import { GAME_ENTITY_ICON_NAME, GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/**
 * Settings of a game entity. A game entity is an empty point; everything the
 * game reads lives in its game components, so it has no settings of its own.
 */
export type GameEntitySettings = Record<string, never>;

/** Rules of game entities: empty points that carry game components. */
export class GameEntityDefinition extends EntityDefinition<GameEntitySettings> {
  readonly kind: EntityKind = 'game_entity';

  /**
   * Returns the empty settings of a new game entity.
   *
   * @returns Fresh settings object.
   */
  settingsCreateDefault(): GameEntitySettings {
    return {};
  }

  /**
   * Returns the empty settings every game entity has.
   *
   * @param _settings Ignored settings.
   * @returns Fresh settings object.
   */
  settingsSanitize(_settings: GameEntitySettings): GameEntitySettings {
    return {};
  }

  /**
   * Reads untrusted data into game entity settings.
   *
   * @param value Any value.
   * @returns Empty settings, or null when the value is not an object.
   */
  settingsFromUnknown(value: unknown): GameEntitySettings | null {
    return typeof value === 'object' && value !== null ? {} : null;
  }

  /**
   * Returns the puzzle piece icon every game entity uses.
   *
   * @param _settings Game entity settings.
   * @returns Icon name.
   */
  iconName(_settings: GameEntitySettings): IconName {
    return GAME_ENTITY_ICON_NAME;
  }

  /**
   * Returns the marker color of the entity's first known component class.
   *
   * @param owner Game entity owner group.
   * @param _settings Game entity settings.
   * @returns Icon color as a hex number.
   */
  override iconColorHex(owner: THREE.Object3D, _settings: GameEntitySettings): number {
    return GameEntityVisualBuilder.colorOf(owner);
  }

  /**
   * Builds the marker of a game entity owner.
   *
   * @param owner Game entity owner group.
   * @param _settings Valid settings.
   */
  visualsRefresh(owner: THREE.Object3D, _settings: GameEntitySettings): void {
    GameEntityVisualBuilder.refresh(owner);
  }
}
