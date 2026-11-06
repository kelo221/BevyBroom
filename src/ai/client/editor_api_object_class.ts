import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { CommandObjectClassChange } from '@/entity/class/commands/command_object_class_change.js';
import type { EntityClass } from '@/entity/class/entity_class.js';
import { entityClassFindByText, entityClassesFittingAll } from '@/entity/class/entity_class_target_resolver.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';

/**
 * Converts scene objects to another class in place, the way the Object
 * Properties Class combo does, as one undoable edit on the editor stack.
 */
export class EditorApiObjectClass {
  private readonly host: EditorApiHost;

  /**
   * Creates the class-change tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs a class-change tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no class-change tool.
   */
  objectClassToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return name === 'set_object_class' ? this.objectClassSet(args) : null;
  }

  /**
   * Converts the named objects to the named class.
   *
   * @param args Tool arguments with ids and class.
   * @returns Result naming the class and object ids, or the validation failure.
   */
  private objectClassSet(args: Record<string, unknown>): McpToolResult {
    const objects = this.objectsRead(args['ids']);
    if (typeof objects === 'string') {
      return failResult(objects);
    }
    const targetClass = this.targetClassRead(objects, args['class']);
    if (typeof targetClass === 'string') {
      return failResult(targetClass);
    }
    return this.objectClassChangePush(objects, targetClass);
  }

  /**
   * Pushes the class change of the unlocked objects onto the editor stack.
   *
   * @param objects Objects named by the call.
   * @param targetClass Class they become.
   * @returns Result after the edit, or a failure when nothing changed.
   */
  private objectClassChangePush(objects: readonly THREE.Object3D[], targetClass: EntityClass): McpToolResult {
    const command = new CommandObjectClassChange(filterUnlockedObjects(objects), targetClass);
    if (!command.hasChanges()) {
      return failResult('No unlocked object changed class');
    }
    this.host.commandStack.push(command);
    this.host.refreshAfterWorldMutation();
    return okResult(`Changed class to ${targetClass.label}`, {
      classId: targetClass.id,
      classLabel: targetClass.label,
      ids: objects.map((object) => object.uuid),
    });
  }

  /**
   * Resolves the class the objects may become from a label, class id or game
   * type path.
   *
   * @param objects Objects being converted.
   * @param classText Typed class text.
   * @returns The class, or a message explaining the bad argument.
   */
  private targetClassRead(objects: readonly THREE.Object3D[], classText: unknown): EntityClass | string {
    if (typeof classText !== 'string' || classText.trim() === '') {
      return 'class must be a class label or id';
    }
    const classes = entityClassesFittingAll(objects);
    const found =
      entityClassFindByText(classes, classText) ?? entityClassFindByText(classes, gameEntityClassIdOf(classText));
    return found ?? `No fitting class named ${classText.trim()}`;
  }

  /**
   * Finds the world objects named by ids.
   *
   * @param ids Candidate object ids.
   * @returns The objects, or a message explaining the bad argument.
   */
  private objectsRead(ids: unknown): THREE.Object3D[] | string {
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string' || id === '')) {
      return 'ids must be a non-empty list of object ids';
    }
    const objects: THREE.Object3D[] = [];
    for (const id of ids) {
      const object = this.host.worldObject.getObjectByProperty('uuid', id);
      if (!object) {
        return `No object with id ${id}`;
      }
      objects.push(object);
    }
    return objects;
  }
}
