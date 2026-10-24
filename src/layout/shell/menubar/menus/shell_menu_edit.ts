import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import { selectionQueriesList } from '@/selection/query/selection_query_registry.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** Edit menu: history, selection, grouping, CSG and alignment commands. */
export class ShellMenuEdit extends ShellMenu {
  readonly label = 'Edit';

  /**
   * Builds the Edit menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      this.actionEntry(context, 'Undo', () => actions.onUndo(), { shortcutAction: 'undo' }),
      this.actionEntry(context, 'Redo', () => actions.onRedo(), { shortcutAction: 'redo' }),
      this.separatorEntry(),
      ...this.clipboardEntriesBuild(context),
      this.actionEntry(context, 'Duplicate', () => actions.onDuplicateSelected(), { shortcutAction: 'duplicate' }),
      this.actionEntry(context, 'Delete', () => actions.onDeleteSelected(), { shortcutAction: 'delete_selected' }),
      this.separatorEntry(),
      ...this.selectionEntriesBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Group', () => actions.onGroupSelected(), { shortcutAction: 'group' }),
      this.actionEntry(context, 'Ungroup', () => actions.onUngroupSelected(), { shortcutAction: 'ungroup' }),
      this.separatorEntry(),
      ...this.brushEntriesBuild(context),
      this.csgSubmenuBuild(context),
      this.alignSubmenuBuild(context),
    ];
  }

  /**
   * Builds the Cut, Copy, Paste and Paste at Original Position entries. Cut and
   * Copy are enabled only while something is selected; the system clipboard
   * keys are fixed, Paste at Original Position is configurable.
   *
   * @param context Actions and docks the entries run.
   * @returns Clipboard entries.
   */
  private clipboardEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    const isEnabled = (): boolean => window.clipboardSelectionHasObjectsIs();
    return [
      this.actionEntry(context, 'Cut', () => window.clipboardCut(), { isEnabled, shortcutText: 'Ctrl+X' }),
      this.actionEntry(context, 'Copy', () => window.clipboardCopy(), { isEnabled, shortcutText: 'Ctrl+C' }),
      this.actionEntry(context, 'Paste', () => window.clipboardPaste(), { shortcutText: 'Ctrl+V' }),
      this.actionEntry(context, 'Paste at Original Position', () => window.clipboardPasteAtOriginalPosition(), {
        shortcutAction: 'paste_original',
      }),
    ];
  }

  /**
   * Builds the Select All, Select None and Select submenu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Selection entries.
   */
  private selectionEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    return [
      this.actionEntry(context, 'Select All', () => window.selectAll(), { shortcutAction: 'select_all' }),
      this.actionEntry(context, 'Select None', () => window.selectNone(), { shortcutAction: 'select_none' }),
      this.selectSubmenuBuild(context),
    ];
  }

  /**
   * Builds the Select submenu of selection queries; queries that start from the
   * selection are enabled only while something is selected.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private selectSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const window = context.windowActions;
    return {
      kind: 'submenu',
      label: 'Select',
      children: selectionQueriesList().map((query) =>
        this.actionEntry(context, query.label, () => window.selectionQueryRun(query.id), {
          isEnabled: () => !query.needsSelection || window.selectionHasObjectsIs(),
        }),
      ),
    };
  }

  /**
   * Builds the CSG submenu, enabled only when the selection supports booleans.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private csgSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    const isEnabled = (): boolean => actions.canRunCsgBoolean();
    return {
      kind: 'submenu',
      label: 'CSG',
      children: [
        this.actionEntry(context, 'Union', () => actions.onCsgUnion(), { isEnabled }),
        this.actionEntry(context, 'Subtract', () => actions.onCsgSubtract(), { isEnabled }),
        this.actionEntry(context, 'Intersect', () => actions.onCsgIntersect(), { isEnabled }),
        this.separatorEntry(),
        this.actionEntry(context, 'Hollow', () => context.windowActions.solidBrushToolsRead()?.hollow()),
        this.actionEntry(context, 'Convex Merge', () => context.windowActions.solidBrushToolsRead()?.convexMerge()),
      ],
    };
  }

  /**
   * Builds the Flip Horizontally, Flip Vertically and Snap Vertices entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Brush editing entries.
   */
  private brushEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const brushTools = this.brushToolsReader(context);
    return [
      this.actionEntry(context, 'Flip Horizontally', () => brushTools()?.flip('horizontal')),
      this.actionEntry(context, 'Flip Vertically', () => brushTools()?.flip('vertical')),
      {
        kind: 'submenu',
        label: 'Snap Vertices',
        children: [
          this.actionEntry(context, 'To Grid', () => brushTools()?.snapVertices('grid')),
          this.actionEntry(context, 'To Whole Units', () => brushTools()?.snapVertices('integer')),
        ],
      },
      this.separatorEntry(),
    ];
  }

  /**
   * Returns a reader of the solid brush tools.
   *
   * @param context Actions the tools come from.
   * @returns Function returning the brush tools, or null before the editor is
   *   ready.
   */
  private brushToolsReader(context: ShellMenuContext): () => HandlerSolidBrushTools | null {
    return () => context.windowActions.solidBrushToolsRead();
  }

  /**
   * Builds the Align submenu.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private alignSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return {
      kind: 'submenu',
      label: 'Align',
      children: [
        this.actionEntry(context, 'Origin', () => actions.onAlignToOrigin(), { shortcutAction: 'align_origin' }),
        this.actionEntry(context, 'Grid Center', () => actions.onAlignToGridCenter()),
        this.actionEntry(context, 'To Object', () => actions.onAlignToObject()),
      ],
    };
  }
}
