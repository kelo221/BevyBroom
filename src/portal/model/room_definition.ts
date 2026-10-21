import type * as THREE from 'three';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import {
  type RoomSettings,
  roomSettingsCreateDefault,
  roomSettingsFromUnknown,
  roomSettingsSanitize,
} from '@/portal/model/room_settings.js';
import { RoomVisualBuilder } from '@/portal/visual/room_visual_builder.js';

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
   * Rebuilds the marker and outline of a room owner.
   *
   * @param owner Room owner group.
   * @param settings Valid settings.
   */
  visualsRefresh(owner: THREE.Object3D, settings: RoomSettings): void {
    RoomVisualBuilder.refresh(owner, settings);
  }
}
