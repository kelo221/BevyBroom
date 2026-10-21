import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';
import { lightSettingsChoiceRead } from '@/light/model/features/light_settings_choice.js';

/** Patterns of flickering blocks a light projects onto lit surfaces. */
export const LIGHT_SHIMMER_KINDS = ['none', 'water', 'random'] as const;

/** One shimmer pattern. */
export type LightShimmerKind = (typeof LIGHT_SHIMMER_KINDS)[number];

/** Shimmer pattern of a light, such as caustics from water. */
export interface LightSettingsShimmer {
  /** Pattern projected onto lit surfaces; none projects nothing. */
  shimmer: LightShimmerKind;
  /** Scale of the blocks; larger values give smaller blocks. */
  shimmerScale: number;
  /** How dim a block can become: 0 is fully off and 1 does nothing. */
  shimmerModifier: number;
}

/**
 * Returns shimmer settings without a pattern.
 *
 * @returns Fresh shimmer settings.
 */
export function lightSettingsShimmerCreateDefault(): LightSettingsShimmer {
  return { shimmer: 'none', shimmerScale: 12.25, shimmerModifier: 0.8 };
}

/**
 * Returns shimmer settings the game accepts.
 *
 * @param settings Possibly invalid shimmer settings.
 * @returns Valid shimmer settings.
 */
export function lightSettingsShimmerSanitize(settings: LightSettingsShimmer): LightSettingsShimmer {
  const defaults = lightSettingsShimmerCreateDefault();
  return {
    shimmer: lightSettingsChoiceRead(settings.shimmer, LIGHT_SHIMMER_KINDS, defaults.shimmer),
    shimmerScale: entityNumberClamp(settings.shimmerScale, 0.01, 1e4, defaults.shimmerScale),
    shimmerModifier: entityNumberClamp(settings.shimmerModifier, 0, 1, defaults.shimmerModifier),
  };
}
