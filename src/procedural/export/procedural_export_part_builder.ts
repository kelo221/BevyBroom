import * as THREE from 'three';
import { type ExportSceneOptions, cloneContentMeshForExport } from '@/io/scene/builder_export_scene.js';
import { ProceduralBuild } from '@/procedural/build/procedural_build.js';
import { ProceduralGeometryBuilder } from '@/procedural/build/procedural_geometry_builder.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';

/**
 * Builds the export nodes of a procedural object: one static level mesh per
 * generated part, named after the part, so the game can find a part such as an
 * elevator car by name.
 */
export class ProceduralExportPartBuilder {
  /**
   * Creates the export meshes of every part of an object.
   *
   * @param owner Procedural owner.
   * @param settings Valid settings.
   * @param options Export behavior switches.
   * @returns Export meshes in part order, or null when the generator is
   *   unknown.
   */
  static meshesCreate(
    owner: THREE.Object3D,
    settings: ProceduralSettings,
    options: ExportSceneOptions,
  ): THREE.Mesh[] | null {
    const parts = ProceduralBuild.partsOf(settings);
    if (parts === null) {
      return null;
    }
    return parts
      .map((part, partIndex) => ProceduralExportPartBuilder.meshCreate(owner, part, partIndex, settings, options))
      .filter((mesh): mesh is THREE.Mesh => mesh !== null);
  }

  /**
   * Creates the export mesh of one part. Its node identifier is derived from
   * the owner's, so repeated exports are identical.
   *
   * @param owner Procedural owner.
   * @param part Part to export.
   * @param partIndex Index of the part.
   * @param settings Valid settings holding the slot textures.
   * @param options Export behavior switches.
   * @returns Export mesh in owner space, or null when the options leave out
   *   every face of the part.
   */
  private static meshCreate(
    owner: THREE.Object3D,
    part: ProceduralPart,
    partIndex: number,
    settings: ProceduralSettings,
    options: ExportSceneOptions,
  ): THREE.Mesh | null {
    const source = new THREE.Mesh(
      ProceduralGeometryBuilder.create([part]),
      ProceduralBuild.materialsCreate([part], settings),
    );
    source.name = part.name;
    source.uuid = `${owner.uuid}.part${partIndex}`;
    return cloneContentMeshForExport(source, options);
  }
}
