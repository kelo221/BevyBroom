import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { ShellInspector } from '@/layout/shell/inspector/shell_inspector.js';
import {
  ShellInspectorObjectBar,
  type ShellInspectorObjectBarHandlers,
} from '@/layout/shell/inspector/shell_inspector_object_bar.js';
import { PanelVisGroups } from '@/visgroup/ui/panel_visgroups.js';
import type { VisGroupSharedServices } from '@/visgroup/visgroup_shared_services.js';
import { PanelPrefabDock } from '@/prefab/ui/panel_prefab_dock.js';
import type { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';

/** Inspector and editor services the Hammer bar sections are built from. */
export interface ShellHammerBarMountOptions {
  /** Inspector whose Hammer bar slots receive the sections. */
  readonly inspector: ShellInspector;
  /** Browse, Replace and texture lookup actions of the Object Bar. */
  readonly objectBarHandlers: ShellInspectorObjectBarHandlers;
  /** Scene root the VisGroups and prefabs act on. */
  readonly worldObject: THREE.Object3D;
  /** Object selection the VisGroups mark and the prefabs capture. */
  readonly selectionManager: ManagerSelection;
  /** VisGroup and Cordon services. */
  readonly visGroupServices: VisGroupSharedServices;
  /** Prefab catalog the prefab section lists and fills. */
  readonly prefabCatalogStore: PrefabCatalogStore;
  /** Undo history receiving the VisGroup and prefab edits. */
  readonly commandStack: CommandStack;
  /** Refreshes the editor after the map content or its visibility changed. */
  readonly afterWorldMutation: () => void;
}

/**
 * Mounts the Hammer bar sections into the inspector: the Object Bar, the
 * VisGroups panel and the prefab and Move selected panel, and disposes them
 * together.
 */
export class ShellHammerBarMount {
  /** Select filter and Current texture strip. */
  readonly objectBar: ShellInspectorObjectBar;
  /** User, Auto and Cordon VisGroups panel. */
  readonly visGroupsPanel: PanelVisGroups;
  /** Move selected, Categories, Objects and Create Prefab panel. */
  readonly prefabPanel: PanelPrefabDock;

  /**
   * Creates and mounts the Hammer bar sections.
   *
   * @param options Inspector and editor services.
   */
  constructor(options: ShellHammerBarMountOptions) {
    this.objectBar = new ShellInspectorObjectBar(options.objectBarHandlers);
    options.inspector.slotRead('hammer_object_bar').appendChild(this.objectBar.getElement());
    this.visGroupsPanel = this.visGroupsPanelCreate(options);
    this.prefabPanel = this.prefabPanelCreate(options);
  }

  /** Disposes every Hammer bar section. */
  dispose(): void {
    this.prefabPanel.dispose();
    this.visGroupsPanel.dispose();
    this.objectBar.dispose();
  }

  /**
   * Pushes a command onto the undo history, which runs it, and refreshes the
   * editor.
   *
   * @param options Inspector and editor services.
   * @param command Undoable command to run.
   */
  private commandRun(options: ShellHammerBarMountOptions, command: UndoCommand): void {
    options.commandStack.push(command);
    options.afterWorldMutation();
  }

  /**
   * Creates the VisGroups panel in its Hammer bar slot.
   *
   * @param options Inspector and editor services.
   * @returns VisGroups panel.
   */
  private visGroupsPanelCreate(options: ShellHammerBarMountOptions): PanelVisGroups {
    const services = options.visGroupServices;
    return new PanelVisGroups(options.inspector.slotRead('hammer_visgroups'), {
      store: services.visGroupStore,
      cordonState: services.cordonState,
      cordonApplier: services.cordonFilterApplier,
      worldRoot: options.worldObject,
      selectionTarget: options.selectionManager,
      commandRun: (command) => this.commandRun(options, command),
      afterVisibilityChange: () => options.afterWorldMutation(),
    });
  }

  /**
   * Creates the prefab and Move selected panel in its Hammer bar slot.
   *
   * @param options Inspector and editor services.
   * @returns Prefab panel.
   */
  private prefabPanelCreate(options: ShellHammerBarMountOptions): PanelPrefabDock {
    return new PanelPrefabDock(
      options.inspector.slotRead('hammer_prefabs'),
      {
        selectedObjectsRead: () => options.selectionManager.getInspectorObjects(),
        worldRootRead: () => options.worldObject,
        commandRun: (command) => this.commandRun(options, command),
      },
      options.prefabCatalogStore,
    );
  }
}
