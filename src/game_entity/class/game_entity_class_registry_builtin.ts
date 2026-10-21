import type { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import { GameEntityClassProviderBuiltin } from '@/game_entity/class/game_entity_class_provider_builtin.js';
import { GameEntityClassProviderPreview } from '@/game_entity/class/game_entity_class_provider_preview.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';

/**
 * Returns the class providers the editor ships with, most trusted first.
 *
 * @returns Providers in priority order.
 */
export function gameEntityClassProvidersBuiltin(): readonly GameEntityClassProvider[] {
  return [
    GameEntityClassProviderPreview.shared,
    GameEntityClassProviderScene.shared,
    GameEntityClassProviderBuiltin.shared,
  ];
}
