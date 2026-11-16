import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import { selectionQueriesList } from '@/selection/query/selection_query_registry.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { formatKeyboardShortcut } from '@/settings/keyboard/keyboard_shortcut_format.js';

/**
 * Builds the label of a fixed primary modifier shortcut such as Ctrl+C, or ⌘C
 * on macOS.
 *
 * @param code Keyboard event code of the key.
 * @returns Shortcut label.
 */
function shellMenuEditPrimaryShortcutLabel(code: string): string {
  return formatKeyboardShortcut({ code, ctrl: true, shift: false, alt: false, meta: false });
}

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
    return [
      ...this.historyEntriesBuild(context),
      this.separatorEntry(),
      ...this.clipboardEntriesBuild(context),
      ...this.objectEntriesBuild(context),
      this.separatorEntry(),
      ...this.selectionEntriesBuild(context),
      this.separatorEntry(),
      ...this.groupEntriesBuild(context),
      this.separatorEntry(),
      ...this.brushEntriesBuild(context),
      this.csgSubmenuBuild(context),
      this.alignSubmenuBuild(context),
    ];
  }

  /**
   * Builds the Undo and Redo entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Undo and Redo entries.
   */
  private historyEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      this.actionEntry(context, 'Undo', () => actions.onUndo(), { shortcutAction: 'undo', textEditCommand: 'undo' }),
      this.actionEntry(context, 'Redo', () => actions.onRedo(), { shortcutAction: 'redo', textEditCommand: 'redo' }),
    ];
  }

  /**
   * Builds the Duplicate, Delete and Object Properties entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Entries that act on the selected objects.
   */
  objectEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      this.actionEntry(context, 'Duplicate', () => actions.onDuplicateSelected(), { shortcutAction: 'duplicate' }),
      this.actionEntry(context, 'Delete', () => actions.onDeleteSelected(), {
        shortcutAction: 'delete_selected',
        textEditCommand: 'delete',
      }),
      this.objectPropertiesEntryBuild(context),
    ];
  }

  /**
   * Builds the Group and Ungroup entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Group and Ungroup entries.
   */
  groupEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      this.actionEntry(context, 'Group', () => actions.onGroupSelected(), { shortcutAction: 'group' }),
      this.actionEntry(context, 'Ungroup', () => actions.onUngroupSelected(), { shortcutAction: 'ungroup' }),
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
  clipboardEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    const isEnabled = (): boolean => window.clipboardSelectionHasObjectsIs();
    return [
      this.actionEntry(context, 'Cut', () => window.clipboardCut(), {
        isEnabled,
        shortcutText: shellMenuEditPrimaryShortcutLabel('KeyX'),
        nativeRole: 'cut',
      }),
      this.actionEntry(context, 'Copy', () => window.clipboardCopy(), {
        isEnabled,
        shortcutText: shellMenuEditPrimaryShortcutLabel('KeyC'),
        nativeRole: 'copy',
      }),
      this.actionEntry(context, 'Paste', () => window.clipboardPaste(), {
        shortcutText: shellMenuEditPrimaryShortcutLabel('KeyV'),
        nativeRole: 'paste',
      }),
      this.actionEntry(context, 'Paste at Original Position', () => window.clipboardPasteAtOriginalPosition(), {
        shortcutAction: 'paste_original',
      }),
    ];
  }

  /**
   * Builds the Object Properties entry, enabled only while something is
   * selected.
   *
   * @param context Actions and docks the entry runs.
   * @returns Object Properties entry.
   */
  private objectPropertiesEntryBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const window = context.windowActions;
    return this.actionEntry(context, 'Object Properties', () => window.objectPropertiesOpen(), {
      shortcutAction: 'object_properties',
      isEnabled: () => window.selectionHasObjectsIs(),
    });
  }

  /**
   * Builds the Select All, Select None and Select submenu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Selection entries.
   */
  selectionEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const window = context.windowActions;
    return [
      this.actionEntry(context, 'Select All', () => window.selectAll(), {
        shortcutAction: 'select_all',
        textEditCommand: 'selectAll',
      }),
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
   * Builds the CSG submenu of the brush operation entries.
   *
   * @param context Actions and docks the entries run.
   * @returns CSG submenu entry.
   */
  private csgSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    return { kind: 'submenu', label: 'CSG', children: this.csgEntriesBuild(context) };
  }

  /**
   * Builds the Union, Subtract, Intersect, Hollow and Convex Merge entries with
   * their shortcuts.
   *
   * @param context Actions and docks the entries run.
   * @returns Brush operation entries.
   */
  csgEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    return [...this.csgBooleanEntriesBuild(context), this.separatorEntry(), ...this.csgBrushEntriesBuild(context)];
  }

  /**
   * Builds the Union, Subtract and Intersect entries, enabled only while the
   * selection allows a mesh boolean.
   *
   * @param context Actions and docks the entries run.
   * @returns Mesh boolean entries.
   */
  private csgBooleanEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    const isEnabled = (): boolean => actions.canRunCsgBoolean();
    return [
      this.actionEntry(context, 'Union', () => actions.onCsgUnion(), { isEnabled, shortcutAction: 'csg_union' }),
      this.actionEntry(context, 'Subtract', () => actions.onCsgSubtract(), {
        isEnabled,
        shortcutAction: 'csg_subtract',
      }),
      this.actionEntry(context, 'Intersect', () => actions.onCsgIntersect(), {
        isEnabled,
        shortcutAction: 'csg_intersect',
      }),
    ];
  }

  /**
   * Builds the Hollow and Convex Merge entries; Convex Merge also merges
   * selected faces, so both stay enabled without selected objects.
   *
   * @param context Actions and docks the entries run.
   * @returns Brush entries.
   */
  private csgBrushEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const brushTools = this.brushToolsReader(context);
    return [
      this.actionEntry(context, 'Hollow', () => brushTools()?.hollow(), { shortcutAction: 'csg_hollow' }),
      this.actionEntry(context, 'Convex Merge', () => brushTools()?.convexMerge(), {
        shortcutAction: 'csg_convex_merge',
      }),
    ];
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
  alignSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
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
