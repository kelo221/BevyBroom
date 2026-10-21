import type * as THREE from 'three';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import {
  type PortalSettings,
  portalSettingsCreateDefault,
  portalSettingsFromUnknown,
  portalSettingsSanitize,
} from '@/portal/model/portal_settings.js';
import { PortalVisualBuilder } from '@/portal/visual/portal_visual_builder.js';

/** Rules of authored portals. */
export class PortalDefinition extends EntityDefinition<PortalSettings> {
  readonly kind: EntityKind = 'portal';

  /**
   * Returns default portal settings.
   *
   * @returns Fresh settings object.
   */
  settingsCreateDefault(): PortalSettings {
    return portalSettingsCreateDefault();
  }

  /**
   * Returns portal settings with positive, finite extents.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  settingsSanitize(settings: PortalSettings): PortalSettings {
    return portalSettingsSanitize(settings);
  }

  /**
   * Reads untrusted data into valid portal settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value is not an object.
   */
  settingsFromUnknown(value: unknown): PortalSettings | null {
    return portalSettingsFromUnknown(value);
  }

  /**
   * Rebuilds the surface, outline and arrow of a portal owner.
   *
   * @param owner Portal owner group.
   * @param settings Valid settings.
   */
  visualsRefresh(owner: THREE.Object3D, settings: PortalSettings): void {
    PortalVisualBuilder.refresh(owner, settings);
  }
}
