import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';
import {
  MCP_SELECTION_VISIBILITY_ACTIONS,
  type McpSelectionVisibilityAction,
} from '@/ai/shared/mcp_selection_visibility_actions.js';

/** Runs Hide Selected, Isolate Selected and Show All for automation. */
export class EditorApiSelectionVisibility {
  private readonly visibility: HandlerSelectionVisibility;

  /**
   * Creates the selection visibility tool.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.visibility = new HandlerSelectionVisibility({
      commandStack: host.commandStack,
      selectionManager: host.selectionManager,
      worldObject: host.worldObject,
      afterVisibilityChange: () => host.refreshAfterWorldMutation(),
    });
  }

  /**
   * Runs the selection visibility tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no visibility tool.
   */
  selectionVisibilityToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return name === 'set_selection_visibility' ? this.selectionVisibilityApply(args) : null;
  }

  /**
   * Applies the requested visibility action as one undo step.
   *
   * @param args Tool arguments with action.
   * @returns Result with the number of changed objects.
   */
  private selectionVisibilityApply(args: Record<string, unknown>): McpToolResult {
    const action = MCP_SELECTION_VISIBILITY_ACTIONS.find((entry) => entry === args['action']);
    if (!action) {
      return failResult(`action must be one of ${MCP_SELECTION_VISIBILITY_ACTIONS.join(', ')}`);
    }
    const changedCount = this.visibilityActionRun(action);
    return okResult(`Changed the visibility of ${changedCount} object(s)`, { action, changedCount });
  }

  /**
   * Runs one visibility action.
   *
   * @param action Action to run.
   * @returns Number of objects whose visibility changed.
   */
  private visibilityActionRun(action: McpSelectionVisibilityAction): number {
    if (action === 'hide') {
      return this.visibility.hideSelected();
    }
    return action === 'isolate' ? this.visibility.isolateSelected() : this.visibility.showAll();
  }
}
