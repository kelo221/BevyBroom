import { dockSideIs } from '@/ui/dock/dock_side.js';
import { panelFloatingLayoutRectRead } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';

/**
 * Returns whether a value is a plain object record.
 *
 * @param value Argument value.
 * @returns True for a non-array object.
 */
function editorApiToolWindowsRecordIs(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Finds the first problem of the toolWindowPlacements argument.
 *
 * @param value Argument value.
 * @param knownWindowIds Layout ids of the tool windows.
 * @returns Problem description, or null when omitted or valid.
 */
function editorApiToolWindowPlacementsProblemFind(value: unknown, knownWindowIds: readonly string[]): string | null {
  if (value === undefined) {
    return null;
  }
  if (!editorApiToolWindowsRecordIs(value)) {
    return 'toolWindowPlacements must be an object of tool window ids to left, right, bottom or floating';
  }
  const unknownId = Object.keys(value).find((windowId) => !knownWindowIds.includes(windowId));
  if (unknownId !== undefined) {
    return `toolWindowPlacements has unknown tool window ${unknownId}; known: ${knownWindowIds.join(', ')}`;
  }
  const invalid = Object.keys(value).find((windowId) => value[windowId] !== 'floating' && !dockSideIs(value[windowId]));
  return invalid === undefined ? null : `toolWindowPlacements.${invalid} must be left, right, bottom or floating`;
}

/**
 * Finds the first problem of the toolWindowRects argument.
 *
 * @param value Argument value.
 * @param knownWindowIds Layout ids of the tool windows.
 * @returns Problem description, or null when omitted or valid.
 */
function editorApiToolWindowRectsProblemFind(value: unknown, knownWindowIds: readonly string[]): string | null {
  if (value === undefined) {
    return null;
  }
  if (!editorApiToolWindowsRecordIs(value)) {
    return 'toolWindowRects must be an object of tool window ids to {left, top, width, height}';
  }
  const unknownId = Object.keys(value).find((windowId) => !knownWindowIds.includes(windowId));
  if (unknownId !== undefined) {
    return `toolWindowRects has unknown tool window ${unknownId}; known: ${knownWindowIds.join(', ')}`;
  }
  const invalid = Object.keys(value).find((windowId) => panelFloatingLayoutRectRead(value[windowId]) === null);
  return invalid === undefined
    ? null
    : `toolWindowRects.${invalid} must be {left, top, width, height} of a usable size`;
}

/**
 * Finds the first problem of the tool window fields of a set_main_window call.
 *
 * @param args Tool arguments.
 * @param knownWindowIds Layout ids of the tool windows.
 * @returns Problem description, or null when every tool window field is valid.
 */
export function editorApiToolWindowsProblemFind(
  args: Record<string, unknown>,
  knownWindowIds: readonly string[],
): string | null {
  const invalidFlag = ['tileFloatingWindows', 'resetWindowLayout'].find(
    (field) => args[field] !== undefined && typeof args[field] !== 'boolean',
  );
  if (invalidFlag !== undefined) {
    return `${invalidFlag} must be true or false`;
  }
  return (
    editorApiToolWindowPlacementsProblemFind(args['toolWindowPlacements'], knownWindowIds) ??
    editorApiToolWindowRectsProblemFind(args['toolWindowRects'], knownWindowIds)
  );
}
