import * as THREE from 'three';
import { entityScaleSettingsShown } from '@/entity/scale/entity_scale_absorb.js';
import { LightOwner } from '@/light/model/light_owner.js';
import type { PreviewAuthoredLight } from '@/preview/protocol/preview_protocol_types.js';
import { previewLightFromSettings } from '@/preview/state/preview_state_light_converter.js';

/** Node extras key holding the DynLight light type name. */
export const LIGHT_EXPORT_TYPE_EXTRAS_KEY = 'dynlight_type';

/** Node extras key holding the light's sRGB color as three numbers from 0 to 1. */
export const LIGHT_EXPORT_COLOR_EXTRAS_KEY = 'dynlight_color';

/** Node extras key holding the light's intensity effect name. */
export const LIGHT_EXPORT_EFFECT_EXTRAS_KEY = 'dynlight_effect';

/** Node extras key holding the light's fog volume shape name. */
export const LIGHT_EXPORT_FOG_EXTRAS_KEY = 'dynlight_fog';

/** Node extras key holding the light's shimmer pattern name. */
export const LIGHT_EXPORT_SHIMMER_EXTRAS_KEY = 'dynlight_shimmer';

/**
 * Node extras key holding the light's complete definition as the game preview
 * receives it, for games that read more settings than the DynLight extras.
 */
export const LIGHT_EXPORT_SETTINGS_EXTRAS_KEY = 'broom_light';

/** Node extras key holding the editor id of the light the node belongs to. */
export const LIGHT_EXPORT_OWNER_EXTRAS_KEY = 'broom_light_of';

/** The numeric and boolean light fields written as extras, by extras key. */
const LIGHT_EXPORT_SCALAR_FIELDS: readonly (readonly [string, keyof PreviewAuthoredLight])[] = [
  ['dynlight_intensity', 'intensity'],
  ['dynlight_radius', 'radius'],
  ['dynlight_falloff', 'falloff'],
  ['dynlight_inner_cutoff', 'inner_cutoff'],
  ['dynlight_outer_cutoff', 'outer_cutoff'],
  ['dynlight_realtime', 'realtime'],
];

/**
 * Builds the export node that describes a light to game engines reading
 * DynLight node extras: an empty node in owner space whose extras carry the
 * light's type, color, range, cone, effect, fog shape and shimmer, plus the
 * complete light definition and the light's editor id.
 */
export class LightExportNodeBuilder {
  /**
   * Creates the light node of a light owner.
   *
   * @param owner Candidate entity owner.
   * @returns The light node, or null for other objects and for disabled lights.
   */
  static lightNodeCreate(owner: THREE.Object3D): THREE.Object3D | null {
    const settings = entityScaleSettingsShown(LightOwner, owner);
    if (!settings || !settings.enabled) {
      return null;
    }
    const node = new THREE.Object3D();
    node.name = `${owner.name} Light`;
    LightExportNodeBuilder.ownerScaleCancel(owner, node);
    const light = previewLightFromSettings(settings);
    LightExportNodeBuilder.extrasWrite(light, node.userData);
    LightExportNodeBuilder.identityExtrasWrite(light, owner.uuid, node.userData);
    return node;
  }

  /**
   * Writes the complete light definition and the editor id of its light, so a
   * game can apply every setting and recognize the light it already shows.
   *
   * @param light The light definition the game preview would receive.
   * @param ownerIdentifier Editor id of the light owner.
   * @param extras The node extras to fill.
   */
  static identityExtrasWrite(
    light: PreviewAuthoredLight,
    ownerIdentifier: string,
    extras: Record<string, unknown>,
  ): void {
    extras[LIGHT_EXPORT_SETTINGS_EXTRAS_KEY] = structuredClone(light);
    extras[LIGHT_EXPORT_OWNER_EXTRAS_KEY] = ownerIdentifier;
  }

  /**
   * Writes the DynLight extras of a light definition.
   *
   * @param light The light definition the game preview would receive.
   * @param extras The node extras to fill.
   */
  static extrasWrite(light: PreviewAuthoredLight, extras: Record<string, unknown>): void {
    extras[LIGHT_EXPORT_TYPE_EXTRAS_KEY] = light.light_type;
    extras[LIGHT_EXPORT_COLOR_EXTRAS_KEY] = [...light.color];
    LIGHT_EXPORT_SCALAR_FIELDS.forEach(([extrasKey, field]) => {
      extras[extrasKey] = light[field];
    });
    LightExportNodeBuilder.featureExtrasWrite(light, extras);
  }

  /**
   * Writes the effect, fog shape and shimmer extras the light uses.
   *
   * @param light The light definition the game preview would receive.
   * @param extras The node extras to fill.
   */
  private static featureExtrasWrite(light: PreviewAuthoredLight, extras: Record<string, unknown>): void {
    if (light.effect !== undefined && light.effect.kind !== 'steady') {
      extras[LIGHT_EXPORT_EFFECT_EXTRAS_KEY] = light.effect.kind;
    }
    if (light.fog !== undefined) {
      extras[LIGHT_EXPORT_FOG_EXTRAS_KEY] = light.fog.shape;
    }
    if (light.shimmer.kind !== 'none') {
      extras[LIGHT_EXPORT_SHIMMER_EXTRAS_KEY] = light.shimmer.kind;
    }
  }

  /**
   * Scales the light node by the inverse of the owner's scale, because a scaled
   * light already stands for its scaled radius in its settings.
   *
   * @param owner The light owner.
   * @param node The light node placed under the owner's transform.
   */
  private static ownerScaleCancel(owner: THREE.Object3D, node: THREE.Object3D): void {
    const ownerScale = owner.scale;
    if (ownerScale.x === 0 || ownerScale.y === 0 || ownerScale.z === 0) {
      return;
    }
    node.scale.set(1 / ownerScale.x, 1 / ownerScale.y, 1 / ownerScale.z);
  }
}
