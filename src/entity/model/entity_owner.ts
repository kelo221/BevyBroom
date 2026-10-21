import * as THREE from 'three';
import type { EntityDefinition } from '@/entity/model/entity_definition.js';
import {
  ENTITY_KIND_USERDATA_KEY,
  ENTITY_SETTINGS_USERDATA_KEY,
  type EntityKind,
  entityKindRead,
} from '@/entity/model/entity_owner_keys.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';

/**
 * Creates and reads entity owners of one kind: groups flagged with the kind
 * that store their settings in userData and carry editor-only visuals.
 */
export class EntityOwner<TSettings extends object> {
  readonly definition: EntityDefinition<TSettings>;

  /**
   * Creates an owner helper for a definition.
   *
   * @param definition Rules of the entity kind.
   */
  constructor(definition: EntityDefinition<TSettings>) {
    this.definition = definition;
  }

  /**
   * Returns the kind this helper creates.
   *
   * @returns Entity kind.
   */
  get kind(): EntityKind {
    return this.definition.kind;
  }

  /**
   * Creates an owner with visuals for the given settings.
   *
   * @param name Display name.
   * @param settings Initial settings; sanitized before use.
   * @returns New owner group.
   */
  create(name: string, settings: TSettings): THREE.Group {
    const owner = new THREE.Group();
    owner.name = name;
    owner.userData[ENTITY_KIND_USERDATA_KEY] = this.definition.kind;
    this.settingsWrite(owner, settings);
    return owner;
  }

  /**
   * Creates an owner with default settings.
   *
   * @param name Display name.
   * @returns New owner group.
   */
  createDefault(name: string): THREE.Group {
    return this.create(name, this.definition.settingsCreateDefault());
  }

  /**
   * Returns whether the object is an owner of this kind.
   *
   * @param object Candidate object.
   * @returns True for owners of this kind.
   */
  isOwner(object: THREE.Object3D): boolean {
    return entityKindRead(object) === this.definition.kind;
  }

  /**
   * Reads an owner's settings as an independent copy.
   *
   * @param owner Entity owner.
   * @returns Settings, or null when the object is not an owner of this kind.
   */
  settingsRead(owner: THREE.Object3D): TSettings | null {
    if (!this.isOwner(owner)) {
      return null;
    }
    return this.definition.settingsFromUnknown(owner.userData[ENTITY_SETTINGS_USERDATA_KEY]);
  }

  /**
   * Stores sanitized settings on the owner and refreshes its visuals.
   *
   * @param owner Entity owner.
   * @param settings New settings.
   */
  settingsWrite(owner: THREE.Object3D, settings: TSettings): void {
    const sanitized = this.definition.settingsSanitize(settings);
    owner.userData[ENTITY_SETTINGS_USERDATA_KEY] = this.definition.settingsClone(sanitized);
    this.definition.visualsRefresh(owner, sanitized);
  }

  /**
   * Returns the clickable marker of an owner.
   *
   * @param owner Entity owner.
   * @returns Marker mesh, or null when missing.
   */
  markerOf(owner: THREE.Object3D): THREE.Mesh | null {
    return EntityVisualBuilder.markerFind(owner);
  }

  /**
   * Collects every owner of this kind under a root, in traversal order.
   *
   * @param root Scene root.
   * @returns Owners of this kind.
   */
  collectUnder(root: THREE.Object3D): THREE.Object3D[] {
    const owners: THREE.Object3D[] = [];
    root.traverse((object) => {
      if (this.isOwner(object)) {
        owners.push(object);
      }
    });
    return owners;
  }
}
