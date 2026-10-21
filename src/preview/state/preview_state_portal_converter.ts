import type { PortalSettings } from '@/portal/model/portal_settings.js';
import type { RoomSettings } from '@/portal/model/room_settings.js';
import type { PreviewAuthoredPortal, PreviewAuthoredRoom } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Converts editor room settings into the game preview room definition.
 *
 * @param settings Editor room settings.
 * @returns Wire room with half sizes in meters.
 */
export function previewRoomFromSettings(settings: RoomSettings): PreviewAuthoredRoom {
  return { half_size: [settings.halfSizeX, settings.halfSizeY, settings.halfSizeZ] };
}

/**
 * Converts editor portal settings into the game preview portal definition.
 *
 * @param settings Editor portal settings.
 * @returns Wire portal with its full width and height in meters.
 */
export function previewPortalFromSettings(settings: PortalSettings): PreviewAuthoredPortal {
  return { size: [settings.width, settings.height], closed: settings.closed };
}
