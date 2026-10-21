import type { PanelLayersRow } from '@/layer/ui/panel_layers_row.js';
import { InputInlineRename } from '@/ui/input/input_inline_rename.js';

/**
 * One inline rename of a layer row at a time. When the rename ends, the
 * confirmed name is handed over and the end callback runs.
 */
export class PanelLayersRenameSession {
  private readonly onEnd: () => void;
  private renameInput: InputInlineRename | null;

  /**
   * Creates an idle session.
   *
   * @param onEnd Called after a rename is confirmed or cancelled.
   */
  constructor(onEnd: () => void) {
    this.onEnd = onEnd;
    this.renameInput = null;
  }

  /**
   * Returns whether a rename is in progress.
   *
   * @returns True while the input is shown.
   */
  activeIs(): boolean {
    return this.renameInput !== null;
  }

  /**
   * Returns the input of the rename in progress.
   *
   * @returns Input element, or null when idle.
   */
  inputElementRead(): HTMLInputElement | null {
    return this.renameInput?.getInputElement() ?? null;
  }

  /**
   * Replaces a row's name with an input, ending any rename in progress.
   *
   * @param row Row whose layer is renamed.
   * @param currentName Name the input starts with.
   * @param onConfirm Receives the confirmed name.
   */
  begin(row: PanelLayersRow, currentName: string, onConfirm: (name: string) => void): void {
    this.dispose();
    const renameInput = new InputInlineRename(row.textColumnRead(), row.nameElementRead(), currentName);
    renameInput.setConfirmCallback((name) => this.finish(() => onConfirm(name)));
    renameInput.setCancelCallback(() => this.finish(() => undefined));
    this.renameInput = renameInput;
    renameInput.activate();
  }

  /** Drops the rename in progress without applying it. */
  dispose(): void {
    this.renameInput?.dispose();
    this.renameInput = null;
  }

  /**
   * Ends the rename, applies its outcome and runs the end callback.
   *
   * @param outcomeApply Applies the confirmed name or nothing.
   */
  private finish(outcomeApply: () => void): void {
    this.dispose();
    outcomeApply();
    this.onEnd();
  }
}
