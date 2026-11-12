import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/**
 * File menu: new, save, load, projects, project levels, Build Level, import,
 * export and preferences.
 */
export class ShellMenuFile extends ShellMenu {
  readonly label = 'File';

  /**
   * Builds the File menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      this.actionEntry(context, 'New', () => actions.onNewScene()),
      this.separatorEntry(),
      this.actionEntry(context, 'Save', () => actions.onSaveScene(), { shortcutAction: 'save' }),
      this.actionEntry(context, 'Save As…', () => actions.onSaveSceneAs(), { shortcutAction: 'save_as' }),
      this.actionEntry(context, 'Load', () => actions.onLoadScene(), { shortcutAction: 'load' }),
      this.separatorEntry(),
      ...this.projectEntriesBuild(context),
      this.separatorEntry(),
      this.importSubmenuBuild(context),
      this.exportSubmenuBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Preferences…', () => actions.onToggleSettingsDialog(), {
        nativeApplicationSlot: 'settings',
      }),
    ];
  }

  /**
   * Builds the Open Project, Recent Projects and Build Level rows.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  private projectEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const workbenchRead = context.toolbarActions.gameProjectWorkbenchRead;
    return [
      this.actionEntry(context, 'Open Project…', () => void workbenchRead().projectOpen(null), {
        isEnabled: () => workbenchRead().isAvailable(),
      }),
      this.recentProjectsSubmenuBuild(context),
      ...this.projectLevelEntriesBuild(context),
      this.actionEntry(context, 'Build Level', () => void workbenchRead().levelBuild(), {
        isEnabled: () => workbenchRead().statusRead()?.project != null,
      }),
    ];
  }

  /**
   * Builds the Level Browser, Save Level to Project and Save As New Level rows.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  private projectLevelEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const levelActionsRead = context.toolbarActions.projectLevelActionsRead;
    const isProjectOpen = (): boolean =>
      context.toolbarActions.gameProjectWorkbenchRead().statusRead()?.project != null;
    return [
      this.actionEntry(context, 'Level Browser…', () => levelActionsRead().levelBrowserReveal(false), {
        isChecked: () => context.dockCommands.isFloatingWindowOpen('level_browser'),
      }),
      this.actionEntry(context, 'Save Level to Project', () => void levelActionsRead().levelSave(true), {
        isEnabled: () => levelActionsRead().serviceRead().openLevelRead() !== null,
      }),
      this.actionEntry(context, 'Save As New Level…', () => levelActionsRead().levelBrowserReveal(true), {
        isEnabled: isProjectOpen,
      }),
    ];
  }

  /**
   * Builds the Recent Projects submenu, read again whenever the menu opens.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private recentProjectsSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return {
      kind: 'submenu',
      label: 'Recent Projects',
      children: [],
      childrenResolve: () =>
        actions
          .gameProjectWorkbenchRead()
          .recentProjectFilesRead()
          .map((projectFile) =>
            this.actionEntry(
              context,
              projectFile,
              () => void actions.gameProjectWorkbenchRead().projectOpen(projectFile),
            ),
          ),
      isEnabled: () => actions.gameProjectWorkbenchRead().recentProjectFilesRead().length > 0,
    };
  }

  /**
   * Builds the Import submenu.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private importSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return {
      kind: 'submenu',
      label: 'Import',
      children: [
        this.actionEntry(context, 'Valve Map Format 2006 (.vmf)…', () => actions.onImportVmf()),
        this.actionEntry(context, 'Wavefront OBJ (.obj)…', () => actions.onImportObj()),
      ],
    };
  }

  /**
   * Builds the Export submenu.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private exportSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return {
      kind: 'submenu',
      label: 'Export',
      children: [
        this.actionEntry(context, 'Export GLTF (.glb)…', () => actions.onExportGlb(), { shortcutAction: 'export_glb' }),
        this.actionEntry(context, 'Wavefront OBJ/MTL (.obj)…', () => actions.onExportObj()),
        this.actionEntry(context, 'Autodesk FBX (.fbx)…', () => actions.onExportFbx()),
      ],
    };
  }
}
