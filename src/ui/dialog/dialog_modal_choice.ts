import {
  dialogChromeActionButtonApply,
  dialogChromePanelApply,
  dialogChromeTitleApply,
} from './dialog_chrome_styles.js';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';

/** Title and button labels of a modal choice dialog. */
export interface DialogModalChoiceOptions {
  /** Parent element that owns the modal overlay. */
  readonly host: HTMLElement;
  /** Dialog title shown in the header. */
  readonly title: string;
  /** Affirmative button label. */
  readonly confirmLabel: string;
  /** Dismiss button label. */
  readonly cancelLabel: string;
  /** Smallest width of the dialog in pixels. */
  readonly minWidthPx: number;
  /** Largest width of the dialog in pixels. */
  readonly maxWidthPx: number;
}

/** Id of the title element, which labels the dialog for assistive technology. */
const DIALOG_MODAL_CHOICE_TITLE_ID = 'editor-message-box-title';

/**
 * Modal dialog with a title, a body the subclass builds and a confirm/cancel
 * button row. Settles once: a button, Enter (outside buttons), Escape or a
 * backdrop click decide, and Enter confirms only when the subclass allows it.
 */
export abstract class DialogModalChoice extends PanelFloating {
  private readonly choiceOptions: DialogModalChoiceOptions;
  private readonly settle: (confirmed: boolean) => void;
  private settled = false;
  private readonly boundKeyDown: (event: KeyboardEvent) => void;

  /**
   * Creates the dialog shell; subclasses call {@link dialogBuild} once their own
   * fields are set.
   *
   * @param options Title, labels, widths and host element.
   * @param settle Callback invoked once with the user decision.
   */
  protected constructor(options: DialogModalChoiceOptions, settle: (confirmed: boolean) => void) {
    super(options.host, {
      corner: 'top-left',
      modal: true,
      centered: true,
      draggable: false,
      closeOnEscape: false,
      closeOnBackdropClick: false,
      stackLayer: 'confirm',
      backdropClassName: 'editor-message-box-backdrop',
    });
    this.choiceOptions = options;
    this.settle = settle;
    this.boundKeyDown = (event) => this.keyDownHandle(event);
  }

  /**
   * Builds the body shown between the title and the buttons.
   *
   * @returns Body element.
   */
  protected abstract bodyCreate(): HTMLElement;

  /**
   * Returns the element focused when the dialog opens.
   *
   * @returns Element to focus; the cancel button by default.
   */
  protected focusTargetRead(): HTMLElement | null {
    return this.root.querySelector<HTMLButtonElement>('[data-message-box-cancel="true"]');
  }

  /**
   * Returns whether the dialog may be confirmed now.
   *
   * @returns True by default.
   */
  protected isConfirmAllowed(): boolean {
    return true;
  }

  /** Builds title, body and action buttons into the shell. */
  protected dialogBuild(): void {
    this.root.className = 'editor-message-box-panel';
    this.root.setAttribute('role', 'alertdialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', DIALOG_MODAL_CHOICE_TITLE_ID);
    dialogChromePanelApply(this.root, this.choiceOptions.minWidthPx, this.choiceOptions.maxWidthPx);
    this.root.append(this.titleCreate(), this.bodyCreate(), this.buttonRowCreate());
    this.root.addEventListener('mousedown', (event) => event.stopPropagation());
    this.backdropDismissBind();
  }

  /** Listens for Enter and Escape and focuses the chosen element after showing. */
  protected override onAfterShow(): void {
    document.addEventListener('keydown', this.boundKeyDown);
    this.focusTargetRead()?.focus();
  }

  /** Removes temporary key listeners when hidden. */
  protected override onAfterHide(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
  }

  /**
   * Settles the dialog once; confirming is ignored while not allowed.
   *
   * @param confirmed True for the affirmative choice.
   */
  protected decisionSettle(confirmed: boolean): void {
    if (this.settled || (confirmed && !this.isConfirmAllowed())) {
      return;
    }
    this.settled = true;
    this.hide(true);
    this.settle(confirmed);
  }

  /** Binds a backdrop click as a cancel action. */
  private backdropDismissBind(): void {
    const backdrop = this.getBackdropElement();
    backdrop?.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) {
        this.decisionSettle(false);
      }
    });
  }

  /**
   * Handles Escape as cancel and Enter as confirm when focus is not a button.
   *
   * @param event Document keydown event.
   */
  private keyDownHandle(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.decisionSettle(false);
      return;
    }
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.decisionSettle(true);
    }
  }

  /**
   * Creates the dialog title.
   *
   * @returns Title element.
   */
  private titleCreate(): HTMLElement {
    const title = document.createElement('h2');
    title.id = DIALOG_MODAL_CHOICE_TITLE_ID;
    title.textContent = this.choiceOptions.title;
    dialogChromeTitleApply(title);
    return title;
  }

  /**
   * Creates the cancel/confirm button row aligned to the right.
   *
   * @returns Button row container.
   */
  private buttonRowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '8px';
    row.append(
      this.buttonCreate(this.choiceOptions.cancelLabel, false),
      this.buttonCreate(this.choiceOptions.confirmLabel, true),
    );
    return row;
  }

  /**
   * Creates one dialog action button.
   *
   * @param label Button text.
   * @param isConfirm Whether the button accepts the dialog; otherwise it
   *   cancels.
   * @returns Styled button element.
   */
  private buttonCreate(label: string, isConfirm: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    const role = isConfirm ? 'Accept' : 'Cancel';
    button.dataset[`messageBox${role}`] = 'true';
    button.dataset[`confirm${role}`] = 'true';
    dialogChromeActionButtonApply(button, isConfirm);
    button.addEventListener('click', () => this.decisionSettle(isConfirm));
    return button;
  }
}
