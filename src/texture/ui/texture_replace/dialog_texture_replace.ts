import { Theme } from '@/theme.js';
import {
  PanelFloatingContentHost,
  type PanelFloatingContentHostOptions,
} from '@/ui/floating_panel/panel_floating_content_host.js';
import type { TextureReplaceScope } from '@/texture/replace/handler_texture_replace.js';
import type { TextureReplaceRunResult } from '@/texture/replace/texture_replace_runner.js';
import { faceInspectorCaptionCreate } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { InputWheelBindingSelect } from '@/ui/input/wheel/input_wheel_binding_select.js';

/** One material the replacement can find or paint. */
export interface DialogTextureReplaceMaterial {
  readonly id: string;
  readonly displayName: string;
}

/** Services the texture replacement dialog uses. */
export interface DialogTextureReplaceHandlers {
  /** Lists the materials offered in the Find and Replace lists. */
  materialsList: () => readonly DialogTextureReplaceMaterial[];
  /**
   * Returns the scope chosen when the dialog opens.
   *
   * @returns Scope matching the current selection.
   */
  scopeDefaultRead: () => TextureReplaceScope;
  /**
   * Paints every face using one material with another.
   *
   * @param findTextureId Material to replace.
   * @param replaceTextureId Material painted instead.
   * @param scope Every brush or only the selected ones.
   * @returns Face count and message of the replacement.
   */
  replace: (findTextureId: string, replaceTextureId: string, scope: TextureReplaceScope) => TextureReplaceRunResult;
}

/** Scope choices of the In list. */
const DIALOG_TEXTURE_REPLACE_SCOPES: ReadonlyArray<readonly [TextureReplaceScope, string]> = [
  ['selection', 'Selected objects'],
  ['all', 'Everything'],
];

/** Title, size and placement of the Replace Textures window. */
const DIALOG_TEXTURE_REPLACE_HOST_OPTIONS: PanelFloatingContentHostOptions = {
  titleText: 'Replace Textures',
  className: 'dialog-texture-replace',
  width: '300px',
  height: 'auto',
  centered: true,
  closeOnEscape: true,
};

/**
 * Hammer++ Replace Textures window: picks the material to find, the material
 * painted instead and whether to search the selection or everything.
 */
export class DialogTextureReplace extends PanelFloatingContentHost {
  private readonly handlers: DialogTextureReplaceHandlers;
  private readonly findSelect: HTMLSelectElement;
  private readonly replaceSelect: HTMLSelectElement;
  private readonly scopeSelect: HTMLSelectElement;
  private readonly resultCaption: HTMLElement;
  private readonly selectWheelBindings: readonly InputWheelBindingSelect[];

  /**
   * Creates the replacement window.
   *
   * @param host Parent element of floating windows.
   * @param handlers Material list, default scope and replacement.
   */
  constructor(host: HTMLElement, handlers: DialogTextureReplaceHandlers) {
    const bodyGrid = DialogTextureReplace.bodyGridCreate();
    super(host, DIALOG_TEXTURE_REPLACE_HOST_OPTIONS, bodyGrid);
    this.handlers = handlers;
    this.findSelect = this.selectCreate('dialog-texture-replace-find');
    this.replaceSelect = this.selectCreate('dialog-texture-replace-with');
    this.scopeSelect = this.selectCreate('dialog-texture-replace-scope');
    this.selectWheelBindings = [this.findSelect, this.replaceSelect, this.scopeSelect].map(
      (select) => new InputWheelBindingSelect(select),
    );
    this.resultCaption = faceInspectorCaptionCreate('');
    this.resultCaption.classList.add('dialog-texture-replace-result');
    this.bodyRowsAppend(bodyGrid);
  }

  /** Removes the list wheel listeners, then hides and removes the window. */
  override dispose(): void {
    this.selectWheelBindings.forEach((binding) => binding.dispose());
    super.dispose();
  }

