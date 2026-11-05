import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { applyFloatingPanelToolChrome } from '@/ui/floating_panel/panel_floating_tool_chrome.js';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';
import type { PanelProperties } from '@/ui/properties/panel_properties.js';
import {
  getRegistryObjectPropertiesTab,
  type ObjectPropertiesTabRegistration,
} from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesObjectPicker } from './picking/object_properties_object_picker.js';
import { ObjectPropertiesSession } from './session/object_properties_session.js';
import {
  DialogObjectPropertiesTabHost,
  type DialogObjectPropertiesTabContextShared,
} from './dialog_object_properties_tab_host.js';

/** Editor services the Object Properties dialog edits through. */
export interface DialogObjectPropertiesDependencies {
  readonly selectionManager: ManagerSelection;
  readonly commandStack: CommandStack;
  readonly worldObject: THREE.Group;
  /** Refreshes the editor after the scene changed. */
  readonly afterWorldMutation: () => void;
  /** Refreshes the editor after object transforms changed. */
  readonly afterTransformCommit: (objects: readonly THREE.Object3D[]) => void;
  /** Returns the shared properties panel, or null when the editor has none. */
  readonly propertiesPanelRead: () => PanelProperties | null;
  /** Frames the current selection in the views. */
  readonly selectionFrame: () => void;
  /** Tabs to show; the shared registry's tabs when omitted. */
  readonly tabRegistrations?: readonly ObjectPropertiesTabRegistration[];
}

/** Text of the dialog title in front of the edited object's name. */
const DIALOG_OBJECT_PROPERTIES_TITLE_PREFIX = 'Object Properties';

/** Width of the dialog, wide enough for the two Class Info columns. */
const DIALOG_OBJECT_PROPERTIES_WIDTH = '680px';

/**
 * Floating, non-modal Object Properties window. Edits show live in the editor
 * and the game; Apply keeps them as one undo step and Cancel, the close button
 * or Escape undo the edits not kept yet, without history. Changing the
 * selection while open applies, then edits the new selection. A command another
 * part of the editor records while open keeps the dialog's edits so far as one
 * undo step below it.
 */
export class DialogObjectProperties extends PanelFloating {
  private readonly dependencies: DialogObjectPropertiesDependencies;
  private readonly session: ObjectPropertiesSession;
  private readonly picker: ObjectPropertiesObjectPicker;
  private readonly tabHost: DialogObjectPropertiesTabHost;
  private readonly titleElement: HTMLElement;
  private readonly selectionChangedListener: () => void;
  private readonly stackChangedListener: () => void;
  private editedObjects: readonly THREE.Object3D[];

  /**
   * Creates the hidden dialog and mounts its tabs.
   *
   * @param host Parent element of floating windows.
   * @param dependencies Editor services the dialog edits through.
   */
  constructor(host: HTMLElement, dependencies: DialogObjectPropertiesDependencies) {
    super(host, { corner: 'top-left', centered: true, draggable: true, closeOnEscape: true });
    this.dependencies = dependencies;
    this.editedObjects = [];
    this.session = new ObjectPropertiesSession(dependencies.commandStack, () => dependencies.afterWorldMutation());
    this.picker = new ObjectPropertiesObjectPicker(dependencies.selectionManager);
    this.selectionChangedListener = () => this.selectionChangedHandle();
    this.stackChangedListener = () => this.refresh();
    this.tabHost = new DialogObjectPropertiesTabHost(
      dependencies.tabRegistrations ?? getRegistryObjectPropertiesTab().listOrdered(),
      this.tabContextSharedCreate(),
    );
    this.titleElement = this.shellBuild();
  }

  /**
   * Opens the dialog on the current selection; does nothing when nothing is
   * selected.
   *
   * @returns True when the dialog is open afterwards.
   */
  open(): boolean {
    if (this.isOpen()) {
      this.show();
      return true;
    }
    const objects = this.dependencies.selectionManager.getInspectorObjects();
    if (objects.length === 0) {
      return false;
    }
    this.editedObjects = objects;
    this.session.begin();
    this.listenersAdd();
    this.show();
    this.refresh();
    return true;
  }

  /** Keeps the edits as one undo step and closes the dialog. */
  apply(): void {
    this.session.apply();
    this.hide(true);
  }

  /** Undoes the edits not kept yet and closes the dialog. */
  cancel(): void {
    this.hide(true);
  }

  /**
   * Returns the objects the dialog edits.
   *
   * @returns Edited objects.
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
   * Shows one tab.
   *
   * @param tabId Tab id.
   * @returns True when the tab exists.
   */
  tabShow(tabId: string): boolean {
    return this.tabHost.tabBookRead().tabShow(tabId);
  }

  /**
   * Returns the id of the visible tab.
   *
   * @returns Active tab id, or null without tabs.
   */
  tabActiveRead(): string | null {
    return this.tabHost.tabBookRead().getActiveTabId();
  }

  /**
   * Lists the tab ids in order.
   *
   * @returns Tab ids.
   */
  tabIdsRead(): string[] {
    return this.tabHost.tabBookRead().tabIdsList();
  }

  /** Cancels any open session, disposes the tabs and removes the window. */
  override dispose(): void {
    super.dispose();
    this.tabHost.dispose();
  }

