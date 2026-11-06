import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { PanelPropertiesChrome } from '@/ui/properties/panel_properties_chrome.js';
import type { PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';

/**
 * Base of the titled sections Object Properties tabs are built from. Each
 * section owns one element, refreshes it for the edited objects and pushes its
 * edits through the dialog's command stack.
 */
export abstract class ObjectPropertiesTabSection {
  protected readonly context: ObjectPropertiesTabContext;
  protected readonly element: HTMLElement;

  /**
   * Creates the section with a container and a header.
   *
   * @param context Tab context the section edits through.
   * @param title Header text, also the section's lookup name.
   * @param chrome Element factories of the section's look; the properties
   *   panel's look by default.
   */
  protected constructor(
    context: ObjectPropertiesTabContext,
    title: string,
    chrome: PanelPropertiesSectionChrome = new PanelPropertiesChrome(),
  ) {
    this.context = context;
    this.element = chrome.createSectionContainer();
    this.element.dataset['objectPropertiesSection'] = title;
    this.element.appendChild(chrome.createSectionHeader(title));
  }

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Fills the section for the edited objects.
   *
   * @param objects Edited objects.
   */
  abstract refresh(objects: readonly THREE.Object3D[]): void;

  /** Removes listeners the section owns. */
  dispose(): void {}

  /**
   * Pushes one edit onto the dialog's command stack and refreshes the editor.
   *
   * @param command Edit to run.
   */
  protected commandPush(command: UndoCommand): void {
    objectPropertiesTabCommandPush(this.context, command);
  }
}

/**
 * Pushes one tab edit onto the dialog's command stack and refreshes the editor.
 *
 * @param context Tab context whose stack receives the edit.
 * @param command Edit to run.
 */
export function objectPropertiesTabCommandPush(context: ObjectPropertiesTabContext, command: UndoCommand): void {
  context.commandStack.push(command);
  context.markDirty();
}
