import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import {
  SHELL_MAIN_WINDOW_INFO_PANEL_TABS,
  SHELL_MAIN_WINDOW_INSPECTOR_TABS,
  type ShellMainWindowChanges,
  type ShellMainWindowControl,
} from '@/layout/shell/actions/shell_main_window_control.js';

/** Fields of set_main_window that take true or false. */
const EDITOR_API_MAIN_WINDOW_FLAG_FIELDS = ['inspectorVisible', 'infoPanelVisible', 'toolbarVisible'] as const;

/**
 * Reads and changes which docks, tabs and bars of the editor's main window are
 * shown.
 */
export class EditorApiMainWindow {
  private readonly host: EditorApiHost;

  /**
   * Creates the main window tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs a main window tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no main window tool.
   */
  mainWindowToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'get_main_window':
        return this.withControl((control) => okResult('Main window arrangement', { ...control.stateRead() }));
      case 'set_main_window':
        return this.withControl((control) => this.mainWindowSet(control, args));
      default:
        return null;
    }
  }

  /**
   * Validates and applies main window changes.
   *
   * @param control Main window control.
   * @param args Tool arguments.
   * @returns Result with the new arrangement, or the validation failure.
   */
  private mainWindowSet(control: ShellMainWindowControl, args: Record<string, unknown>): McpToolResult {
    const problem = this.changesProblemFind(args);
    if (problem !== null) {
      return failResult(problem);
    }
    const state = control.changesApply(args as ShellMainWindowChanges);
    return okResult('Main window changed', { ...state });
  }

  /**
   * Finds the first invalid field of a set_main_window call.
   *
   * @param args Tool arguments.
   * @returns Problem description, or null when every field is valid.
   */
  private changesProblemFind(args: Record<string, unknown>): string | null {
    if (!this.tabArgValidIs(args['inspectorTab'], SHELL_MAIN_WINDOW_INSPECTOR_TABS)) {
      return `inspectorTab must be one of ${SHELL_MAIN_WINDOW_INSPECTOR_TABS.join(', ')}`;
    }
    if (!this.tabArgValidIs(args['infoPanelTab'], SHELL_MAIN_WINDOW_INFO_PANEL_TABS)) {
      return `infoPanelTab must be one of ${SHELL_MAIN_WINDOW_INFO_PANEL_TABS.join(', ')}`;
    }
    const invalidFlag = EDITOR_API_MAIN_WINDOW_FLAG_FIELDS.find(
      (field) => args[field] !== undefined && typeof args[field] !== 'boolean',
    );
    return invalidFlag === undefined ? null : `${invalidFlag} must be true or false`;
  }

  /**
   * Returns whether a tab argument is omitted or names a known tab.
   *
   * @param value Argument value.
   * @param tabIds Known tab ids.
   * @returns True when valid.
   */
  private tabArgValidIs(value: unknown, tabIds: readonly string[]): boolean {
    return value === undefined || (typeof value === 'string' && tabIds.includes(value));
  }

  /**
   * Runs a tool body with the main window control, or fails when the editor has
   * no main window.
   *
   * @param body Tool body.
   * @returns Tool result.
   */
  private withControl(body: (control: ShellMainWindowControl) => McpToolResult): McpToolResult {
    const control = this.host.mainWindowControlRead?.() ?? null;
    return control === null ? failResult('The editor has no main window') : body(control);
  }
}
