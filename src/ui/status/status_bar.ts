import { Theme } from '@/theme.js';
import { inputNumericFormatWithMinimumDecimals } from '@/ui/input/input_numeric_parse.js';
import { ConsoleLogForwarder } from '@/info_panel/console/console_log_forwarder.js';
import {
  statusCursorCoordsFormat,
  statusSelectionFormat,
  STATUS_CURSOR_COORDS_EMPTY_TEXT,
  STATUS_SELECTION_EMPTY_TEXT,
  type StatusCursorWorldPosition,
} from './status_bar_hammer_format.js';

/**
 * Bottom status bar displaying editor state information. Shows undo/redo counts
 * on the left and mode/snap info on the right.
 */
export class StatusBar {
  private readonly container: HTMLElement = document.createElement('div');
  private readonly leftPanel: HTMLElement = document.createElement('div');
  private readonly rightPanel: HTMLElement = document.createElement('div');
  private readonly undoRedoText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly lastActionText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly modeText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly snapText: HTMLElement = StatusBar.textLabelCreate(null);
  private snapIntervalFormatted: string;
  private readonly savedInfoText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly unsavedChangesText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly fitFeedbackText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly shadingModeText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly selectionModeText: HTMLElement = StatusBar.textLabelCreate(null);
  private readonly hammerSelectionText: HTMLElement = StatusBar.textLabelCreate('status-bar-hammer-selection');
  private readonly cursorCoordsText: HTMLElement = StatusBar.textLabelCreate('status-bar-cursor-coords');
  private isDisposed: boolean;
  private readonly consoleLogForwarder: ConsoleLogForwarder;

  /**
   * Creates a new status bar and appends it to the given container.
   *
   * @param container The parent DOM element to append the status bar into.
   * @param theme The theme containing color definitions.
   * @param consoleLogForwarder Writes action and error messages to the console
   *   log; defaults to one writing to the shared log.
   */
  constructor(
    container: HTMLElement,
    theme: typeof Theme,
    consoleLogForwarder: ConsoleLogForwarder = new ConsoleLogForwarder(),
  ) {
    this.consoleLogForwarder = consoleLogForwarder;
    this.snapIntervalFormatted = this.formatSnapInterval(0.25);
    this.isDisposed = false;
    this.applyContainerStyles(theme);
    this.applyPanelStyles(this.leftPanel);
    this.applyPanelStyles(this.rightPanel);
    this.assembleDomHierarchy(container);
    this.applyInitialTextContent();
  }

  /**
   * Creates one styled status label span.
   *
   * @param className Class name added to the label, or null for none.
   * @returns Label element.
   */
  private static textLabelCreate(className: string | null): HTMLElement {
    const label = document.createElement('span');
    if (className !== null) {
      label.classList.add(className);
    }
    label.style.fontSize = '11px';
    label.style.fontFamily = 'monospace';
    label.style.color = Theme.statusBarTextColor;
    label.style.whiteSpace = 'nowrap';
    return label;
  }

  /**
   * Mounts left/right panels into the status bar and attaches to the host.
   *
   * @param host Parent DOM element for the status bar.
   */
  private assembleDomHierarchy(host: HTMLElement): void {
    this.leftPanel.appendChild(this.undoRedoText);
    this.leftPanel.appendChild(this.lastActionText);
    this.leftPanel.appendChild(this.savedInfoText);
    this.leftPanel.appendChild(this.unsavedChangesText);
    this.leftPanel.appendChild(this.fitFeedbackText);
    this.leftPanel.appendChild(this.selectionModeText);
    this.leftPanel.appendChild(this.hammerSelectionText);
    this.rightPanel.appendChild(this.cursorCoordsText);
    this.rightPanel.appendChild(this.modeText);
    this.rightPanel.appendChild(this.snapText);
    this.rightPanel.appendChild(this.shadingModeText);
    this.container.appendChild(this.leftPanel);
    this.container.appendChild(this.rightPanel);
    host.appendChild(this.container);
  }

  /** Writes default status label strings for a fresh editor session. */
  private applyInitialTextContent(): void {
    this.undoRedoText.textContent = 'Undo: 0 | Redo: 0';
    this.lastActionText.textContent = '';
    this.modeText.textContent = 'Mode: Bounds';
    this.snapText.textContent = ` | Snap: On (${this.snapIntervalFormatted})`;
    this.savedInfoText.textContent = '';
    this.fitFeedbackText.textContent = '';
    this.shadingModeText.textContent = ' | Shading: Solid';
    this.selectionModeText.textContent = ' | Selection: Object';
    this.hammerSelectionText.textContent = STATUS_SELECTION_EMPTY_TEXT;
    this.cursorCoordsText.textContent = STATUS_CURSOR_COORDS_EMPTY_TEXT;
  }

  /**
   * Shows the live cursor world position in meters, or the empty marker.
   *
   * @param position Cursor world position, or null when off every viewport.
   */
  setCursorWorldPosition(position: StatusCursorWorldPosition | null): void {
    if (this.isDisposed) return;
    this.cursorCoordsText.textContent = statusCursorCoordsFormat(position);
  }

  /**
   * Shows the selected object count, or a custom description when given.
   *
   * @param count Number of selected objects.
   * @param description Optional text replacing the default wording above zero.
   */
  setObjectSelectionCount(count: number, description?: string): void {
    if (this.isDisposed) return;
    this.hammerSelectionText.textContent = statusSelectionFormat(count, description);
  }

  /**
   * Updates the current shading mode display.
   *
   * @param mode The shading mode name to show in the status bar.
   */
  setShadingMode(mode: string): void {
    if (this.isDisposed) return;
    this.shadingModeText.textContent = ` | Shading: ${mode}`;
  }

