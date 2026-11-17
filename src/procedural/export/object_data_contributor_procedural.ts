import type * as THREE from 'three';
import { GAME_ENTITY_EXPORT_EXTRAS_KEY } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { ProceduralBuild } from '@/procedural/build/procedural_build.js';
import { ProceduralExportComponent } from '@/procedural/export/procedural_export_component.js';
import { ProceduralExportPartBuilder } from '@/procedural/export/procedural_export_part_builder.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewAuthoredComponents } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Carries procedural objects to the game: their generated parts as level meshes
 * in every export and in the game preview, and their parameters as the
 * `BroomProceduralProp` component beside the object's other game components.
 */
export class ObjectDataContributorProcedural extends ObjectDataContributor {
  readonly contributorName = 'procedural';

  /**
   * Returns the generated part meshes of a procedural owner.
   *
   * @param owner Entity owner.
   * @param options Export behavior switches.
   * @returns Part meshes, or null for other owners and unknown generators.
   */
  override exportEntityChildrenCreate(owner: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D[] | null {
    const settings = ProceduralOwner.settingsRead(owner);
    return settings === null ? null : ProceduralExportPartBuilder.meshesCreate(owner, settings, options);
  }

  /**
   * Returns the build key of a procedural owner's parts.
   *
   * @param owner Entity owner.
   * @returns Build key, or null for other owners.
   */
  override exportEntitySignatureDescribe(owner: THREE.Object3D): string | null {
    const settings = ProceduralOwner.settingsRead(owner);
    return settings === null ? null : ProceduralBuild.keyOf(settings);
  }

  /**
   * Adds the `BroomProceduralProp` component to the components a procedural
   * object sends to the game preview.
   *
   * @param object Live scene object.
   * @param authored Preview object being built.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    const settings = ProceduralOwner.settingsRead(object);
    if (settings !== null) {
      authored.components = ProceduralExportComponent.componentsMerge(authored.components, settings);
    }
  }

  /**
   * Adds the `BroomProceduralProp` component to the exported game components of
   * a procedural object.
   *
   * @param source Live scene object.
   * @param target Export node.
   * @param options Export behavior switches.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D, options: ExportSceneOptions): void {
    const settings = ProceduralOwner.settingsRead(source);
    if (settings === null || options.includeGameComponents !== true) {
      return;
    }
    const current = target.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] as PreviewAuthoredComponents | undefined;
    target.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] = ProceduralExportComponent.componentsMerge(current, settings);
  }
}
