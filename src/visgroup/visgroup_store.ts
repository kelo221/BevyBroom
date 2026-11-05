import * as THREE from 'three';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { VisibilityHideLedger } from './visibility/visibility_hide_ledger.js';
import { VisGroupClassifierAuto } from './visgroup_classifier_auto.js';
import { VisGroupObjectCollector } from './visgroup_object_collector.js';
import {
  AUTO_VIS_GROUP_IDS,
  VISGROUP_IDS_USERDATA_KEY,
  visGroupIdAutoIs,
  type AutoVisGroupId,
  type UserVisGroup,
  type VisGroupSelectionTarget,
} from './visgroup_types.js';

/** Listener notified when VisGroup definitions, membership or visibility change. */
export type VisGroupStoreListener = () => void;

/**
 * Manages user-defined and automatic VisGroups, multi-group object membership,
 * non-destructive visibility filtering, and Mark (select members).
 */
export class VisGroupStore {
  private readonly userGroups: Map<string, UserVisGroup>;
  private readonly autoVisible: Map<AutoVisGroupId, boolean>;
  private readonly hideLedger: VisibilityHideLedger;
  private readonly listeners: Set<VisGroupStoreListener>;
  private nextIdCounter: number;

  /**
   * Creates a VisGroup store sharing a visibility hide ledger.
   *
   * @param hideLedger Shared hide ledger; creates a new one when omitted.
   */
  constructor(hideLedger: VisibilityHideLedger = new VisibilityHideLedger()) {
    this.userGroups = new Map();
    this.autoVisible = new Map(AUTO_VIS_GROUP_IDS.map((id) => [id, true]));
    this.hideLedger = hideLedger;
    this.listeners = new Set();
    this.nextIdCounter = 1;
  }

  /**
   * Creates a new user VisGroup and returns it.
   *
   * @param name Display name.
   * @param color Optional 24-bit hex swatch color.
   * @returns Created UserVisGroup.
   */
  userGroupCreate(name: string, color = 0x5c9aff): UserVisGroup {
    const group = this.userGroupDescribe(name, color);
    this.userGroupInsert(group);
    return { ...group };
  }

  /**
   * Describes a new visible user VisGroup with a fresh id without adding it.
   *
   * @param name Display name; a numbered default is used when blank.
   * @param color Optional 24-bit hex swatch color.
   * @returns New UserVisGroup description.
   */
  userGroupDescribe(name: string, color = 0x5c9aff): UserVisGroup {
    return {
      id: `user_visgroup_${this.nextIdCounter++}`,
      name: name.trim() || `VisGroup ${this.userGroups.size + 1}`,
      visible: true,
      color,
    };
  }

  /**
   * Adds or replaces a user VisGroup under its own id.
   *
   * @param group User VisGroup to store; a copy is kept.
   */
  userGroupInsert(group: UserVisGroup): void {
    this.userGroups.set(group.id, { ...group });
    this.listenersNotify();
  }

  /**
   * Returns a copy of a user VisGroup.
   *
   * @param id User VisGroup id.
   * @returns VisGroup copy, or null when unknown.
   */
  userGroupFind(id: string): UserVisGroup | null {
    const group = this.userGroups.get(id);
    return group ? { ...group } : null;
  }

  /**
   * Renames an existing user VisGroup.
   *
   * @param id User VisGroup id.
   * @param newName New display name.
   * @returns True when renamed.
   */
  userGroupRename(id: string, newName: string): boolean {
    const group = this.userGroups.get(id);
    const trimmed = newName.trim();
    if (!group || !trimmed) {
      return false;
    }
    group.name = trimmed;
    this.listenersNotify();
    return true;
  }

  /**
   * Removes a user VisGroup and strips its id from scene objects under
   * worldRoot.
   *
   * @param id User VisGroup id.
   * @param worldRoot Optional world root to clean member tags and visibility
   *   from.
   * @returns True when deleted.
   */
  userGroupDelete(id: string, worldRoot?: THREE.Object3D): boolean {
    if (!this.userGroups.delete(id)) {
      return false;
    }
    this.hideLedger.hideReasonRemoveAll(this.reasonKey(id));
    if (worldRoot) {
      VisGroupObjectCollector.descendantsCollect(worldRoot).forEach((obj) => {
        this.objectGroupRemove(obj, id);
      });
    }
    this.listenersNotify();
    return true;
  }

