import type * as THREE from 'three';
import type { ObjectEntry, SceneJSON } from '@/io/scene/io_types.js';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';
import type { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { objectDataContributorsBuiltinCreate } from '@/object_data/object_data_contributor_builtin.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Runs every object data contributor, built-in ones first, for each scene file,
 * preview and export step.
 */
export class ObjectDataContributorRegistry {
  private static readonly contributors = new RegistryExtensible<ObjectDataContributor>(
    objectDataContributorsBuiltinCreate,
  );

  /**
   * Adds a contributor after the built-in ones.
   *
   * @param contributor Contributor to add.
   */
  static register(contributor: ObjectDataContributor): void {
    ObjectDataContributorRegistry.contributors.register(contributor);
  }

  /**
   * Removes a contributor added with {@link register}.
   *
   * @param contributor Contributor to remove.
   */
  static unregister(contributor: ObjectDataContributor): void {
    ObjectDataContributorRegistry.contributors.unregister(contributor);
  }

  /**
   * Lets every contributor add its data of one object to a scene file entry.
   *
   * @param object Live scene object.
   * @param entry Entry being written.
   */
  static sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    ObjectDataContributorRegistry.contributors
      .list()
      .forEach((contributor) => contributor.sceneEntryWrite(object, entry));
  }

  /**
   * Lets every contributor restore its data of one object from a scene entry.
   *
   * @param entry Entry being read.
   * @param object Object just created from the entry.
   */
  static sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    ObjectDataContributorRegistry.contributors
      .list()
      .forEach((contributor) => contributor.sceneEntryRead(entry, object));
  }

  /**
   * Lets every contributor add document-wide data to a scene file.
   *
   * @param worldGroup Live world root.
   * @param scene Scene file being written.
   */
  static sceneDocumentWrite(worldGroup: THREE.Object3D, scene: SceneJSON): void {
    ObjectDataContributorRegistry.contributors
      .list()
      .forEach((contributor) => contributor.sceneDocumentWrite(worldGroup, scene));
  }

  /**
   * Lets every contributor read document-wide data before objects are created.
   *
   * @param scene Scene file being read.
   */
  static sceneDocumentRead(scene: SceneJSON): void {
    ObjectDataContributorRegistry.contributors.list().forEach((contributor) => contributor.sceneDocumentRead(scene));
  }

  /**
   * Lets every contributor add its data of one object to a preview object.
   *
   * @param object Live scene object.
   * @param authored Preview object being built.
   */
  static previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    ObjectDataContributorRegistry.contributors
      .list()
      .forEach((contributor) => contributor.previewPayloadAttach(object, authored));
  }

  /**
   * Returns the export children of an entity owner from the first contributor
   * that exports it.
   *
   * @param owner Entity owner.
   * @param options Export behavior switches.
   * @returns Children to export, or null when no contributor exports the owner.
   */
  static exportEntityChildrenCreate(owner: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D[] | null {
    for (const contributor of ObjectDataContributorRegistry.contributors.list()) {
      const children = contributor.exportEntityChildrenCreate(owner, options);
      if (children !== null) {
        return children;
      }
    }
    return null;
  }

  /**
   * Lets every contributor copy its data of one object onto a duplicate.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  static duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    ObjectDataContributorRegistry.contributors
      .list()
      .forEach((contributor) => contributor.duplicateDataCopy(source, copy));
  }

  /**
   * Lets every contributor write its export extras of one object.
   *
   * @param source Live scene object.
   * @param target Export node.
   * @param options Export behavior switches.
   */
  static exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D, options: ExportSceneOptions): void {
    ObjectDataContributorRegistry.contributors
      .list()
      .forEach((contributor) => contributor.exportExtrasWrite(source, target, options));
  }
}
