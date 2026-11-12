import type * as THREE from 'three';
import { ModifierVolumeBevel } from '@/modifier/volume/modifier_volume_bevel.js';
import {
  modifierBevelClampUvOwner,
  modifierBevelClampUvPivot,
  modifierBevelClampUvSpace,
} from '@/modifier/volume/modifier_volume_bevel_keys.js';
import { modifierVolumeTemplateEntries } from '@/modifier/stack/modifier_volume_templates.js';
import type { ModifierStackSettings } from '@/modifier/stack/modifier_stack_types.js';

/**
 * Bevel volume settings that scene files of schema 7 and older stored on a mesh
 * entry. Newer files store a modifier stack instead.
 */
export interface ModifierStackLegacyBevelEntry {
  distance: number;
  segments?: number;
  angleDegrees?: number;
  uvFlow?: string;
  uvLayout?: string;
  textureId?: string;
  blacklist?: string[];
  uvScaleU?: number;
  uvScaleV?: number;
  uvOffsetU?: number;
  uvOffsetV?: number;
  uvRotation?: number;
  uvOwner?: string;
  uvPivot?: string;
  uvSpace?: string;
}

/**
 * Returns the stack an old bevel volume becomes: single brushes captured, and
 * one bevel modifier with the defaults old files imply.
 *
 * @returns Stack settings before the stored bevel values are applied.
 */
export function modifierStackLegacyBevelStack(): Partial<ModifierStackSettings> {
  return { grouping: 'brush', modifiers: modifierVolumeTemplateEntries(['bevel'], false) };
}

/**
 * Writes the settings of an old bevel volume into the bevel modifier of a
 * volume made from {@link modifierStackLegacyBevelStack}.
 *
 * @param volume Modifier volume with one bevel modifier.
 * @param bevel Stored bevel settings.
 */
export function modifierStackLegacyBevelRestore(volume: THREE.Object3D, bevel: ModifierStackLegacyBevelEntry): void {
  ModifierVolumeBevel.writeDistance(volume, bevel.distance);
  if (bevel.segments !== undefined) ModifierVolumeBevel.writeSegments(volume, bevel.segments);
  if (bevel.angleDegrees !== undefined) ModifierVolumeBevel.writeAngleDegrees(volume, bevel.angleDegrees);
  if (bevel.uvFlow !== undefined) ModifierVolumeBevel.writeUvFlow(volume, bevel.uvFlow);
  if (bevel.uvLayout !== undefined) ModifierVolumeBevel.writeUvLayout(volume, bevel.uvLayout);
  if (bevel.textureId !== undefined) ModifierVolumeBevel.writeTextureId(volume, bevel.textureId);
  modifierStackLegacyBevelPlacementRestore(volume, bevel);
}

/**
 * Restores the generated UV placement and the ignored objects of an old bevel
 * volume.
 *
 * @param volume Modifier volume with one bevel modifier.
 * @param bevel Stored bevel settings.
 */
function modifierStackLegacyBevelPlacementRestore(volume: THREE.Object3D, bevel: ModifierStackLegacyBevelEntry): void {
  const current = ModifierVolumeBevel.readSettings(volume);
  ModifierVolumeBevel.writeSettings(volume, {
    ...current,
    blacklist: bevel.blacklist ?? current.blacklist,
    uvScaleU: bevel.uvScaleU ?? current.uvScaleU,
    uvScaleV: bevel.uvScaleV ?? current.uvScaleV,
    uvOffsetU: bevel.uvOffsetU ?? current.uvOffsetU,
    uvOffsetV: bevel.uvOffsetV ?? current.uvOffsetV,
    uvRotation: bevel.uvRotation ?? current.uvRotation,
    uvOwner: modifierBevelClampUvOwner(bevel.uvOwner ?? current.uvOwner),
    uvPivot: modifierBevelClampUvPivot(bevel.uvPivot ?? current.uvPivot),
    uvSpace: modifierBevelClampUvSpace(bevel.uvSpace ?? current.uvSpace),
  });
}
