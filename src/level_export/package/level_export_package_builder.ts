import type * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { CollisionDocumentBuilder } from '@/level_export/collision/collision_document_builder.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';
import type { LevelBuildManifest } from '@/level_build/manifest/level_build_manifest.js';
import { LevelBuildManifestBuilder } from '@/level_build/manifest/level_build_manifest_builder.js';
import { levelBuildGlbMaterialIdsRead } from '@/level_build/package/level_build_glb_material_reader.js';
import type { ProjectToolTextures } from '@/project/model/project_tool_textures_parser.js';
import { CommandSolidBrushGameComponentsDetach } from '@/solid/commands/brush/command_solid_brush_game_components_detach.js';

/** Exports a world as a GLB with export options. */
export type LevelExportGlbExport = (worldGroup: THREE.Group, options: ExportSceneOptions) => Promise<ArrayBuffer>;

/** What a level package is built from. */
export interface LevelExportPackageSource {
  worldGroup: THREE.Group;
  levelName: string;
  projectIdentifier: string;
  toolTextures: ProjectToolTextures;
}

/** The files of a level package before the geometry file is named. */
export interface LevelExportPackage {
  glb: Uint8Array;
  /** Manifest with an empty geometry file name and revision zero. */
  manifest: LevelBuildManifest;
  /** Text of `collision.json`. */
  collisionJson: string;
}

/**
 * Builds the files of a level package the game loads without the editor: the
 * render GLB (tool faces and volumes left out, collision in the extras), the
 * manifest, and the collision document. Build Level and the command-line export
 * both use it, so they write the same files.
 */
export class LevelExportPackageBuilder {
  /**
   * Builds the package files. While it builds, every brush that carries game
   * components stands in a solid model of its own that holds the components,
   * and afterwards the world is as it was.
   *
   * @param source World, level name, project id and tool textures.
   * @param glbExport GLB exporter; the editor's own by default.
   * @returns GLB bytes, manifest and collision text.
   */
  static async build(
    source: LevelExportPackageSource,
    glbExport: LevelExportGlbExport = (worldGroup, options) =>
      new GlbExporter().exportForLevelPackage(worldGroup, options),
  ): Promise<LevelExportPackage> {
    const brushComponentsDetach = CommandSolidBrushGameComponentsDetach.createForWorld(source.worldGroup);
    brushComponentsDetach?.execute();
    try {
      return await LevelExportPackageBuilder.filesBuild(source, glbExport);
    } finally {
      LevelExportPackageBuilder.brushComponentsDetachRevert(brushComponentsDetach);
    }
  }

  /**
   * Puts brushes that were moved into solid models of their own for the export
   * back where the author left them.
   *
   * @param brushComponentsDetach Executed move, or null when nothing moved.
   */
  private static brushComponentsDetachRevert(
    brushComponentsDetach: CommandSolidBrushGameComponentsDetach | null,
  ): void {
    brushComponentsDetach?.undo();
    brushComponentsDetach?.createdModelsRelease();
  }

  /**
   * Builds the package files from the world as it is.
   *
   * @param source World, level name, project id and tool textures.
   * @param glbExport GLB exporter.
   * @returns GLB bytes, manifest and collision text.
   */
  private static async filesBuild(
    source: LevelExportPackageSource,
    glbExport: LevelExportGlbExport,
  ): Promise<LevelExportPackage> {
    source.worldGroup.updateMatrixWorld(true);
    const glb = new Uint8Array(await glbExport(source.worldGroup, LevelExportPackageBuilder.exportOptionsOf(source)));
    const manifest = LevelBuildManifestBuilder.build({
      worldGroup: source.worldGroup,
      levelName: source.levelName,
      projectIdentifier: source.projectIdentifier,
      geometryRevision: 0,
      geometryFile: '',
      materials: levelBuildGlbMaterialIdsRead(glb),
    });
    const collision = CollisionDocumentBuilder.build(source.worldGroup, manifest.level_name);
    return { glb, manifest, collisionJson: `${JSON.stringify(collision, null, 2)}\n` };
  }

  /**
   * Returns the GLB export options of a level package.
   *
   * @param source Package source.
   * @returns Export options.
   */
  static exportOptionsOf(source: LevelExportPackageSource): ExportSceneOptions {
    const nodraw = new Set(source.toolTextures.nodraw);
    return {
      includeHiddenObjects: true,
      includeLightmapUvs: true,
      includeCollision: true,
      isMaterialOmitted: (materialIdentifier) => nodraw.has(materialIdentifier),
      isObjectOmitted: (object) =>
        LevelExportObjectFilter.collisionSourceIs(object) && CollisionKindStore.resolve(object) === 'volume',
    };
  }
}
