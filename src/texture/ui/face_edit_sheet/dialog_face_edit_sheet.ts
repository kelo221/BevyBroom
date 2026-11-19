import { PanelToolOptions } from '@/ui/dock/tool_options/panel_tool_options.js';
import { TabBook } from '@/ui/tabs/tab_book.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import type { DialogFaceEditSheetHandlers } from './face_edit_sheet_handlers.js';
import { FaceEditSheetMaterialTab } from './material/face_edit_sheet_material_tab.js';
import type { FaceEditSheetSelectionState } from './material/sections/face_edit_sheet_section.js';

/**
 * Hammer++ Face Edit Sheet (`Material` | `Displacement` tabs) shown as the face
 * tool's options in the right dock, synced with `StateFaceEditSession` and
 * `StateTexturePaint`.
 */
export class DialogFaceEditSheet extends PanelToolOptions {
  private readonly tabBook: TabBook;
  private readonly materialTab: FaceEditSheetMaterialTab;
  private readonly displacementBody: HTMLElement;
  private readonly unsubscribers: ReadonlyArray<() => void>;

  /**
   * Creates the Face Edit Sheet.
   *
   * @param host Element tool options are shown in.
   * @param handlers UV and material action callbacks.
   */
  constructor(host: HTMLElement, handlers: DialogFaceEditSheetHandlers) {
    super(host, { titleText: 'Face Edit Sheet', className: 'dialog-face-edit-sheet' });
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

  /** Disposes listeners and removes the section. */
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

  /** Syncs `sheetOpenWrite(false)` when hidden from its Close button. */
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

  /** Adds the Material and Displacement tabs to the section body. */
  private shellBuild(): void {
    this.body.style.padding = '0';
    this.tabBook.tabAdd({ id: 'material', label: 'Material', pageResolve: () => this.materialTab.elementRead() });
    this.tabBook.tabAdd({ id: 'displacement', label: 'Displacement', pageResolve: () => this.displacementBody });
    this.body.appendChild(this.tabBook.getElement());
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
