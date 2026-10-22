import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** File menu: new, save, load, import, export and preferences. */
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
      this.actionEntry(context, 'Open Project…', () => void actions.gameProjectWorkbenchRead().projectOpen(null), {
        isEnabled: () => actions.gameProjectWorkbenchRead().isAvailable(),
      }),
      this.recentProjectsSubmenuBuild(context),
      this.separatorEntry(),
      this.importSubmenuBuild(context),
      this.exportSubmenuBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Preferences…', () => actions.onToggleSettingsDialog()),
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
