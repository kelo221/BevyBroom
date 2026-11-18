import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import type { PanelProperties } from '@/ui/properties/panel_properties.js';
import {
  getRegistryObjectPropertiesTab,
  type ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { CommandObjectComments } from '@/ui/object_properties/commands/command_object_comments.js';
import { ObjectPropertiesObjectPicker } from '@/ui/object_properties/picking/object_properties_object_picker.js';
import {
  DialogObjectPropertiesTabHost,
  type DialogObjectPropertiesTabContextShared,
} from '@/ui/object_properties/dialog_object_properties_tab_host.js';
import { SectionObjectPropertiesChrome } from './section_object_properties_chrome.js';

/** Editor services the Properties section edits the selection through. */
export interface SectionObjectPropertiesDependencies {
  /** Selection whose objects the section shows. */
  readonly selectionManager: ManagerSelection;
  /** Undo stack every edit is recorded on. */
  readonly commandStack: CommandStack;
  /** Scene root the tabs search for targets. */
  readonly worldObject: THREE.Group;
  /** Refreshes the views after the world changed. */
  readonly afterWorldMutation: () => void;
  /** Refreshes visuals after a transform edit. */
  readonly afterTransformCommit: (objects: readonly THREE.Object3D[]) => void;
  /** Returns the transform and material panel the Properties tab shows. */
  readonly propertiesPanelRead: () => PanelProperties | null;
  /** Frames the selection in every view. */
  readonly selectionFrame: () => void;
  /** Shows the dock the section lives in. */
  readonly dockReveal: () => void;
  /** Tabs to show; the registered tabs when omitted. */
  readonly tabRegistrations?: readonly ObjectPropertiesTabRegistration[];
}

/** Title shown while nothing is selected. */
const SECTION_OBJECT_PROPERTIES_TITLE = 'Properties';

/**
 * Properties section of the right dock: always shows the selected objects in
 * the Object Properties tabs. Every edit applies at once as its own undo step,
 * and the section follows the selection.
 */
export class SectionObjectProperties {
  private readonly dependencies: SectionObjectPropertiesDependencies;
  private readonly picker: ObjectPropertiesObjectPicker;
  private readonly tabHost: DialogObjectPropertiesTabHost;
  private readonly chrome: SectionObjectPropertiesChrome;
  private readonly selectionChangedListener: () => void;
  private readonly stackChangedListener: () => void;
  private editedObjects: readonly THREE.Object3D[];

  /**
   * Builds the section and starts following the selection.
   *
   * @param dependencies Editor services.
   */
  constructor(dependencies: SectionObjectPropertiesDependencies) {
    this.dependencies = dependencies;
    this.editedObjects = [];
    this.picker = new ObjectPropertiesObjectPicker(dependencies.selectionManager);
    this.tabHost = new DialogObjectPropertiesTabHost(
      dependencies.tabRegistrations ?? getRegistryObjectPropertiesTab().listOrdered(),
      this.tabContextSharedCreate(),
    );
    this.chrome = new SectionObjectPropertiesChrome(this.tabHost.getElement());
    this.selectionChangedListener = () => this.selectionChangedHandle();
    this.stackChangedListener = () => this.refresh();
    dependencies.selectionManager.onSelectionChanged(this.selectionChangedListener);
    dependencies.commandStack.onStackChanged(this.stackChangedListener);
    this.selectionChangedHandle();
  }

  /**
   * Returns the section element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.chrome.getElement();
  }

  /**
   * Shows the dock, scrolls the section into view and moves the keyboard focus
   * to it.
   *
   * @returns True when objects are selected.
   */
  reveal(): boolean {
    this.dependencies.dockReveal();
    this.chrome.reveal();
    return this.editedObjects.length > 0;
  }

  /**
   * Returns the element editors opened from a field are shown in, below the
   * tabs.
   *
   * @returns Field editor host element.
   */
  fieldEditorHostRead(): HTMLElement {
    return this.chrome.fieldEditorHostRead();
  }

  /**
   * Returns the objects the section shows.
   *
   * @returns Selected objects.
   */
  editedObjectsRead(): readonly THREE.Object3D[] {
    return this.editedObjects;
  }

  /**
   * Returns the tab host.
   *
   * @returns Tab host.
   */
  tabHostRead(): DialogObjectPropertiesTabHost {
    return this.tabHost;
  }

  /**
   * Shows a tab.
   *
   * @param tabId Tab id.
   * @returns True when the tab exists and applies to the selection.
   */
  tabShow(tabId: string): boolean {
    return this.tabHost.tabBookRead().tabShow(tabId);
  }

  /**
   * Returns the shown tab.
   *
   * @returns Tab id, or null.
   */
  tabActiveRead(): string | null {
    return this.tabHost.tabBookRead().getActiveTabId();
  }

  /**
   * Returns the ids of the tabs that apply to the selection, in order.
   *
   * @returns Tab ids.
   */
  tabIdsRead(): string[] {
    return this.tabHost.tabBookRead().visibleTabIdsList();
  }

  /**
   * Writes the comments of the selected objects as one undo step.
   *
   * @param comments New comments.
   * @returns True when the comments changed.
   */
  commentsWrite(comments: string): boolean {
    const command = new CommandObjectComments(this.editedObjects, comments);
    if (this.editedObjects.length === 0 || !command.hasChanges()) {
      return false;
    }
    this.dependencies.commandStack.push(command);
    this.dependencies.afterWorldMutation();
    return true;
  }

  /** Stops following the selection and removes the section. */
  dispose(): void {
    this.picker.cancel();
    this.dependencies.selectionManager.offSelectionChanged(this.selectionChangedListener);
    this.dependencies.commandStack.offStackChanged(this.stackChangedListener);
    this.tabHost.deactivate();
    this.tabHost.dispose();
    this.chrome.dispose();
  }

  /**
   * Builds the context every tab edits through.
   *
   * @returns Shared tab context.
   */
  private tabContextSharedCreate(): DialogObjectPropertiesTabContextShared {
    const dependencies = this.dependencies;
    return {
      selectedObjectsRead: () => this.editedObjects,
      worldObjectRead: () => dependencies.worldObject,
      markDirty: () => dependencies.afterWorldMutation(),
      commandStack: dependencies.commandStack,
      afterTransformCommit: (objects) => dependencies.afterTransformCommit(objects),
      propertiesPanelRead: () => dependencies.propertiesPanelRead(),
      objectPickBegin: (onPicked) => this.picker.begin(onPicked),
      objectsMark: (objects, shouldFrame) => this.objectsMark(objects, shouldFrame),
    };
  }

  /**
   * Selects objects a tab points at and frames them when asked.
   *
   * @param objects Objects to select.
   * @param shouldFrame True to frame them.
   */
  private objectsMark(objects: readonly THREE.Object3D[], shouldFrame: boolean): void {
    if (objects.length === 0) {
      return;
    }
    this.dependencies.selectionManager.setSelection(selectionMeshesFromHierarchyCollect(objects), [...objects]);
    if (shouldFrame) {
      this.dependencies.selectionFrame();
    }
  }

  /**
   * Shows the newly selected objects, unless the change came from picking a
   * target object.
   */
  private selectionChangedHandle(): void {
    if (this.picker.selectionChangeConsume()) {
      return;
    }
    this.editedObjects = this.dependencies.selectionManager.getInspectorObjects();
    if (this.editedObjects.length === 0) {
      this.tabHost.deactivate();
    }
    this.refresh();
  }

  /** Rewrites the title and the tabs from the selected objects. */
  private refresh(): void {
    const hasObjects = this.editedObjects.length > 0;
    this.chrome.titleWrite(SectionObjectProperties.titleTextCreate(this.editedObjects));
    this.chrome.emptyShownSet(!hasObjects);
    if (hasObjects) {
      this.tabHost.refresh(this.editedObjects);
    }
  }

  /**
   * Builds the title for the selected objects.
   *
   * @param objects Selected objects.
   * @returns Title text.
   */
  private static titleTextCreate(objects: readonly THREE.Object3D[]): string {
    const [first] = objects;
    if (!first) {
      return SECTION_OBJECT_PROPERTIES_TITLE;
    }
    if (objects.length > 1) {
      return `${SECTION_OBJECT_PROPERTIES_TITLE}: ${objects.length} objects`;
    }
    const classLabel = EntityClassRegistry.classOf(first)?.label ?? 'Object';
    return `${SECTION_OBJECT_PROPERTIES_TITLE}: ${first.name || classLabel}`;
  }
}
