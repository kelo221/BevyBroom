import { vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import type { PanelProperties } from '@/ui/properties/panel_properties.js';

/** Tab context with the spies and stack a tab test inspects. */
export interface ObjectPropertiesTestContext {
  readonly context: ObjectPropertiesTabContext;
  readonly commandStack: CommandStack;
  readonly worldObject: THREE.Group;
  readonly markDirty: ReturnType<typeof vi.fn>;
  readonly afterTransformCommit: ReturnType<typeof vi.fn>;
  /** Pick callbacks the tab asked for, newest last. */
  readonly pickRequests: Array<(object: THREE.Object3D) => void>;
  /**
   * Objects every Mark request selected, with whether it framed them, oldest
   * first.
   */
  readonly markRequests: Array<{ objects: readonly THREE.Object3D[]; shouldFrame: boolean }>;
}

/**
 * Creates a tab context over a fresh world and command stack that edits the
 * given objects.
 *
 * @param objects Objects the tab edits; they are added to the world when they
 *   have no parent.
 * @param propertiesPanel Properties panel the context returns, or null.
 * @returns Context and its spies.
 */
export function objectPropertiesTestContextCreate(
  objects: readonly THREE.Object3D[],
  propertiesPanel: PanelProperties | null = null,
): ObjectPropertiesTestContext {
  const worldObject = new THREE.Group();
  objects.filter((object) => !object.parent).forEach((object) => worldObject.add(object));
  const commandStack = new CommandStack(64);
  const markDirty = vi.fn();
  const afterTransformCommit = vi.fn();
  const pickRequests: Array<(object: THREE.Object3D) => void> = [];
  const markRequests: Array<{ objects: readonly THREE.Object3D[]; shouldFrame: boolean }> = [];
  const context: ObjectPropertiesTabContext = {
    container: document.createElement('div'),
    selectedObjectsRead: () => objects,
    worldObjectRead: () => worldObject,
    markDirty,
    commandStack,
    afterTransformCommit,
    propertiesPanelRead: () => propertiesPanel,
    objectPickBegin: (onPicked) => pickRequests.push(onPicked),
    objectsMark: (marked, shouldFrame) => markRequests.push({ objects: [...marked], shouldFrame }),
  };
  return { context, commandStack, worldObject, markDirty, afterTransformCommit, pickRequests, markRequests };
}

/**
 * Returns the forward direction (-Z) of an object in world space.
 *
 * @param object Scene object.
 * @returns Unit forward direction.
 */
export function objectPropertiesTestForwardRead(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return new THREE.Vector3(0, 0, -1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
}

/**
 * Types a value into a field and fires its change event.
 *
 * @param field Input or text area.
 * @param value Typed value.
 */
export function objectPropertiesTestFieldType(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('change'));
}

/**
 * Finds an element inside a root or fails the test.
 *
 * @param root Element searched.
 * @param selector CSS selector.
 * @returns Found element.
 */
export function objectPropertiesTestQuery<TElement extends Element>(root: ParentNode, selector: string): TElement {
  const found = root.querySelector<TElement>(selector);
  if (!found) {
    throw new Error(`expected an element matching ${selector}`);
  }
  return found;
}
