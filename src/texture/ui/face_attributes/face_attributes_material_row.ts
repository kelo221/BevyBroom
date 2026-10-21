import { Theme } from '@/theme.js';
import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorCaptionCreate,
  faceInspectorPreviewImageWrite,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';

/** Edge length of the material preview swatch in pixels. */
const FACE_ATTRIBUTES_MATERIAL_SWATCH_PX = 40;

/** Display name and preview image of one material. */
export interface FaceAttributesMaterialDescription {
  displayName: string;
  previewObjectUrl: string | null;
}

/**
 * Looks up how a material is shown.
 *
 * @param textureId Texture identity.
 * @returns Description, or null when the material is not in the library.
 */
export type FaceAttributesMaterialDescriber = (textureId: string) => FaceAttributesMaterialDescription | null;

/** Top row of the face attributes: material swatch, name and face count. */
export class FaceAttributesMaterialRow {
  private readonly element: HTMLElement;
  private readonly swatchElement: HTMLElement;
  private readonly nameElement: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly materialDescribe: FaceAttributesMaterialDescriber;

  /**
   * Creates the material row.
   *
   * @param materialDescribe Looks up the name and preview of a material.
   */
  constructor(materialDescribe: FaceAttributesMaterialDescriber) {
    this.materialDescribe = materialDescribe;
    this.element = document.createElement('div');
    this.swatchElement = document.createElement('div');
    this.nameElement = document.createElement('div');
    this.statusElement = faceInspectorCaptionCreate('');
    this.rowStyleApply();
    this.swatchStyleApply();
    this.nameStyleApply();
    this.element.append(this.swatchElement, this.textColumnCreate());
  }

  /**
   * Returns the row element.
   *
   * @returns Row DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the selection's shared material and its face region count.
   *
   * @param fields Field state with the shared texture id and target count.
   */
  setFromFieldState(fields: UvEditorTrsFieldState): void {
    const description = fields.textureId === null ? null : this.descriptionResolve(fields.textureId);
    this.nameElement.textContent = this.materialNameText(fields, description);
    faceInspectorPreviewImageWrite(this.swatchElement, description?.previewObjectUrl ?? null);
    this.statusElement.textContent =
      fields.targetCount === 0 ? 'No surfaces selected' : `${fields.targetCount} face region(s)`;
  }

  /**
   * Resolves a material description, falling back to the raw texture id.
   *
   * @param textureId Texture identity.
   * @returns Description to show.
   */
  private descriptionResolve(textureId: string): FaceAttributesMaterialDescription {
    return this.materialDescribe(textureId) ?? { displayName: textureId, previewObjectUrl: null };
  }

  /**
   * Chooses the material name text for the current selection.
   *
   * @param fields Field state.
   * @param description Shared material description, or null when mixed.
   * @returns Name text.
   */
  private materialNameText(
    fields: UvEditorTrsFieldState,
    description: FaceAttributesMaterialDescription | null,
  ): string {
    if (fields.targetCount === 0) {
      return '—';
    }
    return description?.displayName ?? 'Multiple materials';
  }

  /**
   * Creates the column holding the name above the status caption.
   *
   * @returns Text column element.
   */
  private textColumnCreate(): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.justifyContent = 'center';
    column.style.gap = '2px';
    column.style.minWidth = '0';
    column.append(this.nameElement, this.statusElement);
    return column;
  }

  /** Lays the swatch and text column side by side. */
  private rowStyleApply(): void {
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.gap = `${FACE_INSPECTOR_METRICS.gap + 4}px`;
    this.element.style.padding = `${FACE_INSPECTOR_METRICS.paddingY}px ${FACE_INSPECTOR_METRICS.paddingX}px`;
    this.element.style.boxSizing = 'border-box';
    this.element.style.minWidth = '0';
  }

  /** Styles the square checker-backed preview swatch. */
  private swatchStyleApply(): void {
    const size = `${FACE_ATTRIBUTES_MATERIAL_SWATCH_PX}px`;
    this.swatchElement.dataset['materialPreview'] = 'true';
    this.swatchElement.setAttribute('role', 'img');
    this.swatchElement.setAttribute('aria-label', 'Material preview');
    this.swatchElement.style.width = size;
    this.swatchElement.style.height = size;
    this.swatchElement.style.flex = `0 0 ${size}`;
    this.swatchElement.style.border = `1px solid ${Theme.inputBorderColor}`;
    this.swatchElement.style.borderRadius = '2px';
    this.swatchElement.style.backgroundColor = '#111';
    this.swatchElement.style.backgroundSize = 'cover';
    this.swatchElement.style.backgroundPosition = 'center';
  }

  /** Styles the material name as the row's primary text. */
  private nameStyleApply(): void {
    this.nameElement.dataset['materialName'] = 'true';
    this.nameElement.style.color = Theme.buttonTextColor;
    this.nameElement.style.fontFamily = Theme.uiFontFamily;
    this.nameElement.style.fontSize = '12px';
    this.nameElement.style.overflow = 'hidden';
    this.nameElement.style.textOverflow = 'ellipsis';
    this.nameElement.style.whiteSpace = 'nowrap';
  }
}
