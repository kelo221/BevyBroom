import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import type { EditorToolId } from '@/types/editor_tool_id.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';

/**
 * Editor commands the main window menus and toolbar run that are not part of
 * the scene toolbar actions: selection, view, play, tool and grid commands.
 * Every member is called only when the user acts, so implementations may read
 * editor parts that are created after the main window.
 */
export interface ShellWindowActions {
  /** Selects every selectable object. */
  selectAll(): void;
  /** Clears the selection. */
  selectNone(): void;
  /** Switches the hovered view to the next view kind. */
  viewCycle(): void;
  /** Maximizes or restores the hovered view. */
  viewMaximize(): void;
  /** Frames the selection in the hovered view. */
  frameSelection(): void;
  /** Frames the selection in every view. */
  frameAll(): void;
  /** Starts play mode. */
  playStart(): void;
  /** Copies the selection to the clipboard. */
  clipboardCopy(): void;
  /** Copies the selection to the clipboard and deletes it. */
  clipboardCut(): void;
  /** Pastes the clipboard under the pointer. */
  clipboardPaste(): void;
  /** Pastes the clipboard at the position it was copied from. */
  clipboardPasteAtOriginalPosition(): void;
  /**
   * Returns whether the selection holds anything to copy or cut.
   *
   * @returns True when something is selected.
   */
  clipboardSelectionHasObjectsIs(): boolean;
  /**
   * Activates one editor tool.
   *
   * @param toolId Tool to activate.
   */
  toolSelect(toolId: EditorToolId): void;
  /**
   * Returns the active editor tool.
   *
   * @returns Active tool id.
   */
  toolActiveRead(): EditorToolId;
  /**
   * Returns the grid size.
   *
   * @returns Grid size in meters.
   */
  gridIntervalRead(): number;
  /**
   * Sets the grid size.
   *
   * @param interval Grid size in meters.
   */
  gridIntervalSet(interval: number): void;
  /**
   * Registers a listener told the new grid size after every change.
   *
   * @param listener Called with the new grid size.
   */
  gridIntervalChangeListenerAdd(listener: (interval: number) => void): void;
  /**
   * Returns the configured shortcut text of one action.
   *
   * @param action Shortcut action.
   * @returns Shortcut label such as "Ctrl+A".
   */
  shortcutLabelRead(action: KeyboardShortcutAction): string;
  /**
   * Returns the solid brush tools (hollow, convex merge, flip, vertex snap).
   *
   * @returns Brush tools, or null before the editor finished starting.
   */
  solidBrushToolsRead(): HandlerSolidBrushTools | null;
}
