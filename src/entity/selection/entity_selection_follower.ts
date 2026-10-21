import type * as THREE from 'three';
import { entityBoundsOwnerOf } from '@/entity/bounds/entity_bounds.js';
import { entitySelectedSet } from '@/entity/selection/entity_selection_state.js';

/** Selection the follower watches. */
export interface EntitySelectionSource {
  /**
   * Returns the selected objects.
   *
   * @returns Selected objects.
   */
  getSelectedObjects(): Iterable<THREE.Object3D>;

  /**
   * Registers a callback run after every selection change.
   *
   * @param callback Change callback.
   */
  onSelectionChanged(callback: () => void): void;
}

/**
 * Keeps the selected state of entity owners in step with the selection, so
 * parts drawn only for selected entities appear and disappear with it.
 */
export class EntitySelectionFollower {
  private readonly selection: EntitySelectionSource;
  private ownersSelected = new Set<THREE.Object3D>();

  /**
   * Creates the follower and starts watching the selection.
   *
   * @param selection Selection to follow.
   */
  constructor(selection: EntitySelectionSource) {
    this.selection = selection;
    selection.onSelectionChanged(() => this.refresh());
    this.refresh();
  }

  /** Marks newly selected owners as selected and the others as not. */
  refresh(): void {
    const owners = this.ownersOfSelection();
    for (const owner of this.ownersSelected) {
      if (!owners.has(owner)) {
        entitySelectedSet(owner, false);
      }
    }
    for (const owner of owners) {
      entitySelectedSet(owner, true);
    }
    this.ownersSelected = owners;
  }

  /**
   * Returns the entity owners the current selection stands for.
   *
   * @returns Distinct owners.
   */
  private ownersOfSelection(): Set<THREE.Object3D> {
    const owners = new Set<THREE.Object3D>();
    for (const object of this.selection.getSelectedObjects()) {
      const owner = entityBoundsOwnerOf(object);
      if (owner) {
        owners.add(owner);
      }
    }
    return owners;
  }
}
