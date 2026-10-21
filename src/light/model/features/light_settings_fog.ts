import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';
import { lightSettingsChoiceRead } from '@/light/model/features/light_settings_choice.js';

/** Shapes of the fog volume around a light. Cones follow the spot's outer angle. */
export const LIGHT_FOG_SHAPES = ['sphere', 'box', 'cone_z', 'cone_y', 'frustum'] as const;

/** One fog volume shape. */
export type LightFogShape = (typeof LIGHT_FOG_SHAPES)[number];

/** Volumetric fog drawn around a light in the light's color. */
export interface LightSettingsFog {
  /** Whether the light fills a volume with fog. */
  fogEnabled: boolean;
  /** Shape of the fog volume. */
  fogShape: LightFogShape;
  /** Size of the volume in meters; the fog is gone at its edge. */
  fogRadius: number;
  /** How hard the fog is to see through, at least 1. */
  fogThickness: number;
  /** Opacity of the fog, 0 to 1. */
  fogIntensity: number;
  /** Meters within which objects inside the fog stay clearly visible. */
  fogVisibility: number;
}

/**
 * Returns fog settings that are off, shaped to suit the light kind.
 *
 * @param isSpot True for spot lights, which get a cone along their axis.
 * @returns Fresh fog settings.
 */
export function lightSettingsFogCreateDefault(isSpot: boolean): LightSettingsFog {
  return {
    fogEnabled: false,
    fogShape: isSpot ? 'cone_z' : 'sphere',
    fogRadius: 4,
    fogThickness: 1,
    fogIntensity: 0.75,
    fogVisibility: 2,
  };
}

/**
 * Returns fog settings the game accepts: a known shape and numbers in range.
 *
 * @param settings Possibly invalid fog settings.
 * @param isSpot True for spot lights; decides the fallback shape.
 * @returns Valid fog settings.
 */
export function lightSettingsFogSanitize(settings: LightSettingsFog, isSpot: boolean): LightSettingsFog {
  const defaults = lightSettingsFogCreateDefault(isSpot);
  return {
    fogEnabled: settings.fogEnabled === true,
    fogShape: lightSettingsChoiceRead(settings.fogShape, LIGHT_FOG_SHAPES, defaults.fogShape),
    fogRadius: entityNumberClamp(settings.fogRadius, 0.01, 1e5, defaults.fogRadius),
    fogThickness: entityNumberClamp(settings.fogThickness, 1, 1000, defaults.fogThickness),
    fogIntensity: entityNumberClamp(settings.fogIntensity, 0, 1, defaults.fogIntensity),
    fogVisibility: entityNumberClamp(settings.fogVisibility, 0, 1e5, defaults.fogVisibility),
  };
}
