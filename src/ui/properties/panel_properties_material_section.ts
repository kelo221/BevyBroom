import * as THREE from 'three';
import { Theme } from '@/theme.js';
import type { PanelPropertiesColorSession } from './panel_properties_color_session.js';
import type { PanelPropertiesSectionChrome } from './panel_properties_section.js';

/** Color shown when no mesh color is shared. */
const PANEL_PROPERTIES_MATERIAL_NEUTRAL_COLOR = '#ffffff';

/**
 * Inspector Material section: one color picker that edits the material color of
 * every selected mesh as a single coalesced undo step.
 */
export class PanelPropertiesMaterialSection {
  private readonly section: HTMLElement;
  private readonly colorInput: HTMLInputElement;
  private readonly colorSession: PanelPropertiesColorSession;
  private readonly editableObjectsRead: () => THREE.Object3D[];

  /**
   * Creates the section.
   *
   * @param chrome Section element factories.
   * @param colorSession Session that coalesces color edits into undo steps.
   * @param editableObjectsRead Returns the bound objects that may be edited.
   */
  constructor(
    chrome: PanelPropertiesSectionChrome,
    colorSession: PanelPropertiesColorSession,
    editableObjectsRead: () => THREE.Object3D[],
  ) {
    this.colorSession = colorSession;
    this.editableObjectsRead = editableObjectsRead;
    this.colorInput = this.colorInputCreate();
    this.section = chrome.createSectionContainer();
    this.section.appendChild(chrome.createSectionHeader('Material'));
    this.section.appendChild(this.contentCreate());
  }

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.section;
  }

  /**
   * Shows the shared mesh color of the objects, or a dimmed neutral color when
   * they differ or carry none.
   *
   * @param objects Selected objects.
   */
  updateFromObjects(objects: readonly THREE.Object3D[]): void {
    const colors = panelPropertiesMaterialColorsCollect(objects);
    const first = colors[0];
    const isShared = first !== undefined && colors.every((color) => color === first);
    this.colorInput.value = isShared
      ? `#${first.toString(16).padStart(6, '0')}`
      : PANEL_PROPERTIES_MATERIAL_NEUTRAL_COLOR;
    this.colorInput.style.opacity = isShared || colors.length === 0 ? '1' : '0.55';
  }

  /** Resets the picker to the neutral color. */
  clear(): void {
    this.updateFromObjects([]);
  }

  /**
   * Builds the content row holding the label and picker.
   *
   * @returns Content element.
   */
  private contentCreate(): HTMLElement {
    const content = document.createElement('div');
    content.style.padding = '6px 8px';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.append(this.labelCreate(), this.colorInput);
    content.appendChild(row);
    return content;
  }

  /**
   * Creates the "Color" label.
   *
   * @returns Styled label element.
   */
  private labelCreate(): HTMLElement {
    const label = document.createElement('span');
    label.textContent = 'Color';
    label.style.color = Theme.buttonTextColor;
    label.style.fontFamily = 'monospace';
    label.style.fontSize = '12px';
    return label;
  }

  /**
   * Creates the color input and binds its edit and finalize listeners.
   *
   * @returns Configured color input element.
   */
  private colorInputCreate(): HTMLInputElement {
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = PANEL_PROPERTIES_MATERIAL_NEUTRAL_COLOR;
    colorInput.style.width = '48px';
    colorInput.style.height = '24px';
    colorInput.style.border = 'none';
    colorInput.style.background = 'transparent';
    colorInput.style.cursor = 'pointer';
    colorInput.addEventListener('input', () => this.colorEdited());
    colorInput.addEventListener('change', () => this.colorEdited());
    colorInput.addEventListener('blur', () => this.colorSession.finalize());
    return colorInput;
  }

  /** Applies the picker value to every editable mesh through the color session. */
  private colorEdited(): void {
    const meshes = panelPropertiesMaterialEditableMeshes(this.editableObjectsRead());
    const trimmed = this.colorInput.value.trim();
    if (meshes.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      return;
    }
    this.colorSession.onColorEdited(parseInt(trimmed.slice(1), 16), meshes);
    this.colorInput.style.opacity = '1';
  }
}

/**
 * Returns the meshes whose single material exposes a writable color.
 *
 * @param objects Candidate objects.
 * @returns Meshes with a colored material.
 */
export function panelPropertiesMaterialEditableMeshes(objects: readonly THREE.Object3D[]): THREE.Mesh[] {
  return objects.filter((object): object is THREE.Mesh => {
    if (!(object instanceof THREE.Mesh)) {
      return false;
    }
    const material: unknown = object.material;
    return typeof material === 'object' && material !== null && !Array.isArray(material) && 'color' in material;
  });
}

/**
 * Collects the material color of every colored mesh.
 *
 * @param objects Candidate objects.
 * @returns Colors as 0xRRGGBB numbers.
 */
function panelPropertiesMaterialColorsCollect(objects: readonly THREE.Object3D[]): number[] {
  return panelPropertiesMaterialEditableMeshes(objects).map((mesh) =>
    (mesh.material as THREE.MeshStandardMaterial).color.getHex(),
  );
}
