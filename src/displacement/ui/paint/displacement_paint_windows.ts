import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import type { DialogDisplacementPaintBase } from './dialog_displacement_paint_base.js';
import { DialogDisplacementPaintGeometry } from './dialog_displacement_paint_geometry.js';
import { DialogDisplacementPaintAlpha } from './dialog_displacement_paint_alpha.js';

/** Optional placement and status services of the paint windows. */
export interface DisplacementPaintWindowsOptions {
  /** Shows a message in the status bar. */
  readonly statusReport?: (message: string) => void;
}

/**
 * Paint Geometry and Paint Alpha windows of the Displacement tab. A window is
 * open while its paint tool is the active viewport tool and the Face Edit Sheet
 * shows its Displacement tab; opening one reports its mouse bindings.
 */
export class DisplacementPaintWindows {
  /** Paint Geometry window. */
  readonly paintGeometryDialog: DialogDisplacementPaintGeometry;
  /** Paint Alpha window. */
  readonly paintAlphaDialog: DialogDisplacementPaintAlpha;
  private readonly unsubscribers: ReadonlyArray<() => void>;

  /**
   * Creates the paint windows and opens the one the current state asks for.
   *
   * @param host Parent element hosting floating panels.
   * @param options Status reporting.
   */
  constructor(
    host: HTMLElement,
    private readonly options: DisplacementPaintWindowsOptions = {},
  ) {
    this.paintGeometryDialog = new DialogDisplacementPaintGeometry(host);
    this.paintAlphaDialog = new DialogDisplacementPaintAlpha(host);
    this.unsubscribers = [
      getStateDisplacementSculpt().changeListenerAdd(() => this.visibilitySync()),
      getStateFaceEditSession().changeListenerAdd(() => this.visibilitySync()),
    ];
    this.visibilitySync();
  }

  /** Removes the listeners and disposes both windows. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.dialogsRead().forEach((dialog) => dialog.dispose());
  }

  /**
   * Opens the window of the active paint tool while the sheet shows the
   * Displacement tab and closes the others.
   */
  private visibilitySync(): void {
    const session = getStateFaceEditSession();
    const isTabShown = session.sheetOpenRead() && session.activeTabIdRead() === 'displacement';
    const activeTool = getStateDisplacementSculpt().settingsRead().activeTool;
    this.dialogsRead().forEach((dialog) =>
      this.dialogVisibilityWrite(dialog, isTabShown && activeTool === dialog.paintTool),
    );
  }

  /**
   * Opens or closes one window and reports its mouse bindings when it opens.
   *
   * @param dialog Paint window.
   * @param isShown True to open the window.
   */
  private dialogVisibilityWrite(dialog: DialogDisplacementPaintBase, isShown: boolean): void {
    const wasOpen = dialog.isOpen();
    dialog.visibilityWrite(isShown);
    if (isShown && !wasOpen) {
      this.options.statusReport?.(dialog.bindingHintRead());
    }
  }

  /**
   * Lists both windows.
   *
   * @returns Paint windows.
   */
  private dialogsRead(): DialogDisplacementPaintBase[] {
    return [this.paintGeometryDialog, this.paintAlphaDialog];
  }
}
