import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';

/** Type path of the bridge's free-form properties component. */
export const GAME_ENTITY_PROPERTIES_TYPE_PATH = 'broom_bridge::placeables::properties::BroomProperties';

/**
 * Returns the class of the bridge's free-form properties component, which every
 * game with the bridge has.
 *
 * @returns Properties class.
 */
export function gameEntityPropertiesClassCreate(): GameEntityClass {
  return {
    type_path: GAME_ENTITY_PROPERTIES_TYPE_PATH,
    label: 'Properties',
    category: 'Data',
    placement: 'any',
    marker_color: [0.35, 0.65, 0.95],
    fields: [{ path: 'values', label: 'values', kind: 'property_map', default: {} }],
  };
}

/** Classes the editor knows without any game: the properties component. */
export class GameEntityClassProviderBuiltin extends GameEntityClassProvider {
  /** The provider of the always known classes. */
  static readonly shared = new GameEntityClassProviderBuiltin();

  /** Creates the provider with the properties class. */
  constructor() {
    super('builtin');
    this.listWrite({
      generation: 0,
      asset_generation: 0,
      classes: [gameEntityPropertiesClassCreate()],
      asset_types: [],
    });
  }
}
