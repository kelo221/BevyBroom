import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { SprinkleGridLayout } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import type { SprinkleConfig, SprinklePlacementMode } from '@/tools/sprinkle/sprinkle_types.js';
import { sprinkleRadiusClamp } from '@/tools/sprinkle/radius/sprinkle_radius_scale.js';
import type { SprinkleStrokeSettings } from './sprinkle_stroke_types.js';

/**
 * Builds the settings of a stroke from the Sprinkle configuration.
 *
 * @param config Sprinkle configuration.
 * @param definition Definition the stroke places.
 * @param mode Mode of the stroke, which Ctrl may have changed.
 * @param seed Seed of the stroke's random stream.
 * @returns Stroke settings with the radius clamped and the density kept between
 *   0 and 100.
 */
export function sprinkleStrokeSettingsFromConfig(
  config: SprinkleConfig,
  definition: SprinkleDefinition,
  mode: SprinklePlacementMode,
  seed: number,
): SprinkleStrokeSettings {
  return {
    definition,
    mode,
    radius: sprinkleRadiusClamp(config.radius),
    densityPercent: Math.min(100, Math.max(0, Number.isFinite(config.densityPercent) ? config.densityPercent : 0)),
    grid: SprinkleGridLayout.fromConfig(config, definition),
    randomYaw: config.randomYaw,
    alignToNormal: config.alignToNormal,
    seed,
  };
}
