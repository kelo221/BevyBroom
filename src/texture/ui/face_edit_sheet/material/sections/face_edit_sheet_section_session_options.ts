import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import { faceAttributesUvToolButtonHighlightApply } from '@/texture/ui/face_attributes/face_attributes_uv_tool_specs.js';
import { getStateFaceEditSession, type FaceEditPickMode } from '@/texture/paint/state_face_edit_session.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import { FaceEditSheetSection } from './face_edit_sheet_section.js';

/** Button label of every Face Edit Sheet click mode. */
export const FACE_EDIT_SHEET_PICK_MODE_LABELS: Readonly<Record<FaceEditPickMode, string>> = {
  lift_select: 'Lift+Select',
  lift: 'Lift',
  select: 'Select',
  apply: 'Apply',
};

/**
 * Builds the text of the Mode button for a click mode.
 *
 * @param mode Click mode.
 * @returns Button text such as `Mode: Lift+Select`.
 */
export function faceEditSheetPickModeButtonText(mode: FaceEditPickMode): string {
  return `Mode: ${FACE_EDIT_SHEET_PICK_MODE_LABELS[mode]}`;
}

/**
 * Right column of the Material tab: the Treat as one box, the Mode button that
 * cycles Lift+Select / Lift / Select / Apply, and the Hide mask toggle.
 */
export class FaceEditSheetSectionSessionOptions extends FaceEditSheetSection {
  private readonly treatAsOneCheckbox: InputCheckbox;
  private readonly pickModeButton: HTMLButtonElement;
  private readonly hideMaskButton: HTMLButtonElement;

  /**
   * Creates the Treat as one box, the Mode button and the Hide mask toggle.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-session-options');
    this.treatAsOneCheckbox = this.treatAsOneCheckboxCreate();
    this.pickModeButton = this.buttonCreate('Cycle click mode', 'face-edit-sheet-pick-mode', () =>
      getStateFaceEditSession().pickModeCycle(),
    );
    this.hideMaskButton = this.buttonCreate('Hide mask', 'face-edit-sheet-hide-mask', () =>
      getStateFaceEditSession().hideMaskWrite(!getStateFaceEditSession().hideMaskRead()),
    );
    this.layoutStyleApply();
    this.element.append(
      faceEditSheetCheckboxLabelCreate(this.treatAsOneCheckbox, 'Treat as one'),
      this.pickModeButton,
      this.hideMaskButton,
    );
  }

  /** Shows Treat as one, the click mode and whether the mask is hidden. */
  override sessionSync(): void {
    const session = getStateFaceEditSession();
    this.treatAsOneCheckbox.setSharedValues([session.treatAsOneRead()]);
    this.pickModeButton.textContent = faceEditSheetPickModeButtonText(session.pickModeRead());
    this.hideMaskButton.setAttribute('aria-pressed', String(session.hideMaskRead()));
    faceAttributesUvToolButtonHighlightApply(this.hideMaskButton, session.hideMaskRead());
  }

  /** Stacks the controls in one column. */
  private layoutStyleApply(): void {
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = `${FACE_INSPECTOR_METRICS.gap + 2}px`;
    this.element.style.minWidth = '0';
  }

  /**
   * Creates the Treat as one box that writes the session flag.
   *
   * @returns Checkbox.
   */
  private treatAsOneCheckboxCreate(): InputCheckbox {
    const checkbox = new InputCheckbox('Treat as one');
    checkbox.getElement().classList.add('face-edit-sheet-treat-as-one');
    checkbox.bindCommit(() => getStateFaceEditSession().treatAsOneWrite(checkbox.getValue()));
    return checkbox;
  }

  /**
   * Creates one full-width text button.
   *
   * @param title Accessible name and initial text.
   * @param className Class name of the button.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private buttonCreate(title: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = buttonCompactCreate({
      title,
      widthPx: null,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick,
    });
    button.classList.add(className);
    button.style.width = '100%';
    return button;
  }
}
