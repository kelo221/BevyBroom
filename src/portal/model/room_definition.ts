import * as THREE from 'three';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import {
  type RoomSettings,
  roomSettingsCreateDefault,
  roomSettingsFromUnknown,
  roomSettingsSanitize,
} from '@/portal/model/room_settings.js';
import { ROOM_GUIDE_COLOR, ROOM_ICON_NAME, RoomVisualBuilder } from '@/portal/visual/room_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';

/** Rules of authored room cells. */
export class RoomDefinition extends EntityDefinition<RoomSettings> {
  readonly kind: EntityKind = 'room';

  /**
   * Returns default room settings.
   *
   * @returns Fresh settings object.
   */
  settingsCreateDefault(): RoomSettings {
    return roomSettingsCreateDefault();
  }

  /**
   * Returns room settings with positive, finite half sizes.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  settingsSanitize(settings: RoomSettings): RoomSettings {
    return roomSettingsSanitize(settings);
  }

  /**
   * Reads untrusted data into valid room settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value is not an object.
   */
  settingsFromUnknown(value: unknown): RoomSettings | null {
    return roomSettingsFromUnknown(value);
  }

  /**
   * Returns the floor plan icon every room uses.
   *
   * @param _settings Room settings.
   * @returns Icon name.
   */
  iconName(_settings: RoomSettings): IconName {
    return ROOM_ICON_NAME;
  }

  /**
   * Returns the room guide color.
   *
   * @param _owner Room owner group.
   * @param _settings Room settings.
   * @returns Icon color as a hex number.
   */
  override iconColorHex(_owner: THREE.Object3D, _settings: RoomSettings): number {
    return ROOM_GUIDE_COLOR;
  }

  /**
   * Returns the whole room volume, so the selection bounds of a room are the
   * room and resizing them resizes the room.
   *
   * @param settings Valid settings.
   * @returns Local box spanning the half sizes.
   */
  override boundsLocal(settings: RoomSettings): THREE.Box3 {
    const halfSize = new THREE.Vector3(settings.halfSizeX, settings.halfSizeY, settings.halfSizeZ);
    return new THREE.Box3(halfSize.clone().negate(), halfSize);
  }

  /**
   * Rebuilds the marker and outline of a room owner.
   *
   * @param owner Room owner group.
   * @param settings Valid settings.
   */
  visualsRefresh(owner: THREE.Object3D, settings: RoomSettings): void {
    RoomVisualBuilder.refresh(owner, settings);
  }
}
