import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';

/** Light shapes the editor authors. Spots shine along the owner's local −Z axis. */
export type LightKind = 'point' | 'spot';

/** How a light casts shadows in the game's DynLight renderer. */
export type LightShadowMode = 'raytraced' | 'realtime';

/**
 * Authored light definition. Units follow the game renderer: meters and
 * degrees.
 */
export interface LightSettings {
  kind: LightKind;
  /** SRGB color as a 0xRRGGBB number. */
  colorHex: number;
  /** Brightness; does not change the range. */
  intensity: number;
  /** Meters from the light where its light ends. */
  radius: number;
  /** Extra decay within the radius; 0 is physically based. */
  falloff: number;
  /** Spot only: degrees from the axis where the light starts to fade. */
  innerCutoffDegrees: number;
  /** Spot only: degrees from the axis where the light ends. */
  outerCutoffDegrees: number;
  /** Never baked: evaluated live so it can move freely. */
  realtime: boolean;
  /** Raytraced uses baked shadows; realtime adds a live shadow cubemap. */
  shadows: LightShadowMode;
  /** Disabled lights stay in the document but give no light. */
  enabled: boolean;
}

/** Largest spot cone angle from the axis, in degrees. */
export const LIGHT_MAX_CUTOFF_DEGREES = 179;

/** Smallest radius the editor allows, in meters. */
export const LIGHT_MIN_RADIUS = 0.05;

/**
 * Returns default settings for a new light of the given kind.
 *
 * @param kind Point or spot.
 * @returns Fresh settings object.
 */
export function lightSettingsCreateDefault(kind: LightKind): LightSettings {
  return {
    kind,
    colorHex: kind === 'spot' ? 0xfff2dd : 0xffe2b8,
    intensity: kind === 'spot' ? 3 : 2,
    radius: kind === 'spot' ? 8 : 5,
    falloff: 0,
    innerCutoffDegrees: 26,
    outerCutoffDegrees: 30,
    realtime: false,
    shadows: 'raytraced',
    enabled: true,
  };
}

/**
 * Copies settings so later edits do not alias the source.
 *
 * @param settings Source settings.
 * @returns Independent copy.
 */
export function lightSettingsClone(settings: LightSettings): LightSettings {
  return { ...settings };
}

/**
 * Compares every field of two settings objects.
 *
 * @param first First settings.
 * @param second Second settings.
 * @returns True when all fields match.
 */
export function lightSettingsEqual(first: LightSettings, second: LightSettings): boolean {
  const keys = Object.keys(first) as (keyof LightSettings)[];
  return keys.every((key) => first[key] === second[key]);
}

/**
 * Returns settings the game renderer accepts: positive radius, non-negative
 * intensity, an open spot cone with the inner angle inside the outer one, and a
 * 24-bit color.
 *
 * @param settings Possibly invalid settings.
 * @returns Valid settings.
 */
export function lightSettingsSanitize(settings: LightSettings): LightSettings {
  const defaults = lightSettingsCreateDefault(settings.kind);
  const outer = entityNumberClamp(
    settings.outerCutoffDegrees,
    0.5,
    LIGHT_MAX_CUTOFF_DEGREES,
    defaults.outerCutoffDegrees,
  );
  return {
    kind: settings.kind === 'spot' ? 'spot' : 'point',
    colorHex: Math.round(entityNumberClamp(settings.colorHex, 0, 0xffffff, defaults.colorHex)),
    intensity: entityNumberClamp(settings.intensity, 0, 1e6, defaults.intensity),
    radius: entityNumberClamp(settings.radius, LIGHT_MIN_RADIUS, 1e5, defaults.radius),
    falloff: entityNumberClamp(settings.falloff, 0, 1, defaults.falloff),
    innerCutoffDegrees: entityNumberClamp(
      settings.innerCutoffDegrees,
      0,
      outer,
      Math.min(outer, defaults.innerCutoffDegrees),
    ),
    outerCutoffDegrees: outer,
    realtime: settings.realtime === true,
    shadows: settings.shadows === 'realtime' ? 'realtime' : 'raytraced',
    enabled: settings.enabled !== false,
  };
}

/**
 * Reads untrusted data (scene files, userData) into valid settings.
 *
 * @param value Any value.
 * @returns Valid settings, or null when the value is not an object.
 */
export function lightSettingsFromUnknown(value: unknown): LightSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const source = value as Partial<LightSettings>;
  const kind: LightKind = source.kind === 'spot' ? 'spot' : 'point';
  return lightSettingsSanitize({ ...lightSettingsCreateDefault(kind), ...source, kind });
}