  /** Cancels the session and lets the tabs release borrowed parts. */
  protected override onAfterHide(): void {
    this.picker.cancel();
    this.listenersRemove();
    this.session.cancel();
    this.tabHost.deactivate();
    this.editedObjects = [];
  }

  /**
   * Builds the context every tab receives.
   *
   * @returns Shared tab context.
   */
  private tabContextSharedCreate(): DialogObjectPropertiesTabContextShared {
    const dependencies = this.dependencies;
    return {
      selectedObjectsRead: () => this.editedObjects,
      worldObjectRead: () => dependencies.worldObject,
      markDirty: () => dependencies.afterWorldMutation(),
      commandStack: this.session.commandStackRead(),
      afterTransformCommit: (objects) => dependencies.afterTransformCommit(objects),
      propertiesPanelRead: () => dependencies.propertiesPanelRead(),
      objectPickBegin: (onPicked) => this.picker.begin(onPicked),
      objectsMark: (objects, shouldFrame) => this.objectsMark(objects, shouldFrame),
    };
  }

  /**
   * Selects objects for a tab, which applies the edits and retargets the
   * dialog, and frames them when asked.
   *
   * @param objects Objects to select; nothing happens for an empty list.
   * @param shouldFrame True to frame the new selection in the views.
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

  /** Follows selection and history changes while open. */
  private listenersAdd(): void {
    this.dependencies.selectionManager.onSelectionChanged(this.selectionChangedListener);
    this.dependencies.commandStack.onStackChanged(this.stackChangedListener);
  }

  /** Stops following selection and history changes. */
  private listenersRemove(): void {
    this.dependencies.selectionManager.offSelectionChanged(this.selectionChangedListener);
    this.dependencies.commandStack.offStackChanged(this.stackChangedListener);
  }

  /** Applies the edits and retargets the dialog when the selection changed. */
  private selectionChangedHandle(): void {
    if (this.picker.selectionChangeConsume()) {
      return;
    }
    this.session.apply();
    const objects = this.dependencies.selectionManager.getInspectorObjects();
    if (objects.length === 0) {
      this.hide(true);
      return;
    }
    this.editedObjects = objects;
    this.session.begin();
    this.refresh();
  }

  /** Shows the edited objects in the title and every tab. */
  private refresh(): void {
    if (!this.isOpen()) {
      return;
    }
    this.titleElement.textContent = DialogObjectProperties.titleTextCreate(this.editedObjects);
    this.tabHost.refresh(this.editedObjects);
  }

  /**
   * Builds the title bar, header, tabs and footer.
   *
   * @returns Title text element.
   */
  private shellBuild(): HTMLElement {
    this.root.classList.add('dialog-object-properties');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', DIALOG_OBJECT_PROPERTIES_TITLE_PREFIX);
    applyFloatingPanelToolChrome(this.root, {
      width: DIALOG_OBJECT_PROPERTIES_WIDTH,
      maxHeight: 'calc(100vh - 48px)',
      borderBox: true,
      overflowHidden: true,
    });
    const titleParts = this.createStandardTitleBar({ titleText: DIALOG_OBJECT_PROPERTIES_TITLE_PREFIX });
    this.root.append(titleParts.bar, this.bodyCreate(), this.footerCreate());
    return titleParts.title;
  }

  /**
   * Creates the scrolling body holding the tab book.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'dialog-object-properties-body';
    body.style.flex = '1 1 auto';
    body.style.minHeight = '0';
    body.style.overflowY = 'auto';
    body.appendChild(this.tabHost.getElement());
    return body;
  }

  /**
   * Creates the footer with Cancel and Apply.
   *
   * @returns Footer element.
   */
  private footerCreate(): HTMLElement {
    return this.barCreate(
      [
        this.actionButtonCreate('Cancel', 'cancel', () => this.cancel()),
        this.actionButtonCreate('Apply', 'apply', () => this.apply()),
      ],
      'flex-end',
    );
  }

  /**
   * Creates a row of buttons.
   *
   * @param buttons Buttons in order.
   * @param justifyContent Flex alignment of the buttons.
   * @returns Row element.
   */
  private barCreate(buttons: readonly HTMLButtonElement[], justifyContent: string): HTMLElement {
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.justifyContent = justifyContent;
    bar.style.alignItems = 'center';
    bar.style.gap = '8px';
    bar.style.padding = '8px 10px 10px';
    bar.style.flexShrink = '0';
    bar.append(...buttons);
    return bar;
  }

  /**
   * Creates one dialog action button.
   *
   * @param text Button text.
   * @param action Action name stored on the button for lookups.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private actionButtonCreate(text: string, action: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.dataset['objectPropertiesAction'] = action;
    styleFloatingPanelChromeButton(button);
    button.style.minWidth = '72px';
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Builds the window title from the edited objects: the name of a single
   * object, else its class, else the number of objects.
   *
   * @param objects Edited objects.
   * @returns Title text.
   */
  private static titleTextCreate(objects: readonly THREE.Object3D[]): string {
    const [first] = objects;
    if (!first || objects.length > 1) {
      return `${DIALOG_OBJECT_PROPERTIES_TITLE_PREFIX}: ${objects.length} objects`;
    }
    const classLabel = EntityClassRegistry.classOf(first)?.label ?? 'Object';
    return `${DIALOG_OBJECT_PROPERTIES_TITLE_PREFIX}: ${first.name || classLabel}`;
  }
}