  /**
   * Updates the undo and redo counter display.
   *
   * @param undoCount The number of available undo operations.
   * @param redoCount The number of available redo operations.
   */
  setUndoRedoCounts(undoCount: number, redoCount: number): void {
    if (this.isDisposed) return;
    this.undoRedoText.textContent = `Undo: ${undoCount} | Redo: ${redoCount}`;
  }

  /**
   * Updates the current transform mode display.
   *
   * @param mode The current transform mode name.
   */
  setTransformMode(mode: string): void {
    if (this.isDisposed) return;
    this.modeText.textContent = `Mode: ${mode}`;
  }

  /**
   * Updates the snap status display with enabled state and current interval.
   *
   * @param enabled Whether grid snapping is currently enabled.
   */
  setSnapStatus(enabled: boolean): void {
    if (this.isDisposed) return;
    if (enabled) {
      this.snapText.textContent = ` | Snap: On (${this.snapIntervalFormatted})`;
    } else {
      this.snapText.textContent = ' | Snap: Off';
    }
  }

  /**
   * Updates the snap interval display in the status bar.
   *
   * @param interval The current snap interval value.
   */
  setSnapInterval(interval: number): void {
    if (this.isDisposed) return;
    this.snapIntervalFormatted = this.formatSnapInterval(interval);
    this.snapText.textContent = ` | Snap: On (${this.snapIntervalFormatted})`;
  }

  /**
   * Formats a snap interval number for display. Keeps at least one fractional
   * digit and allows up to five places for fine steps such as 0.03125.
   *
   * @param value The interval value to format.
   * @returns A formatted string representation of the interval.
   */
  private formatSnapInterval(value: number): string {
    return inputNumericFormatWithMinimumDecimals(value, 1);
  }

  /**
   * Updates the last action feedback message and writes it to the console log.
   *
   * @param message The action message to display, or empty string to clear.
   */
  setLastAction(message: string): void {
    if (this.isDisposed) return;
    this.lastActionText.textContent = message;
    this.consoleLogForwarder.messageForward('info', message);
  }

  /**
   * Updates the last action feedback message without writing it to the console
   * log, for live feedback that changes on every frame such as drag deltas.
   *
   * @param message The live message to display, or empty string to clear.
   */
  setLastActionTransient(message: string): void {
    if (this.isDisposed) return;
    this.lastActionText.textContent = message;
  }

  /**
   * Updates the last saved file information display.
   *
   * @param filename The filename to show as last saved.
   */
  setLastSavedInfo(filename: string): void {
    if (this.isDisposed) return;
    this.savedInfoText.textContent = ` | Saved: ${filename}`;
  }

  /**
   * Shows or hides the marker telling that the scene has unsaved changes.
   *
   * @param hasUnsavedChanges True while the scene differs from its saved file.
   */
  setUnsavedChanges(hasUnsavedChanges: boolean): void {
    if (this.isDisposed) return;
    this.unsavedChangesText.textContent = hasUnsavedChanges ? ' | Unsaved changes' : '';
  }

  /**
   * Returns whether the unsaved changes marker is shown.
   *
   * @returns True while the marker is visible.
   */
  isUnsavedChangesShown(): boolean {
    return this.unsavedChangesText.textContent !== '';
  }

  /**
   * Updates the status bar with an error message and writes it to the console
   * log as an error.
   *
   * @param message The error message to display.
   */
  setErrorText(message: string): void {
    if (this.isDisposed) return;
    this.consoleLogForwarder.messageForward('error', message);
    this.lastActionText.textContent = message;
    this.lastActionText.style.color = '#ff4444';
    this.clearErrorColor();
  }

  /** Schedules clearing the error color after a short delay. */
  private clearErrorColor(): void {
    setTimeout(() => {
      if (!this.isDisposed) {
        this.lastActionText.style.color = Theme.statusBarTextColor;
      }
    }, 3000);
  }

  /**
   * Updates the fit-to-selection feedback message in the status bar.
   *
   * @param message The fit feedback message, or empty string to clear.
   */
  setFitFeedback(message: string): void {
    if (this.isDisposed) return;
    this.fitFeedbackText.textContent = message;
  }

  /**
   * Updates the selection mode and face count display in the status bar.
   *
   * @param mode The selection mode label (e.g. "Object" or "Face").
   * @param count The number of selected faces when in face mode.
   */
  setSelectionModeInfo(mode: string, count: number): void {
    if (this.isDisposed) return;
    if (mode === 'Face') {
      this.selectionModeText.textContent = ` | Selection: Face (${count} face(s))`;
    } else {
      this.selectionModeText.textContent = ' | Selection: Object';
    }
  }

  /**
   * Returns the root DOM element of the status bar.
   *
   * @returns The container element.
   */
  getRootElement(): HTMLElement {
    return this.container;
  }

  /** Disposes the status bar and removes it from the DOM. */
  dispose(): void {
    this.isDisposed = true;
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Applies the outer container styles for the status bar.
   *
   * @param theme The theme containing color definitions.
   */
  private applyContainerStyles(theme: typeof Theme): void {
    this.container.classList.add('editor-status-bar');
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'space-between';
    this.container.style.alignItems = 'center';
    this.container.style.padding = '4px 12px';
    this.container.style.background = theme.statusBarBackground;
    this.container.style.borderTop = `1px solid ${theme.statusBarBorderColor}`;
    this.container.style.minHeight = '24px';
    this.container.style.userSelect = 'none';
  }

  /**
   * Applies flex styles to panel elements.
   *
   * @param panel The panel element to style.
   */
  private applyPanelStyles(panel: HTMLElement): void {
    panel.style.display = 'flex';
    panel.style.alignItems = 'center';
    panel.style.gap = '8px';
  }
}
