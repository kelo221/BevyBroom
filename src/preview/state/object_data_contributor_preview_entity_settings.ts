import type * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';
import { previewLightFromSettings } from '@/preview/state/preview_state_light_converter.js';
import { previewPortalFromSettings, previewRoomFromSettings } from '@/preview/state/preview_state_portal_converter.js';

/** Sends the settings of lights, rooms and portals to the game preview. */
export class ObjectDataContributorPreviewEntitySettings extends ObjectDataContributor {
  readonly contributorName = 'preview_entity_settings';

  /**
   * Attaches the light, room or portal definition of an entity owner.
   *
   * @param object Scene object.
   * @param authored Preview object to complete.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    const light = LightOwner.settingsRead(object);
    if (light) {
      authored.light = previewLightFromSettings(light);
    }
    const room = RoomOwner.settingsRead(object);
    if (room) {
      authored.room = previewRoomFromSettings(room);
    }
    const portal = PortalOwner.settingsRead(object);
    if (portal) {
      authored.portal = previewPortalFromSettings(portal);
    }
  }
}
