import type * as THREE from 'three';

/** Hidden object with its visibility before the first reason hid it. */
interface VisibilityHideLedgerEntry {
  readonly visibleBefore: boolean;
  readonly reasons: Set<string>;
}

/**
 * Hides objects for named reasons and restores each object's earlier visibility
 * once no reason hides it anymore, so independent filters can hide the same
 * object without overwriting each other.
 */
export class VisibilityHideLedger {
  private readonly entries = new Map<THREE.Object3D, VisibilityHideLedgerEntry>();

  /**
   * Hides an object for a reason, remembering its visibility on the first
   * reason.
   *
   * @param object Object to hide.
   * @param reason Name of the filter hiding it.
   */
  hideReasonAdd(object: THREE.Object3D, reason: string): void {
    const existing = this.entries.get(object);
    if (existing) {
      existing.reasons.add(reason);
      return;
    }
    this.entries.set(object, { visibleBefore: object.visible, reasons: new Set([reason]) });
    object.visible = false;
  }

  /**
   * Drops one reason from an object and restores its earlier visibility when no
   * reason is left.
   *
   * @param object Hidden object.
   * @param reason Name of the filter releasing it.
   */
  hideReasonRemove(object: THREE.Object3D, reason: string): void {
    const entry = this.entries.get(object);
    if (!entry || !entry.reasons.delete(reason)) {
      return;
    }
    if (entry.reasons.size === 0) {
      this.entries.delete(object);
      object.visible = entry.visibleBefore;
    }
  }

  /**
   * Drops a reason from every object it hides.
   *
   * @param reason Name of the filter releasing its objects.
   */
  hideReasonRemoveAll(reason: string): void {
    this.objectsHiddenByReason(reason).forEach((object) => this.hideReasonRemove(object, reason));
  }

  /**
   * Makes a reason hide exactly the given objects.
   *
   * @param reason Name of the filter.
   * @param objects Objects the reason hides from now on.
   */
  hideReasonReplace(reason: string, objects: Iterable<THREE.Object3D>): void {
    this.hideReasonRemoveAll(reason);
    for (const object of objects) {
      this.hideReasonAdd(object, reason);
    }
  }

  /**
   * Returns whether a reason hides an object.
   *
   * @param object Candidate object.
   * @param reason Filter name.
   * @returns True when the reason hides the object.
   */
  hiddenByReasonIs(object: THREE.Object3D, reason: string): boolean {
    return this.entries.get(object)?.reasons.has(reason) ?? false;
  }

  /**
   * Lists the objects a reason hides.
   *
   * @param reason Filter name.
   * @returns Hidden objects.
   */
  objectsHiddenByReason(reason: string): THREE.Object3D[] {
    const hidden: THREE.Object3D[] = [];
    this.entries.forEach((entry, object) => {
      if (entry.reasons.has(reason)) {
        hidden.push(object);
      }
    });
    return hidden;
  }
}
