import { Theme } from '@/theme.js';
import { inputNumericFormatWithMinimumDecimals } from '@/ui/input/input_numeric_parse.js';
import { ConsoleLogForwarder } from '@/info_panel/console/console_log_forwarder.js';
import {
  statusCursorCoordsFormat,
  statusSelectionFormat,
  statusSnapFormat,
  statusTooltipFormat,
  statusZoomFormat,
  STATUS_CURSOR_COORDS_EMPTY_TEXT,
  STATUS_HELP_IDLE_TEXT,
  STATUS_SELECTION_EMPTY_TEXT,
  type StatusCursorWorldPosition,
} from './status_bar_hammer_format.js';
import { statusBarFieldCreate } from './status_bar_field.js';

/** How long an error message stays red in the help field, in milliseconds. */
const STATUS_ERROR_HIGHLIGHT_MS = 3000;

/**
 * Hammer-style status bar: the last action or help text on the left, the
 * selection in the middle, and the cursor position, 2D view zoom and snap grid
 * on the right. Undo and redo counts, the save state, the transform mode and
 * the shading mode are in the help field tooltip.
 */
export class StatusBar {
  private readonly container: HTMLElement = document.createElement('div');
  private readonly helpField = statusBarFieldCreate('status-bar-help', '1 1 auto');
  private readonly selectionField = statusBarFieldCreate('status-bar-hammer-selection', '0 1 260px');
  private readonly cursorCoordsField = statusBarFieldCreate('status-bar-cursor-coords', '0 0 170px');
  private readonly zoomField = statusBarFieldCreate('status-bar-zoom', '0 0 90px');
  private readonly snapField = statusBarFieldCreate('status-bar-snap', '0 0 150px');
  private readonly consoleLogForwarder: ConsoleLogForwarder;
  private lastActionMessage = '';
  private fitFeedbackMessage = '';
  private undoRedoText = 'Undo: 0 | Redo: 0';
  private savedInfoText = '';
  private unsavedChanges = false;
  private transformModeText = 'Mode: Bounds';
  private shadingModeText = 'Shading: Solid';
  private snapEnabled = true;
  private snapIntervalFormatted: string;
  private isDisposed = false;

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
    this.applyContainerStyles(theme);
    this.container.append(this.helpField, this.selectionField, this.cursorCoordsField, this.zoomField, this.snapField);
    container.appendChild(this.container);
    this.applyInitialTextContent();
  }

  /** Writes default field texts for a fresh editor session. */
  private applyInitialTextContent(): void {
    this.selectionField.textContent = STATUS_SELECTION_EMPTY_TEXT;
    this.selectionField.title = 'Selection: Object';
    this.cursorCoordsField.textContent = STATUS_CURSOR_COORDS_EMPTY_TEXT;
    this.zoomField.textContent = statusZoomFormat(null);
    this.helpFieldRefresh();
    this.snapFieldRefresh();
  }

  /**
   * Shows the live cursor world position in meters, or the empty marker.
   *
   * @param position Cursor world position, or null when off every viewport.
   */
  setCursorWorldPosition(position: StatusCursorWorldPosition | null): void {
    if (this.isDisposed) return;
    this.cursorCoordsField.textContent = statusCursorCoordsFormat(position);
  }

  /**
   * Shows the zoom factor of the 2D view, or the empty marker.
   *
   * @param zoom Zoom factor where 1 is the startup framing, or null when
   *   unknown.
   */
  setViewZoom(zoom: number | null): void {
    if (this.isDisposed) return;
    this.zoomField.textContent = statusZoomFormat(zoom);
  }

  /**
   * Shows the selected object count, or a custom description when given.
   *
   * @param count Number of selected objects.
   * @param description Optional text replacing the default wording above zero.
   */
  setObjectSelectionCount(count: number, description?: string): void {
    if (this.isDisposed) return;
    this.selectionField.textContent = statusSelectionFormat(count, description);
  }

  /**
   * Updates the shading mode listed in the help field tooltip.
   *
   * @param mode The shading mode name.
   */
  setShadingMode(mode: string): void {
    if (this.isDisposed) return;
    this.shadingModeText = `Shading: ${mode}`;
    this.helpFieldRefresh();
  }

  /**
   * Updates the undo and redo counts listed in the help field tooltip.
   *
   * @param undoCount The number of available undo operations.
   * @param redoCount The number of available redo operations.
   */
  setUndoRedoCounts(undoCount: number, redoCount: number): void {
    if (this.isDisposed) return;
    this.undoRedoText = `Undo: ${undoCount} | Redo: ${redoCount}`;
    this.helpFieldRefresh();
  }

  /**
   * Updates the transform mode listed in the help field tooltip.
   *
   * @param mode The current transform mode name.
   */
  setTransformMode(mode: string): void {
    if (this.isDisposed) return;
    this.transformModeText = `Mode: ${mode}`;
    this.helpFieldRefresh();
  }

  /**
   * Shows whether grid snapping is on in the snap field.
   *
   * @param enabled Whether grid snapping is currently enabled.
   */
  setSnapStatus(enabled: boolean): void {
    if (this.isDisposed) return;
    this.snapEnabled = enabled;
    this.snapFieldRefresh();
  }

  /**
   * Shows the grid interval in the snap field.
   *
   * @param interval The current snap interval value.
   */
  setSnapInterval(interval: number): void {
    if (this.isDisposed) return;
    this.snapIntervalFormatted = this.formatSnapInterval(interval);
    this.snapFieldRefresh();
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
   * Shows an action message in the help field and writes it to the console log.
   *
   * @param message The action message to display, or empty string to clear.
   */
  setLastAction(message: string): void {
    if (this.isDisposed) return;
    this.lastActionMessage = message;
    this.helpFieldRefresh();
    this.consoleLogForwarder.messageForward('info', message);
  }

  /**
   * Shows an action message in the help field without writing it to the console
   * log, for live feedback that changes on every frame such as drag deltas.
   *
   * @param message The live message to display, or empty string to clear.
   */
  setLastActionTransient(message: string): void {
    if (this.isDisposed) return;
    this.lastActionMessage = message;
    this.helpFieldRefresh();
  }

  /**
   * Updates the last saved file listed in the help field tooltip.
   *
   * @param filename The filename to show as last saved.
   */
  setLastSavedInfo(filename: string): void {
    if (this.isDisposed) return;
    this.savedInfoText = `Saved: ${filename}`;
    this.helpFieldRefresh();
  }

  /**
   * Records whether the scene has unsaved changes for the help field tooltip.
   *
   * @param hasUnsavedChanges True while the scene differs from its saved file.
   */
  setUnsavedChanges(hasUnsavedChanges: boolean): void {
    if (this.isDisposed) return;
    this.unsavedChanges = hasUnsavedChanges;
    this.helpFieldRefresh();
  }

  /**
   * Returns whether the scene is shown as having unsaved changes.
   *
   * @returns True while unsaved changes are reported.
   */
  isUnsavedChangesShown(): boolean {
    return this.unsavedChanges;
  }

  /**
   * Shows an error message in red in the help field and writes it to the
   * console log as an error.
   *
   * @param message The error message to display.
   */
  setErrorText(message: string): void {
    if (this.isDisposed) return;
    this.consoleLogForwarder.messageForward('error', message);
    this.lastActionMessage = message;
    this.helpFieldRefresh();
    this.helpField.style.color = Theme.severityErrorColor;
    this.clearErrorColor();
  }

  /** Schedules clearing the error color after a short delay. */
  private clearErrorColor(): void {
    setTimeout(() => {
      if (!this.isDisposed) {
        this.helpField.style.color = Theme.statusBarTextColor;
      }
    }, STATUS_ERROR_HIGHLIGHT_MS);
  }

  /**
   * Shows fit-to-selection feedback in the help field until cleared.
   *
   * @param message The fit feedback message, or empty string to clear.
   */
  setFitFeedback(message: string): void {
    if (this.isDisposed) return;
    this.fitFeedbackMessage = message;
    this.helpFieldRefresh();
  }

  /**
   * Updates the selection mode and face count shown in the selection field
   * tooltip.
   *
   * @param mode The selection mode label (e.g. "Object" or "Face").
   * @param count The number of selected faces when in face mode.
   */
  setSelectionModeInfo(mode: string, count: number): void {
    if (this.isDisposed) return;
    this.selectionField.title = mode === 'Face' ? `Selection: Face (${count} face(s))` : 'Selection: Object';
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
    this.container.remove();
  }

  /** Shows the current message or the idle help text and refreshes the tooltip. */
  private helpFieldRefresh(): void {
    this.helpField.textContent = this.fitFeedbackMessage || this.lastActionMessage || STATUS_HELP_IDLE_TEXT;
    this.helpField.title = statusTooltipFormat([
      this.undoRedoText,
      this.savedInfoText,
      this.unsavedChanges ? 'Unsaved changes' : 'No unsaved changes',
      this.transformModeText,
      this.shadingModeText,
    ]);
  }

  /** Shows the snap state and grid interval in the snap field. */
  private snapFieldRefresh(): void {
    this.snapField.textContent = statusSnapFormat(this.snapEnabled, this.snapIntervalFormatted);
  }

  /**
   * Applies the outer container styles for the status bar.
   *
   * @param theme The theme containing color definitions.
   */
  private applyContainerStyles(theme: typeof Theme): void {
    this.container.classList.add('editor-status-bar');
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.gap = '2px';
    this.container.style.flex = '0 0 auto';
    this.container.style.height = `${theme.statusBarHeightPx}px`;
    this.container.style.padding = '0 2px';
    this.container.style.boxSizing = 'border-box';
    this.container.style.background = theme.statusBarBackground;
    this.container.style.borderTop = `1px solid ${theme.statusBarBorderColor}`;
    this.container.style.userSelect = 'none';
  }
}
