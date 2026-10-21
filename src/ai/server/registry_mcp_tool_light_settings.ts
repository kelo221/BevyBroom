import {
  LIGHT_BOUNCE_COMPRESSIONS,
  LIGHT_ILLUMINATION_MODES,
  LIGHT_TRANSPARENCY_MODES,
} from '@/light/model/features/light_settings_baking.js';
import { LIGHT_COOKIE_MAX_OUTER_DEGREES } from '@/light/model/features/light_settings_cookie.js';
import { LIGHT_EFFECT_KINDS } from '@/light/model/features/light_settings_effect.js';
import { LIGHT_FOG_SHAPES } from '@/light/model/features/light_settings_fog.js';
import { LIGHT_SHIMMER_KINDS } from '@/light/model/features/light_settings_shimmer.js';

/**
 * Formats a list of string choices the way tool descriptions show them.
 *
 * @param choices Allowed values.
 * @returns The values quoted and separated by bars.
 */
function mcpLightSettingsChoicesFormat(choices: readonly string[]): string {
  return choices.map((choice) => `"${choice}"`).join(' | ');
}

/**
 * Builds the description of every light setting an MCP client may send, with
 * the allowed values of each choice taken from the light settings model.
 *
 * @returns Description of the light settings object.
 */
function mcpLightSettingsDescriptionBuild(): string {
  return [
    'Light settings: kind ("point" | "spot"), colorHex (0xRRGGBB number), intensity, radius (m), falloff, innerCutoffDegrees, outerCutoffDegrees, realtime (bool), shadows ("raytraced" | "realtime"), enabled (bool).',
    `Effect: effectKind (${mcpLightSettingsChoicesFormat(LIGHT_EFFECT_KINDS)}), effectPulseSpeed, effectPulseModifier (0-1 minimum brightness), effectPulseOffset, effectTimestep (s).`,
    `Cookie (spot only, outer cutoff ${LIGHT_COOKIE_MAX_OUTER_DEGREES} degrees or less): cookieTexture (image path inside the game's assets folder, "" for none).`,
    `Fog: fogEnabled (bool), fogShape (${mcpLightSettingsChoicesFormat(LIGHT_FOG_SHAPES)}), fogRadius (m; set_light_settings scales it with a new radius sent without it), fogThickness (>= 1), fogIntensity (0-1), fogVisibility (m).`,
    `Shimmer: shimmer (${mcpLightSettingsChoicesFormat(LIGHT_SHIMMER_KINDS)}), shimmerScale, shimmerModifier.`,
    `Baking: illumination (${mcpLightSettingsChoicesFormat(LIGHT_ILLUMINATION_MODES)}), transparency (${mcpLightSettingsChoicesFormat(LIGHT_TRANSPARENCY_MODES)}), bounceColorHex, bounceColorAlpha, bounceModifier, bounceIntensity, bounceSamples (integer), bounceCompression (${mcpLightSettingsChoicesFormat(LIGHT_BOUNCE_COMPRESSIONS)}).`,
  ].join(' ');
}

/**
 * Description of the settings object of the add_light and set_light_settings
 * tools.
 */
export const MCP_LIGHT_SETTINGS_DESCRIPTION = mcpLightSettingsDescriptionBuild();
