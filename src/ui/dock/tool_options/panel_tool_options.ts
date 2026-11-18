import { Theme } from '@/theme.js';
import { buildFloatingPanelTitleBar } from '@/ui/floating_panel/panel_floating_title_bar.js';

/** DOM event a tool options section sends from its root when it is shown. */
export const PANEL_TOOL_OPTIONS_SHOWN_EVENT = 'panel-tool-options-shown';

/** Look and title of one tool options section. */
export interface PanelToolOptionsOptions {
  /** Title shown in the section's title row. */
  readonly titleText: string;
  /** Class added to the section root. */
  readonly className: string;
}

/**
 * Base of the tool options sections of the right dock (Face Edit Sheet, Entity
 * Sprinkle, displacement paint and noise): a title row with a Close button
 * above a body, shown inside its host while its tool needs it. Showing a
 * section sends {@link PANEL_TOOL_OPTIONS_SHOWN_EVENT} so the dock can reveal
 * itself.
 */
export abstract class PanelToolOptions {
  protected readonly root: HTMLElement;
  protected readonly body: HTMLElement;
  protected readonly titleElement: HTMLElement;
  private readonly host: HTMLElement;
  private readonly disposers: Array<() => void> = [];
  private isVisible: boolean;

  /**
   * Builds the hidden section; it is attached to the host when first shown.
   *
   * @param host Element the section is shown in.
   * @param options Title and class of the section.
   */
  protected constructor(host: HTMLElement, options: PanelToolOptionsOptions) {
    this.host = host;
    this.isVisible = false;
    this.root = document.createElement('section');
    this.body = this.bodyCreate();
    const titleParts = buildFloatingPanelTitleBar({
      titleText: options.titleText,
      onClose: () => this.hide(),
      padding: '3px 6px',
      flexShrinkZero: true,
    });
    titleParts.bar.style.cursor = 'default';
    this.titleElement = titleParts.title;
    this.rootStyle(options);
    this.root.append(titleParts.bar, this.body);
  }

  /** Shows the section at its place in the host and tells the dock. */
  show(): void {
    if (this.isVisible) {
      return;
    }
    this.isVisible = true;
    this.host.appendChild(this.root);
    this.root.dispatchEvent(new CustomEvent(PANEL_TOOL_OPTIONS_SHOWN_EVENT, { bubbles: true }));
    this.onAfterShow();
  }

  /** Hides the section and takes it out of the host. */
  hide(): void {
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    this.onAfterHide();
    this.root.remove();
  }

  /** Shows the section when hidden and hides it when shown. */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
      return;
    }
    this.show();
  }

  /**
   * Tells whether the section is shown.
   *
   * @returns True while shown.
   */
  isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Returns the section element.
   *
   * @returns Root element.
   */
  getRootElement(): HTMLElement {
    return this.root;
  }

  /** Hides the section and runs the registered disposers. */
  dispose(): void {
    this.hide();
    this.disposers.splice(0).forEach((disposer) => disposer());
  }

  /**
   * Registers work to run when the section is disposed.
   *
   * @param disposer Work to run.
   */
  protected disposerAdd(disposer: () => void): void {
    this.disposers.push(disposer);
  }

  /** Runs after the section was shown; subclasses override it. */
  protected onAfterShow(): void {}

  /** Runs after the section was hidden; subclasses override it. */
  protected onAfterHide(): void {}

  /**
   * Styles the section root.
   *
   * @param options Title and class of the section.
   */
  private rootStyle(options: PanelToolOptionsOptions): void {
    this.root.classList.add('panel-tool-options', options.className);
    this.root.setAttribute('aria-label', options.titleText);
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.borderTop = `1px solid ${Theme.separatorColor}`;
    this.root.style.fontFamily = Theme.uiFontFamily;
    this.root.style.fontSize = `${Theme.uiFontSizePx}px`;
    this.root.style.color = Theme.buttonTextColor;
  }

  /**
   * Builds the body the subclasses fill.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '6px';
    body.style.padding = '6px';
    body.style.minHeight = '0';
    return body;
  }
}
