import { dialogChromeBodyTextApply } from './dialog_chrome_styles.js';
import { DialogModalChoice } from './dialog_modal_choice.js';

/**
 * Options for a reusable modal message box (Yes/No style prompts such as File →
 * New and Settings → Reset).
 */
export interface MessageBoxOptions {
  /** Parent element that owns the modal overlay. */
  host: HTMLElement;
  /** Dialog title shown in the header. */
  title: string;
  /** Body message explaining the consequence of confirming. */
  message: string;
  /**
   * Optional bold line rendered under the main message (e.g. permanent-loss
   * warnings).
   */
  boldMessage?: string;
  /** Affirmative button label. Defaults to "Yes". */
  confirmLabel?: string;
  /** Dismiss button label. Defaults to "No". */
  cancelLabel?: string;
}

/**
 * Shows a professional modal message box and resolves when the user chooses Yes
 * or No. Escape and backdrop click dismiss as No.
 *
 * @param options Dialog title, message, labels, and host element.
 * @returns Promise resolving true when Yes is chosen.
 */
export function showMessageBox(options: MessageBoxOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const dialog = new DialogMessageBox(options, (confirmed) => {
      resolve(confirmed);
      queueMicrotask(() => dialog.dispose());
    });
    dialog.show();
  });
}

/**
 * Alias kept for call sites that still import {@link showConfirmDialog}.
 *
 * @param options Dialog options.
 * @returns Promise resolving true when Yes is chosen.
 */
export function showConfirmDialog(options: MessageBoxOptions): Promise<boolean> {
  return showMessageBox(options);
}

/** @deprecated Prefer {@link MessageBoxOptions}. */
export type ConfirmDialogOptions = MessageBoxOptions;

/** Smallest width of a message box in pixels. */
const DIALOG_MESSAGE_BOX_MIN_WIDTH_PX = 360;

/** Largest width of a message box in pixels. */
const DIALOG_MESSAGE_BOX_MAX_WIDTH_PX = 440;

/**
 * Modal Yes/No message box. Settles once when the user chooses a button,
 * Escape, or the backdrop.
 */
class DialogMessageBox extends DialogModalChoice {
  private readonly options: MessageBoxOptions;

  /**
   * @param options Dialog configuration.
   * @param settle Callback invoked once with the user decision.
   */
  constructor(options: MessageBoxOptions, settle: (confirmed: boolean) => void) {
    super(
      {
        host: options.host,
        title: options.title,
        confirmLabel: options.confirmLabel ?? 'Yes',
        cancelLabel: options.cancelLabel ?? 'No',
        minWidthPx: DIALOG_MESSAGE_BOX_MIN_WIDTH_PX,
        maxWidthPx: DIALOG_MESSAGE_BOX_MAX_WIDTH_PX,
      },
      settle,
    );
    this.options = options;
    this.dialogBuild();
  }

  /**
   * Creates the message body with an optional bold line.
   *
   * @returns Body container.
   */
  protected bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.style.margin = '0 0 18px';
    body.appendChild(this.createMessageParagraph(this.options.message, false));
    if (this.options.boldMessage && this.options.boldMessage.trim().length > 0) {
      body.appendChild(this.createMessageParagraph(this.options.boldMessage, true));
    }
    return body;
  }

  /**
   * Creates one paragraph of the message body.
   *
   * @param text Paragraph text.
   * @param bold Whether to render in bold.
   * @returns Paragraph element.
   */
  private createMessageParagraph(text: string, bold: boolean): HTMLElement {
    const message = document.createElement('p');
    message.textContent = text;
    message.style.margin = bold ? '12px 0 0' : '0';
    dialogChromeBodyTextApply(message, bold);
    message.style.whiteSpace = 'pre-wrap';
    return message;
  }
}
