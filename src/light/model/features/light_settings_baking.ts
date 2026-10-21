import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';
import { lightSettingsChoiceRead } from '@/light/model/features/light_settings_choice.js';

/** Whether the bake adds one bounce of indirect light. */
export const LIGHT_ILLUMINATION_MODES = ['direct', 'single_bounce'] as const;

/** One illumination mode. */
export type LightIlluminationMode = (typeof LIGHT_ILLUMINATION_MODES)[number];

/** Whether baked shadows let light through alpha-tested textures. */
export const LIGHT_TRANSPARENCY_MODES = ['disabled', 'enabled', 'enabled_max'] as const;

/** One transparency mode. */
export type LightTransparencyMode = (typeof LIGHT_TRANSPARENCY_MODES)[number];

/** Storage precision of baked bounce light; default lets the bake choose. */
export const LIGHT_BOUNCE_COMPRESSIONS = ['default', 'bits8', 'bits6', 'bits5', 'bits4'] as const;

/** One bounce storage precision. */
export type LightBounceCompression = (typeof LIGHT_BOUNCE_COMPRESSIONS)[number];

/** How a light takes part in the game's light bake. */
export interface LightSettingsBaking {
  /** Direct light only, or direct light plus one baked bounce. */
  illumination: LightIlluminationMode;
  /** Whether baked shadows pass through alpha-tested surfaces. */
  transparency: LightTransparencyMode;
  /** SRGB tint of the bounce light as a 0xRRGGBB number. */
  bounceColorHex: number;
  /** Blend from the light's own color (0) to the bounce tint (1). */
  bounceColorAlpha: number;
  /** Visibility of the bounce light at runtime, 0 to 1; needs no re-bake. */
  bounceModifier: number;
  /** Strength of the bounce light; needs a re-bake. */
  bounceIntensity: number;
  /** Samples per texel during the bake, at least 2. */
  bounceSamples: number;
  /** Storage precision of the baked bounce light. */
  bounceCompression: LightBounceCompression;
}

/**
 * Returns baking settings for direct light only with the renderer's defaults.
 *
 * @returns Fresh baking settings.
 */
export function lightSettingsBakingCreateDefault(): LightSettingsBaking {
  return {
    illumination: 'direct',
    transparency: 'disabled',
    bounceColorHex: 0xffffff,
    bounceColorAlpha: 0,
    bounceModifier: 1,
    bounceIntensity: 1,
    bounceSamples: 32,
    bounceCompression: 'default',
  };
}

/**
 * Returns baking settings the game accepts.
 *
 * @param settings Possibly invalid baking settings.
 * @returns Valid baking settings.
 */
export function lightSettingsBakingSanitize(settings: LightSettingsBaking): LightSettingsBaking {
  const defaults = lightSettingsBakingCreateDefault();
  return {
    illumination: lightSettingsChoiceRead(settings.illumination, LIGHT_ILLUMINATION_MODES, defaults.illumination),
    transparency: lightSettingsChoiceRead(settings.transparency, LIGHT_TRANSPARENCY_MODES, defaults.transparency),
    bounceColorHex: Math.round(entityNumberClamp(settings.bounceColorHex, 0, 0xffffff, defaults.bounceColorHex)),
    bounceColorAlpha: entityNumberClamp(settings.bounceColorAlpha, 0, 1, defaults.bounceColorAlpha),
    bounceModifier: entityNumberClamp(settings.bounceModifier, 0, 1, defaults.bounceModifier),
    bounceIntensity: entityNumberClamp(settings.bounceIntensity, 0, 1e6, defaults.bounceIntensity),
    bounceSamples: Math.round(entityNumberClamp(settings.bounceSamples, 2, 4096, defaults.bounceSamples)),
    bounceCompression: lightSettingsChoiceRead(
      settings.bounceCompression,
      LIGHT_BOUNCE_COMPRESSIONS,
      defaults.bounceCompression,
    ),
  };
}