  /**
   * Lists all user VisGroups in creation order.
   *
   * @returns Array of user VisGroup snapshots.
   */
  userGroupsList(): UserVisGroup[] {
    return Array.from(this.userGroups.values(), (g) => ({ ...g }));
  }

  /**
   * Reads the user VisGroup ids assigned to an object.
   *
   * @param object Scene object.
   * @returns Assigned user VisGroup ids.
   */
  objectGroupIdsRead(object: THREE.Object3D): string[] {
    const raw: unknown = object.userData[VISGROUP_IDS_USERDATA_KEY];
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((item): item is string => typeof item === 'string' && this.userGroups.has(item));
  }

  /**
   * Assigns an object to a user VisGroup (preserving existing memberships).
   *
   * @param object Scene object.
   * @param groupId User VisGroup id.
   */
  objectGroupAdd(object: THREE.Object3D, groupId: string): void {
    if (!this.userGroups.has(groupId)) {
      return;
    }
    const existing = this.objectGroupIdsRead(object);
    if (!existing.includes(groupId)) {
      object.userData[VISGROUP_IDS_USERDATA_KEY] = [...existing, groupId];
      this.listenersNotify();
    }
  }

  /**
   * Removes an object from a user VisGroup.
   *
   * @param object Scene object.
   * @param groupId User VisGroup id.
   */
  objectGroupRemove(object: THREE.Object3D, groupId: string): void {
    const current = this.objectGroupIdsRead(object);
    if (!current.includes(groupId)) {
      return;
    }
    object.userData[VISGROUP_IDS_USERDATA_KEY] = current.filter((id) => id !== groupId);
    this.listenersNotify();
  }

  /**
   * Returns whether a user or auto VisGroup is currently marked visible.
   *
   * @param groupId User or Auto VisGroup id.
   * @returns True when visible.
   */
  groupVisibleIs(groupId: string): boolean {
    if (visGroupIdAutoIs(groupId)) {
      return this.autoVisible.get(groupId) ?? true;
    }
    return this.userGroups.get(groupId)?.visible ?? true;
  }

  /**
   * Sets the visibility of a user or auto VisGroup and updates scene objects.
   *
   * @param groupId User or Auto VisGroup id.
   * @param visible True to show members, false to hide them.
   * @param worldRoot World root whose objects are updated.
   */
  groupVisibleSet(groupId: string, visible: boolean, worldRoot: THREE.Object3D): void {
    if (visGroupIdAutoIs(groupId)) {
      this.autoVisible.set(groupId, visible);
    } else {
      const group = this.userGroups.get(groupId);
      if (!group) return;
      group.visible = visible;
    }
    const members = this.groupMembersCollect(groupId, worldRoot);
    this.hideLedger.hideReasonReplace(this.reasonKey(groupId), visible ? [] : members);
    this.listenersNotify();
  }

  /**
   * Collects all scene objects under worldRoot belonging to a user or auto
   * VisGroup.
   *
   * @param groupId User or Auto VisGroup id.
   * @param worldRoot World root to search.
   * @returns Matching scene objects.
   */
  groupMembersCollect(groupId: string, worldRoot: THREE.Object3D): THREE.Object3D[] {
    if (visGroupIdAutoIs(groupId)) {
      return VisGroupClassifierAuto.membersCollect(worldRoot, groupId);
    }
    return VisGroupObjectCollector.descendantsCollect(worldRoot).filter((obj) =>
      this.objectGroupIdsRead(obj).includes(groupId),
    );
  }

  /**
   * Selects all visible member objects of a VisGroup (Hammer++ Mark button).
   *
   * @param groupId User or Auto VisGroup id.
   * @param worldRoot World root to search.
   * @param selectionTarget Selection manager receiving the marked objects.
   * @returns Number of marked objects.
   */
  groupMembersMark(groupId: string, worldRoot: THREE.Object3D, selectionTarget: VisGroupSelectionTarget): number {
    const members = this.groupMembersCollect(groupId, worldRoot).filter((obj) => obj.visible);
    const meshes = selectionMeshesFromHierarchyCollect(members);
    selectionTarget.setSelection(meshes, members);
    return members.length;
  }

  /**
   * Subscribes to store changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: VisGroupStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Builds the ledger hide-reason key for a VisGroup id.
   *
   * @param groupId VisGroup id.
   * @returns Reason key.
   */
  private reasonKey(groupId: string): string {
    return `visgroup:${groupId}`;
  }

  /** Invokes all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
