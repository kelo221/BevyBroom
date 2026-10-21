import { describe, expect, it } from 'vitest';
import {
  PORTAL_MIN_SIZE,
  portalSettingsCreateDefault,
  portalSettingsFromUnknown,
  portalSettingsSanitize,
} from '@/portal/model/portal_settings.js';
import {
  ROOM_MIN_HALF_SIZE,
  roomSettingsCreateDefault,
  roomSettingsFromUnknown,
  roomSettingsSanitize,
} from '@/portal/model/room_settings.js';

/** Room and portal settings always reach the game with positive, finite sizes. */
describe('room and portal settings', () => {
  it('replaces non-finite room half sizes with defaults and lifts tiny ones to the minimum', () => {
    const defaults = roomSettingsCreateDefault();
    const sanitized = roomSettingsSanitize({ halfSizeX: Number.NaN, halfSizeY: -4, halfSizeZ: 6 });
    expect(sanitized.halfSizeX).toBe(defaults.halfSizeX);
    expect(sanitized.halfSizeY).toBe(ROOM_MIN_HALF_SIZE);
    expect(sanitized.halfSizeZ).toBe(6);
  });

  it('fills missing room fields from defaults and rejects non-objects', () => {
    expect(roomSettingsFromUnknown({ halfSizeY: 2.5 })).toEqual({ ...roomSettingsCreateDefault(), halfSizeY: 2.5 });
    expect(roomSettingsFromUnknown('room')).toBeNull();
    expect(roomSettingsFromUnknown(null)).toBeNull();
  });

  it('clamps portal extents and only treats a true closed flag as closed', () => {
    const sanitized = portalSettingsSanitize({ width: 0, height: Number.POSITIVE_INFINITY, closed: true });
    expect(sanitized.width).toBe(PORTAL_MIN_SIZE);
    expect(sanitized.height).toBe(portalSettingsCreateDefault().height);
    expect(sanitized.closed).toBe(true);
    expect(portalSettingsFromUnknown({ closed: 'yes' })?.closed).toBe(false);
    expect(portalSettingsFromUnknown(7)).toBeNull();
  });
});
