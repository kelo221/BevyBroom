import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';
import { lightSettingsChoiceRead } from '@/light/model/features/light_settings_choice.js';

/** Intensity animations the game's renderer plays; steady means no animation. */
export const LIGHT_EFFECT_KINDS = [
  'steady',
  'pulse',
  'random',
  'strobe',
  'flicker',
  'fluorescent_starter',
  'fluorescent_clicker',
  'fluorescent_random',
  'candle',
  'pulsar',
  'fire',
  'generator',
  'lightning',
  'cloudy',
  'overcast',
] as const;

/** One intensity animation of a light. */
export type LightEffectKind = (typeof LIGHT_EFFECT_KINDS)[number];

/** Intensity animation of a light. */
export interface LightSettingsEffect {
  /** Animation played on the light's intensity; steady plays none. */
  effectKind: LightEffectKind;
  /** Speed of smooth effects; number of flash layers for lightning. */
  effectPulseSpeed: number;
  /** Lowest intensity multiplier the effect dips to, 0 to 1. */
  effectPulseModifier: number;
  /** Time offset in seconds so identical lights do not animate in sync. */
  effectPulseOffset: number;
  /** Seconds per step of the stepped effects (random, strobe, flicker). */
  effectTimestep: number;
}

/**
 * Returns the effect settings of a light without an animation.
 *
 * @returns Fresh effect settings.
 */
export function lightSettingsEffectCreateDefault(): LightSettingsEffect {
  return {
    effectKind: 'steady',
    effectPulseSpeed: 1,
    effectPulseModifier: 0.25,
    effectPulseOffset: 0,
    effectTimestep: 1 / 30,
  };
}

/**
 * Returns effect settings the game accepts: a known kind and numbers in range.
 *
 * @param settings Possibly invalid effect settings.
 * @returns Valid effect settings.
 */
export function lightSettingsEffectSanitize(settings: LightSettingsEffect): LightSettingsEffect {
  const defaults = lightSettingsEffectCreateDefault();
  return {
    effectKind: lightSettingsChoiceRead(settings.effectKind, LIGHT_EFFECT_KINDS, defaults.effectKind),
    effectPulseSpeed: entityNumberClamp(settings.effectPulseSpeed, 0, 1000, defaults.effectPulseSpeed),
    effectPulseModifier: entityNumberClamp(settings.effectPulseModifier, 0, 1, defaults.effectPulseModifier),
    effectPulseOffset: entityNumberClamp(settings.effectPulseOffset, -1e4, 1e4, defaults.effectPulseOffset),
    effectTimestep: entityNumberClamp(settings.effectTimestep, 0.001, 60, defaults.effectTimestep),
  };
}
