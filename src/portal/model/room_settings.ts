import { entityNumberClamp } from '@/entity/model/entity_number_clamp.js';

/**
 * Authored room cell: a box centered on the owner with these half sizes in the
 * owner's local axes, in meters. The owner transform positions, rotates and
 * scales the box.
 */
export interface RoomSettings {
  halfSizeX: number;
  halfSizeY: number;
  halfSizeZ: number;
}

/** Smallest half size a room may have, in meters. */
export const ROOM_MIN_HALF_SIZE = 0.05;

/** Largest half size a room may have, in meters. */
const ROOM_MAX_HALF_SIZE = 1e5;

/**
 * Returns the settings of a new four by three by four meter room.
 *
 * @returns Fresh settings object.
 */
export function roomSettingsCreateDefault(): RoomSettings {
  return { halfSizeX: 2, halfSizeY: 1.5, halfSizeZ: 2 };
}

/**
 * Clamps one half size into the allowed range.
 *
 * @param value Candidate half size.
 * @param fallback Half size used when the candidate is not finite.
 * @returns Valid half size.
 */
function roomHalfSizeClamp(value: number, fallback: number): number {
  return entityNumberClamp(value, ROOM_MIN_HALF_SIZE, ROOM_MAX_HALF_SIZE, fallback);
}

/**
 * Returns room settings with positive, finite half sizes.
 *
 * @param settings Possibly invalid settings.
 * @returns Valid settings.
 */
export function roomSettingsSanitize(settings: RoomSettings): RoomSettings {
  const defaults = roomSettingsCreateDefault();
  return {
    halfSizeX: roomHalfSizeClamp(settings.halfSizeX, defaults.halfSizeX),
    halfSizeY: roomHalfSizeClamp(settings.halfSizeY, defaults.halfSizeY),
    halfSizeZ: roomHalfSizeClamp(settings.halfSizeZ, defaults.halfSizeZ),
  };
}

/**
 * Reads untrusted data (scene files, userData) into valid room settings.
 *
 * @param value Any value.
 * @returns Valid settings, or null when the value is not an object.
 */
export function roomSettingsFromUnknown(value: unknown): RoomSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return roomSettingsSanitize({ ...roomSettingsCreateDefault(), ...(value as Partial<RoomSettings>) });
}
