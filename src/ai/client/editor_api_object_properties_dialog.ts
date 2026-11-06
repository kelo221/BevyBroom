import type { EditorApiHost, EditorApiObjectPropertiesDialogControl } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/** Actions set_object_properties_dialog accepts. */
const EDITOR_API_OBJECT_PROPERTIES_DIALOG_ACTIONS = ['open', 'apply', 'cancel'] as const;

/** One action of set_object_properties_dialog. */
type EditorApiObjectPropertiesDialogAction = (typeof EDITOR_API_OBJECT_PROPERTIES_DIALOG_ACTIONS)[number];

/** State the Object Properties dialog tools report. */
interface EditorApiObjectPropertiesDialogState {
  open: boolean;
  tab: string | null;
  tabs: string[];
  editedIds: string[];
}

/** Result of applying the optional comments argument. */
interface EditorApiObjectPropertiesCommentsApplyResult {
  problem: string | null;
  given: boolean;
  changed: boolean;
}

/**
 * Opens, applies and cancels the Object Properties dialog and switches its
 * tabs, the way the user does with Alt+Enter, Apply, Cancel and the tab strip.
 */
export class EditorApiObjectPropertiesDialog {
  private readonly host: EditorApiHost;

  /**
   * Creates the dialog tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs an Object Properties dialog tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no dialog tool.
   */
  objectPropertiesDialogToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'get_object_properties_dialog':
        return this.withDialog((dialog) => okResult('Object Properties dialog', this.stateRead(dialog)));
      case 'set_object_properties_dialog':
        return this.withDialog((dialog) => this.dialogSet(dialog, args));
      default:
        return null;
    }
  }

  /**
   * Validates and runs a dialog action and tab switch.
   *
   * @param dialog Dialog control.
   * @param args Tool arguments with action and tab.
   * @returns Result with the dialog state, or the validation failure.
   */
  private dialogSet(dialog: EditorApiObjectPropertiesDialogControl, args: Record<string, unknown>): McpToolResult {
    const problem = this.dialogSetValidate(dialog, args);
    if (problem !== null) {
      return failResult(problem);
    }
    if (typeof args['tab'] === 'string') {
      dialog.tabShow(args['tab']);
    }
    const commentsResult = this.commentsApply(dialog, args['comments']);
    if (commentsResult.problem !== null) {
      return failResult(commentsResult.problem);
    }
    return okResult(this.dialogSetMessageRead(commentsResult), this.stateRead(dialog));
  }

  /**
   * Validates the action and tab, then runs the action when one is given.
   *
   * @param dialog Dialog control.
   * @param args Tool arguments with action and tab.
   * @returns Problem description, or null when valid.
   */
  private dialogSetValidate(
    dialog: EditorApiObjectPropertiesDialogControl,
    args: Record<string, unknown>,
  ): string | null {
    const action = args['action'];
    const tab = args['tab'];
    const actionProblem = this.dialogActionValidate(action);
    if (actionProblem !== null) {
      return actionProblem;
    }
    if (tab !== undefined && (typeof tab !== 'string' || !dialog.tabIdsRead().includes(tab))) {
      return `tab must be one of ${dialog.tabIdsRead().join(', ')}`;
    }
    if (action !== undefined && !this.actionRun(dialog, action as EditorApiObjectPropertiesDialogAction)) {
      return 'Select an object before opening Object Properties';
    }
    return null;
  }

  /**
   * Returns a problem when the action is present and not a known dialog action.
   *
   * @param action Tool action argument.
   * @returns Problem description, or null when omitted or known.
   */
  private dialogActionValidate(action: unknown): string | null {
    if (action === undefined) {
      return null;
    }
    if (EDITOR_API_OBJECT_PROPERTIES_DIALOG_ACTIONS.some((known) => known === action)) {
      return null;
    }
    return `action must be one of ${EDITOR_API_OBJECT_PROPERTIES_DIALOG_ACTIONS.join(', ')}`;
  }

  /**
   * Returns the success message of a dialog set that already applied its action
   * and comments.
   *
   * @param commentsResult Comments apply result.
   * @returns Message that names a comments write only when comments changed.
   */
  private dialogSetMessageRead(commentsResult: EditorApiObjectPropertiesCommentsApplyResult): string {
    if (!commentsResult.given) {
      return 'Object Properties dialog changed';
    }
    return commentsResult.changed ? 'Object Properties comments written' : 'Object Properties comments already set';
  }

  /**
   * Runs one dialog action.
   *
   * @param dialog Dialog control.
   * @param action Action to run.
   * @returns False when opening failed because nothing is selected.
   */
  private actionRun(
    dialog: EditorApiObjectPropertiesDialogControl,
    action: EditorApiObjectPropertiesDialogAction,
  ): boolean {
    if (action === 'open') {
      return dialog.open();
    }
    if (action === 'apply') {
      dialog.apply();
    } else {
      dialog.cancel();
    }
    return true;
  }

  /**
   * Writes designer comments onto the edited objects as a session edit.
   *
   * @param dialog Dialog control.
   * @param comments Comments argument.
   * @returns Problem, whether comments were given, and whether they changed.
   */
  private commentsApply(
    dialog: EditorApiObjectPropertiesDialogControl,
    comments: unknown,
  ): EditorApiObjectPropertiesCommentsApplyResult {
    if (comments === undefined) {
      return { problem: null, given: false, changed: false };
    }
    if (typeof comments !== 'string') {
      return { problem: 'comments must be a string', given: true, changed: false };
    }
    if (!dialog.isOpen()) {
      return { problem: 'Open Object Properties before setting comments', given: true, changed: false };
    }
    return { problem: null, given: true, changed: dialog.commentsWrite(comments) };
  }

  /**
   * Reads the dialog state.
   *
   * @param dialog Dialog control.
   * @returns Open flag, tabs and edited object ids.
   */
  private stateRead(dialog: EditorApiObjectPropertiesDialogControl): EditorApiObjectPropertiesDialogState {
    return {
      open: dialog.isOpen(),
      tab: dialog.tabActiveRead(),
      tabs: dialog.tabIdsRead(),
      editedIds: dialog.editedObjectsRead().map((object) => object.uuid),
    };
  }

  /**
   * Runs a tool body with the dialog, or fails when the editor has none.
   *
   * @param body Tool body.
   * @returns Tool result.
   */
  private withDialog(body: (dialog: EditorApiObjectPropertiesDialogControl) => McpToolResult): McpToolResult {
    const dialog = this.host.objectPropertiesDialogRead?.() ?? null;
    return dialog === null ? failResult('The editor has no Object Properties dialog') : body(dialog);
  }
}
