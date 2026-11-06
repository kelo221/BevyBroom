import type { IssuesSchedulerTimerSource } from '@/info_panel/issues/issues_scheduler.js';
import { infoPanelStripRevealTabWrite } from './info_panel_strip_reveal.js';
import {
  INFO_PANEL_STRIP_BADGE_CLASS,
  INFO_PANEL_STRIP_BADGE_EMPTY_CLASS,
  INFO_PANEL_STRIP_BADGE_PULSE_CLASS,
  INFO_PANEL_STRIP_PULSE_MILLISECONDS,
} from './info_panel_strip_styles.js';

/** Look and behavior of one count badge. */
export interface InfoPanelStripBadgeOptions {
  /** Name of what the badge counts, stored as its `data-badge` attribute. */
  readonly badgeKind: string;
  /** Tab a click on the badge reveals. */
  readonly revealTabId: string;
  /** Background color of the badge. */
  readonly backgroundColor: string;
  /** Builds the tooltip from the count. */
  readonly tooltipFormat: (count: number) => string;
  /** Timer that ends a pulse. */
  readonly timerSource: IssuesSchedulerTimerSource;
}

/** Small colored count on the info panel strip that can briefly pulse. */
export class InfoPanelStripBadge {
  private readonly element: HTMLElement;
  private readonly options: InfoPanelStripBadgeOptions;
  private pulseHandle: unknown = null;

  /**
   * Creates the badge showing a count of zero.
   *
   * @param ownerDocument Document that creates the element.
   * @param options Kind, revealed tab, color, tooltip and timer.
   */
  constructor(ownerDocument: Document, options: InfoPanelStripBadgeOptions) {
    this.options = options;
    this.element = ownerDocument.createElement('span');
    this.element.classList.add(INFO_PANEL_STRIP_BADGE_CLASS);
    this.element.dataset['badge'] = options.badgeKind;
    this.element.style.background = options.backgroundColor;
    infoPanelStripRevealTabWrite(this.element, options.revealTabId);
    this.countWrite(0);
  }

  /**
   * Returns the badge element.
   *
   * @returns Badge element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows a count and the matching tooltip.
   *
   * @param count Number to show.
   */
  countWrite(count: number): void {
    this.element.textContent = String(count);
    this.element.title = this.options.tooltipFormat(count);
    this.element.classList.toggle(INFO_PANEL_STRIP_BADGE_EMPTY_CLASS, count === 0);
  }

  /** Starts a brief pulse, restarting one that is still running. */
  pulse(): void {
    this.pulseCancel();
    this.layoutFlushForAnimationRestart();
    this.element.classList.add(INFO_PANEL_STRIP_BADGE_PULSE_CLASS);
    this.pulseHandle = this.options.timerSource.timeoutSet(() => this.pulseEnd(), INFO_PANEL_STRIP_PULSE_MILLISECONDS);
  }

  /**
   * Returns whether the badge is pulsing.
   *
   * @returns True while pulsing.
   */
  isPulsing(): boolean {
    return this.element.classList.contains(INFO_PANEL_STRIP_BADGE_PULSE_CLASS);
  }

  /** Stops a running pulse and removes the element. */
  dispose(): void {
    this.pulseCancel();
    this.element.remove();
  }

  /**
   * Makes the browser lay the badge out without the pulse class, so adding the
   * class again starts the animation from its beginning.
   *
   * @returns Measured badge width, read only to flush the layout.
   */
  private layoutFlushForAnimationRestart(): number {
    return this.element.offsetWidth;
  }

  /** Ends the running pulse. */
  private pulseEnd(): void {
    this.pulseHandle = null;
    this.element.classList.remove(INFO_PANEL_STRIP_BADGE_PULSE_CLASS);
  }

  /** Cancels a running pulse timer and removes the pulse look. */
  private pulseCancel(): void {
    if (this.pulseHandle !== null) {
      this.options.timerSource.timeoutClear(this.pulseHandle);
    }
    this.pulseEnd();
  }
}
