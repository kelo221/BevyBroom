import type { GameEntityAssetType, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { PanelDataAssetEditor } from '@/game_entity/data_asset/ui/panel_data_asset_editor.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Editor of a field referencing an editable data asset: the path picker plus
 * buttons that edit the referenced file or create a new one and reference it.
 */
export class GameEntityFieldEditorDataAsset extends GameEntityFieldEditor {
  private readonly assetType: GameEntityAssetType;
  private readonly pathEditor: GameEntityFieldEditor;
  private readonly panelResolve: () => PanelDataAssetEditor;
  private readonly editButton: HTMLButtonElement;
  private readonly element: HTMLElement;
  private sharedPath: string | null = null;

  /**
   * Creates the editor.
   *
   * @param field Asset field.
   * @param assetType Editable asset type the field references.
   * @param pathEditor Editor that picks the referenced path.
   * @param panelResolve Returns the panel that edits files; the shared panel by
   *   default.
   */
  constructor(
    field: GameEntityField,
    assetType: GameEntityAssetType,
    pathEditor: GameEntityFieldEditor,
    panelResolve: () => PanelDataAssetEditor = () => PanelDataAssetEditor.shared(),
  ) {
    super(field);
    this.assetType = assetType;
    this.pathEditor = pathEditor;
    this.panelResolve = panelResolve;
    this.pathEditor.bindCommit((edit) => this.editCommit(edit));
    this.editButton = GameEntityUiChrome.iconButtonCreate('✎', `Edit the ${assetType.label} file`, () =>
      this.referencedEdit(),
    );
    const createButton = GameEntityUiChrome.iconButtonCreate('+', `New ${assetType.label} file`, () =>
      this.referenceCreate(),
    );
    this.element = this.elementBuild(createButton);
  }

  /**
   * Returns the picker and its buttons.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the referenced paths; editing needs one shared path.
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    this.pathEditor.valuesShow(values);
    const first = values[0];
    const isShared = typeof first === 'string' && values.every((value) => value === first);
    this.sharedPath = isShared ? first : null;
    this.editButton.disabled = this.sharedPath === null;
  }

  /** Opens the shared referenced file in the data asset panel. */
  private referencedEdit(): void {
    if (this.sharedPath !== null) {
      void this.panelResolve().assetOpen(this.assetType, this.sharedPath);
    }
  }

  /** Offers a new file and references it once created. */
  private referenceCreate(): void {
    this.panelResolve().assetCreateBegin(this.assetType, (path) => this.editCommit(() => path));
  }

  /**
   * Lays out the picker followed by the buttons.
   *
   * @param createButton Button that creates a new file.
   * @returns Row element.
   */
  private elementBuild(createButton: HTMLElement): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '2px';
    const picker = this.pathEditor.getElement();
    picker.style.flex = '1';
    picker.style.minWidth = '0';
    row.append(picker, this.editButton, createButton);
    return row;
  }
}
