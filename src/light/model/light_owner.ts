import type * as THREE from 'three';
import { EntityOwner } from '@/entity/model/entity_owner.js';
import { LightDefinition } from '@/light/model/light_definition.js';
import { type LightKind, type LightSettings, lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/**
 * Creates and reads authored lights. A light owner's local −Z axis is the spot
 * direction.
 */
export class EntityOwnerLight extends EntityOwner<LightSettings> {
  /**
   * Creates a light owner with default settings for a kind.
   *
   * @param name Display name.
   * @param kind Point or spot; point when omitted.
   * @returns New owner group.
   */
  override createDefault(name: string, kind: LightKind = 'point'): THREE.Group {
    return this.create(name, lightSettingsCreateDefault(kind));
  }
}

/** Owner helper of authored lights. */
export const LightOwner = new EntityOwnerLight(new LightDefinition());
