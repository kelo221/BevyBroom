import { BoxSelectTool } from '@/editor/tools/box_select/box_select_tool.js';
import type { Tool } from '@/editor/tools/tool.js';

/**
 * Returns whether the active tool is an object tool (Bounds, Move, Rotate,
 * Scale or Shear) that is idle for object double-clicks.
 *
 * @param activeTool Active editor tool, or null when none is active.
 * @returns True when a double-click may open Object Properties.
 */
export function objectSelectDoubleClickToolReady(activeTool: Tool | null | undefined): boolean {
  return activeTool instanceof BoxSelectTool && activeTool.isObjectDoubleClickReady();
}
