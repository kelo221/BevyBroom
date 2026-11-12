import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { PanelProperties } from '@/ui/properties/panel_properties.js';
import { registryObjectPropertiesTabBuiltinList } from './registry_object_properties_tab_builtin.js';

/**
 * Context passed to each mounted tab inside the floating Object Properties
 * dialog.
 */
export interface ObjectPropertiesTabContext {
  /** Element the tab builds its page into. */
  readonly container: HTMLElement;
  /** Returns the objects the dialog edits. */
  readonly selectedObjectsRead: () => readonly THREE.Object3D[];
  /** Returns the scene root. */
  readonly worldObjectRead: () => THREE.Group;
  /** Refreshes the editor and the dialog after a tab changed the scene. */
  readonly markDirty: () => void;
  /** Stack every tab edit is pushed to; the dialog session groups them. */
  readonly commandStack: CommandStack;
  /** Refreshes the editor after a tab changed object transforms. */
  readonly afterTransformCommit: (objects: readonly THREE.Object3D[]) => void;
  /** Returns the shared properties panel, or null when the editor has none. */
  readonly propertiesPanelRead: () => PanelProperties | null;
  /**
   * Lets the user pick one object in the viewport without changing the edited
   * selection, then calls back with the picked object.
   */
  readonly objectPickBegin: (onPicked: (object: THREE.Object3D) => void) => void;
  /**
   * Selects objects in the editor (Hammer's Mark), optionally framing them in
   * the views; does nothing for an empty list.
   */
  readonly objectsMark: (objects: readonly THREE.Object3D[], shouldFrame: boolean) => void;
}

/** Mounted controller returned by an Object Properties tab factory. */
export interface ObjectPropertiesTabInstance {
  /** Refreshes the tab UI for the given selection. */
  refresh(selectedObjects: readonly THREE.Object3D[]): void;
  /** Releases anything the tab borrowed while the dialog was open. */
  deactivate?(): void;
  /** Disposes DOM listeners and child widgets owned by the tab. */
  dispose(): void;
}

/** Registration descriptor for one tab in the floating Object Properties dialog. */
export interface ObjectPropertiesTabRegistration {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly mount: (context: ObjectPropertiesTabContext) => ObjectPropertiesTabInstance;
  /**
   * Returns false when the tab does not apply to the selection, which hides its
   * button. Tabs without it apply to every selection.
   */
  readonly appliesToIs?: (selectedObjects: readonly THREE.Object3D[]) => boolean;
}

/**
 * Extensible registry of tabs shown in the floating Object Properties dialog
 * (Class Info, Outputs, Inputs, Flags, VisGroup).
 */
export class RegistryObjectPropertiesTab {
  private readonly entries: Map<string, ObjectPropertiesTabRegistration>;

  /**
   * Creates an Object Properties tab registry.
   *
   * @param initialRegistrations Tabs registered right away; none by default.
   */
  constructor(initialRegistrations: readonly ObjectPropertiesTabRegistration[] = []) {
    this.entries = new Map();
    initialRegistrations.forEach((registration) => this.register(registration));
  }

  /**
   * Registers or replaces a tab definition by id.
   *
   * @param registration Tab descriptor to register.
   */
  register(registration: ObjectPropertiesTabRegistration): void {
    this.entries.set(registration.id, registration);
  }

  /**
   * Unregisters a tab definition by id.
   *
   * @param id Tab id to remove.
   */
  unregister(id: string): void {
    this.entries.delete(id);
  }

  /**
   * Returns all registered tabs sorted by ascending order.
   *
   * @returns Ordered tab registrations.
   */
  listOrdered(): ObjectPropertiesTabRegistration[] {
    return Array.from(this.entries.values()).sort((a, b) => a.order - b.order);
  }

  /** Clears all registered tabs. */
  clear(): void {
    this.entries.clear();
  }
}

let sharedObjectPropertiesTabRegistry: RegistryObjectPropertiesTab | null = null;

/**
 * Returns the shared Object Properties tab registry, holding the built-in tabs
 * from its first use on.
 *
 * @returns Shared RegistryObjectPropertiesTab.
 */
export function getRegistryObjectPropertiesTab(): RegistryObjectPropertiesTab {
  sharedObjectPropertiesTabRegistry ??= new RegistryObjectPropertiesTab(registryObjectPropertiesTabBuiltinList());
  return sharedObjectPropertiesTabRegistry;
}
