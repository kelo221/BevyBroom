import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { applyFloatingPanelToolChrome } from '@/ui/floating_panel/panel_floating_tool_chrome.js';
import { TabBook } from '@/ui/tabs/tab_book.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import type { DialogFaceEditSheetHandlers } from './face_edit_sheet_handlers.js';
import { FaceEditSheetMaterialTab } from './material/face_edit_sheet_material_tab.js';
import type { FaceEditSheetSelectionState } from './material/sections/face_edit_sheet_section.js';

/** Outer width of the Face Edit Sheet window. */
const DIALOG_FACE_EDIT_SHEET_WIDTH = '380px';

/**
 * Floating Hammer++ Face Edit Sheet (`Material` | `Displacement` tabs) synced
 * with `StateFaceEditSession` and `StateTexturePaint`. Opens centered and keeps
 * its dragged position on later opens.
 */
export class DialogFaceEditSheet extends PanelFloating {
  private readonly tabBook: TabBook;
  private readonly materialTab: FaceEditSheetMaterialTab;
  private readonly displacementBody: HTMLElement;
  private readonly unsubscribers: ReadonlyArray<() => void>;

  /**
   * Creates the floating Face Edit Sheet.
   *
   * @param host Parent element hosting floating panels.
   * @param handlers UV and material action callbacks.
   */
  constructor(host: HTMLElement, handlers: DialogFaceEditSheetHandlers) {
    super(host, { centered: true, draggable: true, closeOnEscape: true });
    this.tabBook = this.tabBookCreate(host.ownerDocument);
    this.materialTab = new FaceEditSheetMaterialTab(handlers);
    this.displacementBody = this.displacementBodyCreate(host.ownerDocument);
    this.shellBuild();
    this.unsubscribers = [
      getStateFaceEditSession().changeListenerAdd(() => this.syncFromSessionState()),
      getStateTexturePaint().changeListenerAdd(() => this.materialTab.textureSync()),
    ];
    this.syncFromSessionState();
    this.materialTab.textureSync();
  }

  /**
   * Returns the `Displacement` tab body container so the Displacement panel can
   * mount into the Face Edit Sheet.
   *
   * @returns Displacement tab body element.
   */
  displacementTabBodyRead(): HTMLElement {
    return this.displacementBody;
  }

  /**
   * Shows the face selection values in the Material tab.
   *
   * @param selection Face selection values.
   */
  selectionWrite(selection: FaceEditSheetSelectionState): void {
    this.materialTab.selectionWrite(selection);
  }

  /** Disposes listeners and removes the floating panel. */
  override dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.materialTab.dispose();
    this.tabBook.dispose();
    super.dispose();
  }

  /** Refreshes the current texture and its list after opening. */
  protected override onAfterShow(): void {
    this.materialTab.textureSync();
  }

  /** Syncs `sheetOpenWrite(false)` when hidden via Escape or title bar. */
  protected override onAfterHide(): void {
    getStateFaceEditSession().sheetOpenWrite(false);
  }

  /**
   * Creates the tab book whose active tab is stored in the session.
   *
   * @param doc Owner document.
   * @returns Tab book.
   */
  private tabBookCreate(doc: Document): TabBook {
    const tabBook = new TabBook({ ariaLabel: 'Face Edit Sheet', ownerDocument: doc });
    tabBook.getElement().style.flex = '1 1 auto';
    tabBook.getElement().style.minHeight = '0';
    tabBook.getElement().style.overflowY = 'auto';
    tabBook.tabChangeListenerAdd((id) => {
      if (id === 'material' || id === 'displacement') {
        getStateFaceEditSession().activeTabIdWrite(id);
      }
    });
    return tabBook;
  }

  /**
   * Creates the padded Displacement tab body.
   *
   * @param doc Owner document.
   * @returns Displacement tab body.
   */
  private displacementBodyCreate(doc: Document): HTMLElement {
    const body = doc.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '6px';
    body.style.padding = '8px';
    return body;
  }

  /** Builds the floating window shell: title bar, then the two tabs. */
  private shellBuild(): void {
    this.root.classList.add('dialog-face-edit-sheet');
    applyFloatingPanelToolChrome(this.root, {
      width: DIALOG_FACE_EDIT_SHEET_WIDTH,
      maxHeight: 'calc(100vh - 48px)',
      borderBox: true,
      overflowHidden: true,
    });
    const titleParts = this.createStandardTitleBar({ titleText: 'Face Edit Sheet', flexShrinkZero: true });
    this.tabBook.tabAdd({ id: 'material', label: 'Material', pageResolve: () => this.materialTab.elementRead() });
    this.tabBook.tabAdd({ id: 'displacement', label: 'Displacement', pageResolve: () => this.displacementBody });
    this.root.append(titleParts.bar, this.tabBook.getElement());
  }

  /**
   * Synchronizes the Material tab, tab selection and visibility from the
   * session.
   */
  private syncFromSessionState(): void {
    const session = getStateFaceEditSession();
    this.materialTab.sessionSync();
    this.tabBook.tabShow(session.activeTabIdRead());
    if (session.sheetOpenRead() && !this.isOpen()) {
      this.show();
    } else if (!session.sheetOpenRead() && this.isOpen()) {
      this.hide();
    }
  }
}
