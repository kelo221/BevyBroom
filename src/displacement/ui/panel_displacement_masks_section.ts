import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import {
  PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX,
  PanelDisplacementSection,
  type PanelDisplacementActionRun,
} from './panel_displacement_section.js';
import { formLayoutRowCreate } from '@/ui/form/form_layout.js';

/**
 * Hammer++ style Masks group of the Displacement tab: the Grid mask (grid
 * wireframe on displaced faces), the Select mask (face selection highlight) and
 * the Select Adjacent button.
 */
export class PanelDisplacementMasksSection extends PanelDisplacementSection {
  private readonly gridCheckbox = new InputCheckbox('Grid mask');
  private readonly selectCheckbox = new InputCheckbox('Select mask');

  /**
   * Builds the mask checkboxes and binds them to the Face Edit Sheet session.
   *
   * @param actionRun Runs an action on the selected faces.
   */
  constructor(private readonly actionRun: PanelDisplacementActionRun) {
    super('Masks', 'panel-displacement-masks');
    this.element.append(
      formLayoutRowCreate([
        faceEditSheetCheckboxLabelCreate(this.gridCheckbox, 'Grid'),
        faceEditSheetCheckboxLabelCreate(this.selectCheckbox, 'Select'),
        this.selectAdjacentButtonCreate(),
      ]),
    );
    this.commitHandlersBind();
    this.disposerAdd(getStateFaceEditSession().changeListenerAdd(() => this.sessionShow()));
    this.sessionShow();
  }

  /** Writes checkbox changes into the Face Edit Sheet session. */
  private commitHandlersBind(): void {
    this.gridCheckbox.bindCommit(() => getStateFaceEditSession().gridMaskWrite(this.gridCheckbox.getValue()));
    this.selectCheckbox.bindCommit(() => getStateFaceEditSession().hideMaskWrite(!this.selectCheckbox.getValue()));
  }

  /** Shows the session's mask states in the checkboxes. */
  private sessionShow(): void {
    const session = getStateFaceEditSession();
    this.gridCheckbox.setSharedValues([session.gridMaskRead()]);
    this.selectCheckbox.setSharedValues([!session.hideMaskRead()]);
  }

  /**
   * Creates the Select Adjacent button.
   *
   * @returns Button element.
   */
  private selectAdjacentButtonCreate(): HTMLButtonElement {
    return buttonCompactCreate({
      title: 'Select Adjacent',
      text: 'Select Adjacent',
      widthPx: null,
      heightPx: PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX,
      onClick: () => this.actionRun((actions) => actions.selectAdjacent()),
    });
  }
}
