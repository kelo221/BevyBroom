import type * as THREE from 'three';
import type { VisGroupStore } from '../visgroup_store.js';
import { CommandVisGroup } from './command_visgroup.js';

/**
 * Base of the undoable VisGroup membership changes: brings every object to the
 * wanted membership of one user VisGroup and undo reverts only the objects it
 * changed, so earlier memberships stay.
 */
export abstract class CommandVisGroupMembership extends CommandVisGroup {
  private readonly objects: readonly THREE.Object3D[];
  private readonly groupId: string;
  private changedObjects: THREE.Object3D[];

  /**
   * Creates the membership change.
   *
   * @param store VisGroup store holding the group.
   * @param objects Objects whose membership changes.
   * @param groupId User VisGroup id.
   */
  constructor(store: VisGroupStore, objects: readonly THREE.Object3D[], groupId: string) {
    super(store);
    this.objects = [...objects];
    this.groupId = groupId;
    this.changedObjects = [];
  }

  /**
   * Returns whether the command makes the objects members.
   *
   * @returns True to add, false to remove.
   */
  protected abstract membershipWantedRead(): boolean;

  /** Changes every object whose membership differs and remembers them. */
  execute(): void {
    const wanted = this.membershipWantedRead();
    this.changedObjects = this.objects.filter((object) => this.membershipRead(object) !== wanted);
    this.changedObjects.forEach((object) => this.membershipWrite(object, wanted));
  }

  /** Reverts the memberships the last execute changed. */
  undo(): void {
    const wanted = this.membershipWantedRead();
    this.changedObjects.forEach((object) => this.membershipWrite(object, !wanted));
    this.changedObjects = [];
  }

  /**
   * Returns whether an object is a member of the group.
   *
   * @param object Scene object.
   * @returns True for members.
   */
  private membershipRead(object: THREE.Object3D): boolean {
    return this.store.objectGroupIdsRead(object).includes(this.groupId);
  }

  /**
   * Adds an object to, or removes it from, the group.
   *
   * @param object Scene object.
   * @param isMember True to add, false to remove.
   */
  private membershipWrite(object: THREE.Object3D, isMember: boolean): void {
    if (isMember) {
      this.store.objectGroupAdd(object, this.groupId);
      return;
    }
    this.store.objectGroupRemove(object, this.groupId);
  }
}
