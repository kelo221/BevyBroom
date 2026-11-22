import type * as THREE from 'three';
import { entityKindRead, entityOwnerChildOwners } from '@/entity/model/entity_owner_keys.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import type { EntityArraySettings } from '@/entity_array/model/entity_array_settings.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';
import { hashFnv1a32Hex } from '@/utils/utils_hash_fnv.js';

/** What an entity is made of, apart from where it stands. */
interface EntityArrayContentDescription {
  readonly kind: string | null;
  readonly name: string;
  readonly visible: boolean;
  readonly settings: unknown;
  readonly data: ObjectEntry;
  readonly children: readonly EntityArrayContentDescription[];
}

/**
 * Sums up everything the copies of an array are built from, so copies built
 * from other content or settings are known to be out of date.
 */
export class EntityArraySignature {
  /**
   * Returns the signature of an array source.
   *
   * @param source Array source.
   * @param settings Its array settings.
   * @param footprintSize Size of the source in its own space.
   * @returns Short hash of the content, settings and footprint.
   */
  static of(source: THREE.Object3D, settings: EntityArraySettings, footprintSize: THREE.Vector3): string {
    const description = EntityArraySignature.contentDescribe(source);
    return hashFnv1a32Hex(JSON.stringify([description, settings, footprintSize.toArray()]));
  }

  /**
   * Describes what an entity is made of: its kind, name, visibility, settings,
   * the data features store on it, and the same of the entities nested under
   * it, array copies left out. Its transform is left out.
   *
   * @param owner Entity owner.
   * @returns Plain description.
   */
  private static contentDescribe(owner: THREE.Object3D): EntityArrayContentDescription {
    const helper = EntityOwnerRegistry.find(owner);
    return {
      kind: entityKindRead(owner),
      name: owner.name,
      visible: owner.visible,
      settings: helper?.settingsRead(owner) ?? null,
      data: EntityArraySignature.featureDataOf(owner),
      children: entityOwnerChildOwners(owner)
        .filter((child) => !EntityArrayCopyMark.is(child))
        .map((child) => EntityArraySignature.contentDescribe(child)),
    };
  }

  /**
   * Returns the data features store on an entity, as they write it into a scene
   * file entry.
   *
   * @param owner Entity owner.
   * @returns Entry holding only feature data.
   */
  private static featureDataOf(owner: THREE.Object3D): ObjectEntry {
    const entry: ObjectEntry = {
      uuid: '',
      name: '',
      type: 'group',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      parentId: null,
    };
    ObjectDataContributorRegistry.sceneEntryWrite(owner, entry);
    return entry;
  }
}
