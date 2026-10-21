import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';

/**
 * Authored portal: an opening between rooms shaped as a rectangle in the
 * owner's local XY plane, centered on the owner, with local +Z as its front.
 * Sizes are full extents in meters.
 */
export interface PortalSettings {
  width: number;
  height: number;
  /** A closed portal (a shut door) blocks the view through it. */
  closed: boolean;
}

/** Smallest portal width or height, in meters. */
export const PORTAL_MIN_SIZE = 0.05;

/** Largest portal width or height, in meters. */
const PORTAL_MAX_SIZE = 1e5;

/**
 * Returns the settings of a new open, door-sized portal.
 *
 * @returns Fresh settings object.
 */
export function portalSettingsCreateDefault(): PortalSettings {
  return { width: 1.2, height: 2.2, closed: false };
}

/**
 * Clamps one portal extent into the allowed range.
 *
 * @param value Candidate extent.
 * @param fallback Extent used when the candidate is not finite.
 * @returns Valid extent.
 */
function portalSizeClamp(value: number, fallback: number): number {
  return entityNumberClamp(value, PORTAL_MIN_SIZE, PORTAL_MAX_SIZE, fallback);
}

/**
 * Returns portal settings with positive, finite extents.
 *
 * @param settings Possibly invalid settings.
 * @returns Valid settings.
 */
export function portalSettingsSanitize(settings: PortalSettings): PortalSettings {
  const defaults = portalSettingsCreateDefault();
  return {
    width: portalSizeClamp(settings.width, defaults.width),
    height: portalSizeClamp(settings.height, defaults.height),
    closed: settings.closed === true,
  };
}

/**
 * Reads untrusted data (scene files, userData) into valid portal settings.
 *
 * @param value Any value.
 * @returns Valid settings, or null when the value is not an object.
 */
export function portalSettingsFromUnknown(value: unknown): PortalSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return portalSettingsSanitize({ ...portalSettingsCreateDefault(), ...(value as Partial<PortalSettings>) });
}