  /**
   * Opens the window with a material preset as the one to find.
   *
   * @param findTextureId Material to find.
   */
  openFor(findTextureId: string): void {
    const materials = this.materialsWithTexture(findTextureId);
    this.materialOptionsWrite(this.findSelect, materials, findTextureId);
    this.materialOptionsWrite(this.replaceSelect, materials, findTextureId);
    this.scopeSelect.value = this.handlers.scopeDefaultRead();
    this.resultCaption.textContent = '';
    this.show();
  }

  /**
   * Runs the replacement with the chosen materials and scope.
   *
   * @returns Number of repainted faces.
   */
  replaceRun(): number {
    const scope: TextureReplaceScope = this.scopeSelect.value === 'all' ? 'all' : 'selection';
    const result = this.handlers.replace(this.findSelect.value, this.replaceSelect.value, scope);
    this.resultCaption.textContent = result.message;
    return result.faceCount;
  }

  /**
   * Creates the two-column grid holding the Find, Replace and In rows.
   *
   * @returns Grid element.
   */
  private static bodyGridCreate(): HTMLElement {
    const grid = document.createElement('div');
    grid.classList.add('dialog-texture-replace-body');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '64px 1fr';
    grid.style.alignItems = 'center';
    grid.style.gap = '6px';
    grid.style.padding = '8px';
    return grid;
  }

  /**
   * Lists the offered materials, adding the given texture when the list lacks
   * it.
   *
   * @param textureId Texture that must be offered.
   * @returns Materials to offer.
   */
  private materialsWithTexture(textureId: string): DialogTextureReplaceMaterial[] {
    const materials = [...this.handlers.materialsList()];
    if (!materials.some((material) => material.id === textureId)) {
      materials.unshift({ id: textureId, displayName: textureId });
    }
    return materials;
  }

  /**
   * Fills a material list and chooses one entry.
   *
   * @param select List to fill.
   * @param materials Materials to offer.
   * @param chosenId Material chosen afterwards.
   */
  private materialOptionsWrite(
    select: HTMLSelectElement,
    materials: readonly DialogTextureReplaceMaterial[],
    chosenId: string,
  ): void {
    select.replaceChildren(...materials.map((material) => this.optionCreate(material.id, material.displayName)));
    select.value = chosenId;
  }

  /**
   * Creates one list option.
   *
   * @param value Option value.
   * @param label Option text.
   * @returns Option element.
   */
  private optionCreate(value: string, label: string): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  /**
   * Creates a themed list.
   *
   * @param className Class name of the list.
   * @returns List element.
   */
  private selectCreate(className: string): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = className;
    select.style.background = Theme.inputBackgroundColor;
    select.style.color = Theme.buttonTextColor;
    select.style.border = `1px solid ${Theme.inputBorderColor}`;
    select.style.borderRadius = '3px';
    select.style.fontSize = '11px';
    select.style.minWidth = '0';
    return select;
  }

  /**
   * Fills the body grid with the Find, Replace and In rows and the action row.
   *
   * @param bodyGrid Grid hosted in the window body.
   */
  private bodyRowsAppend(bodyGrid: HTMLElement): void {
    DIALOG_TEXTURE_REPLACE_SCOPES.forEach(([scope, label]) =>
      this.scopeSelect.appendChild(this.optionCreate(scope, label)),
    );
    bodyGrid.append(
      faceInspectorCaptionCreate('Find:'),
      this.findSelect,
      faceInspectorCaptionCreate('Replace:'),
      this.replaceSelect,
      faceInspectorCaptionCreate('In:'),
      this.scopeSelect,
      this.resultCaption,
      this.replaceButtonCreate(),
    );
  }

  /**
   * Creates the button that runs the replacement.
   *
   * @returns Button element.
   */
  private replaceButtonCreate(): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: 'Replace',
      widthPx: null,
      heightPx: 22,
      onClick: () => this.replaceRun(),
    });
    button.classList.add('dialog-texture-replace-run');
    return button;
  }
}
