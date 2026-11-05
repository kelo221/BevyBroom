import * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import { CommandObjectGroup } from '@/outliner/commands/command_object_group.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';

/** Component type path attached when brushes are tied to an entity (`toEntity`). */
export const PREFAB_ENTITY_TIE_DEFAULT_CLASS = 'broom_bridge::placeables::properties::BroomProperties';

/** Name of the group created when several objects are tied to one entity. */
export const PREFAB_ENTITY_TIE_GROUP_NAME = 'func_brush';

/**
 * Undoable Hammer++ `toEntity`: wraps several objects in a new group, or keeps
 * a single selected group, and attaches a game component to it. Undo removes
 * the component and dissolves the created group.
 */
export class CommandPrefabEntityTie extends CommandUndoBatch {
  private readonly target: THREE.Object3D;

  /**
   * Creates the tie from the steps built by `create`.
   *
   * @param steps Grouping and component steps in execution order.
   * @param target Object that carries the component afterwards.
   */
  private constructor(steps: readonly UndoCommand[], target: THREE.Object3D) {
    super(steps);
    this.target = target;
  }

  /**
   * Builds the tie for objects, or returns null when it would change nothing.
   *
   * @param objects Selected brushes or objects.
   * @param parent Parent that receives a newly created group.
   * @param classTypePath Game component type path to attach.
   * @returns Tie command, or null for an empty selection or no change.
   */
  static create(
    objects: readonly THREE.Object3D[],
    parent: THREE.Object3D,
    classTypePath: string = PREFAB_ENTITY_TIE_DEFAULT_CLASS,
  ): CommandPrefabEntityTie | null {
    const firstObject = objects[0];
    if (firstObject === undefined) {
      return null;
    }
    if (objects.length === 1 && firstObject instanceof THREE.Group) {
      return CommandPrefabEntityTie.createForExistingGroup(firstObject, classTypePath);
    }
    return CommandPrefabEntityTie.createForNewGroup(objects, parent, classTypePath);
  }

  /**
   * Returns the object that carries the entity component.
   *
   * @returns Tied group.
   */
  targetRead(): THREE.Object3D {
    return this.target;
  }

  /**
   * Builds the tie that only attaches the component to an existing group.
   *
   * @param group Selected group.
   * @param classTypePath Game component type path to attach.
   * @returns Tie command, or null when the group already has the component.
   */
  private static createForExistingGroup(group: THREE.Group, classTypePath: string): CommandPrefabEntityTie | null {
    const componentsSet = CommandPrefabEntityTie.componentsSetCreate(group, classTypePath);
    return componentsSet.hasChanges() ? new CommandPrefabEntityTie([componentsSet], group) : null;
  }

  /**
   * Builds the tie that groups objects and attaches the component to the group.
   *
   * @param objects Objects to group.
   * @param parent Parent that receives the group.
   * @param classTypePath Game component type path to attach.
   * @returns Tie command.
   */
  private static createForNewGroup(
    objects: readonly THREE.Object3D[],
    parent: THREE.Object3D,
    classTypePath: string,
  ): CommandPrefabEntityTie {
    const grouping = new CommandObjectGroup([...objects], parent, PREFAB_ENTITY_TIE_GROUP_NAME);
    const group = grouping.getGroup();
    const componentsSet = CommandPrefabEntityTie.componentsSetCreate(group, classTypePath);
    return new CommandPrefabEntityTie([grouping, componentsSet], group);
  }

  /**
   * Builds the step that adds the component to an object when it lacks it.
   *
   * @param target Object receiving the component.
   * @param classTypePath Game component type path to attach.
   * @returns Component change step.
   */
  private static componentsSetCreate(target: THREE.Object3D, classTypePath: string): CommandGameEntityComponentsSet {
    return new CommandGameEntityComponentsSet([target], (current: GameEntityComponents) =>
      current[classTypePath] ? current : { ...current, [classTypePath]: {} },
    );
  }
}
