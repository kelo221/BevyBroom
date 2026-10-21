import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { toolInstructionForEditorTool } from '@/tools/chrome/instruction/tool_instruction_catalog.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** Editor tools listed in the Tools menu, in display order. */
const SHELL_MENU_TOOLS_ORDER: readonly EditorToolId[] = [
  EditorToolId.OBJECT,
  EditorToolId.FACE,
  EditorToolId.CLIP_PLANE,
  EditorToolId.GRID,
];

/** Tools menu: editor tools, snapping, texture locks, gizmo axes and panels. */
export class ShellMenuTools extends ShellMenu {
  readonly label = 'Tools';

  /**
   * Builds the Tools menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      ...SHELL_MENU_TOOLS_ORDER.map((toolId) => this.toolEntryBuild(context, toolId)),
      this.separatorEntry(),
      this.actionEntry(context, 'Snap to Grid', () => actions.onToggleSnap(), {
        isChecked: () => actions.isUserSnapEnabled(),
      }),
      this.actionEntry(context, 'Position Lock', () => actions.onTogglePositionLock(), {
        isChecked: () => actions.isPositionLockEnabled(),
      }),
      this.actionEntry(context, 'Stretch Lock', () => actions.onToggleStretchLock(), {
        isChecked: () => actions.isStretchLockEnabled(),
      }),
      this.gizmoAxesSubmenuBuild(context),
      this.separatorEntry(),
      this.actionEntry(context, 'Solid Model…', () => actions.onToggleSolidModelPanel()),
    ];
  }

  /**
   * Builds the row that activates one editor tool.
   *
   * @param context Actions and docks the entries run.
   * @param toolId Tool the row activates.
   * @returns Menu action entry checked while the tool is active.
   */
  private toolEntryBuild(context: ShellMenuContext, toolId: EditorToolId): ToolbarMenuEntry {
    const window = context.windowActions;
    return this.actionEntry(context, toolInstructionForEditorTool(toolId).title, () => window.toolSelect(toolId), {
      isChecked: () => window.toolActiveRead() === toolId,
    });
  }

  /**
   * Builds the Gizmo Axes submenu choosing world or object axes.
   *
   * @param context Actions and docks the entries run.
   * @returns Submenu entry.
   */
  private gizmoAxesSubmenuBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const actions = context.toolbarActions;
    return {
      kind: 'submenu',
      label: 'Gizmo Axes',
      children: [
        this.actionEntry(context, 'Global', () => actions.onSetTransformSpaceGlobal(), {
          isChecked: () => !actions.isTransformSpaceLocal(),
        }),
        this.actionEntry(context, 'Local', () => actions.onSetTransformSpaceLocal(), {
          isChecked: () => actions.isTransformSpaceLocal(),
        }),
      ],
    };
  }
}
