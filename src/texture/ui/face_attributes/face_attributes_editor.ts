import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { ToolbarIcons } from '@/ui/toolbar/toolbar_icons.js';
import type { FaceTextureAlign, FaceTextureMappingTrs } from '@/texture/uv/face_texture_mapping.js';
import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import type { UvRelativeTrsOp } from '@/texture/uv/uv_trs_ops.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorButtonCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import type { FaceAttributesView } from './face_attributes_view.js';
import { FaceAttributesFieldGrid } from './face_attributes_field_grid.js';
import { FaceAttributesMaterialRow, type FaceAttributesMaterialDescriber } from './face_attributes_material_row.js';
import { FaceAttributesUvToolStrip, type FaceAttributesUvToolStripHandlers } from './face_attributes_uv_tool_strip.js';
import type { FaceUvFitAxis } from '@/texture/uv/operations/face_uv_operation_fit.js';
import type { FaceUvJustifySide } from '@/texture/uv/operations/face_uv_operation_justify.js';
import type { FaceUvAlignEdgeMode } from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import type { FaceUvFlipAxis } from '@/texture/uv/operations/face_uv_operation_flip.js';
import type { FaceUvShearMode } from '@/texture/uv/operations/face_uv_operation_shear.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';

/** Callbacks the face attributes editor uses to apply texture mapping edits. */
export interface FaceAttributesEditorHandlers {
  onAlign: (align: FaceTextureAlign) => void;
  onApplyPartialTrs: (fields: Partial<FaceTextureMappingTrs>) => void;
  onRelativeOp: (op: UvRelativeTrsOp) => void;
  onReset: () => void;
  onFit: (axis: FaceUvFitAxis) => void;
  onJustify: (side: FaceUvJustifySide) => void;
  onAlignEdge: (mode: FaceUvAlignEdgeMode) => void;
  onFlip: (axis: FaceUvFlipAxis) => void;
  onRotate: (degrees: number) => void;
  onResetFace: () => void;
  onResetWorld: () => void;
  onShearCommit: (mode: FaceUvShearMode, factor: number | null) => void;
}

/** Field state shown before the first selection refresh. */
const FACE_ATTRIBUTES_EDITOR_INITIAL_STATE: UvEditorTrsFieldState = Object.freeze({
  scaleU: 1,
  scaleV: 1,
  offsetU: 0,
  offsetV: 0,
  rotationDeg: 0,
  align: 'auto',
  textureId: null,
  targetCount: 0,
});

/**
 * Docked face attributes panel: material row, align strip and a compact grid of
 * offset, scale and rotation fields with nudge buttons. Fills its parent's
 * width and has no window chrome.
 */
export class FaceAttributesEditor implements FaceAttributesView {
  private readonly element: HTMLElement;
  private readonly handlers: FaceAttributesEditorHandlers;
  private readonly materialRow: FaceAttributesMaterialRow;
  private readonly fieldGrid: FaceAttributesFieldGrid;
  private readonly uvToolStrip: FaceAttributesUvToolStrip;

  /**
   * Creates the face attributes editor.
   *
   * @param handlers Edit callbacks.
   * @param materialDescribe Looks up the name and preview of a material.
   */
  constructor(handlers: FaceAttributesEditorHandlers, materialDescribe: FaceAttributesMaterialDescriber) {
    this.handlers = handlers;
    this.element = document.createElement('div');
    this.materialRow = new FaceAttributesMaterialRow(materialDescribe);
    this.fieldGrid = new FaceAttributesFieldGrid({
      onFieldsCommit: (fields) => this.handlers.onApplyPartialTrs(fields),
      onRelativeOp: (op) => this.handlers.onRelativeOp(op),
    });
    this.uvToolStrip = new FaceAttributesUvToolStrip(this.uvToolStripHandlersRead());
    this.rootStyleApply();
    this.element.append(
      this.materialRow.getElement(),
      this.alignStripCreate(),
      this.uvToolStrip.getElement(),
      this.fieldGrid.getElement(),
    );
    this.setFromFieldState(FACE_ATTRIBUTES_EDITOR_INITIAL_STATE);
  }

  /**
   * Builds the callbacks the UV tool strip runs through this editor's handlers.
   *
   * @returns Tool strip handlers.
   */
  private uvToolStripHandlersRead(): FaceAttributesUvToolStripHandlers {
    return {
      onFit: (axis) => this.handlers.onFit(axis),
      onJustify: (side) => this.handlers.onJustify(side),
      onAlignEdge: (mode) => this.handlers.onAlignEdge(mode),
      onFlip: (axis) => this.handlers.onFlip(axis),
      onRotate: (degrees) => this.handlers.onRotate(degrees),
      onResetFace: () => this.handlers.onResetFace(),
      onResetWorld: () => this.handlers.onResetWorld(),
      onShearCommit: (mode, factor) => this.handlers.onShearCommit(mode, factor),
    };
  }

  /**
   * Returns the editor element.
   *
   * @returns Editor DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows shared or mixed face attribute values.
   *
   * @param fields Per-field state where null means mixed.
   */
  setFromFieldState(fields: UvEditorTrsFieldState): void {
    this.materialRow.setFromFieldState(fields);
    this.fieldGrid.setFromFieldState(fields);
  }

  /** Removes field listeners and detaches the editor element. */
  dispose(): void {
    this.fieldGrid.dispose();
    this.uvToolStrip.dispose();
    this.element.remove();
  }

  /**
   * Highlights the fit, justify, and align buttons satisfied by the single
   * selected face.
   *
   * @param status Status of the single selected face, or null.
   */
  setUvToolStatus(status: FaceUvToolSelectionStatus | null): void {
    this.uvToolStrip.setFromStatus(status);
  }

  /**
   * Shows the shared shear factors of the selection.
   *
   * @param shearU Shared U shear factor, or null when mixed.
   * @param shearV Shared V shear factor, or null when mixed.
   */
  setShearValues(shearU: number | null, shearV: number | null): void {
    this.uvToolStrip.setShearValues(shearU, shearV);
  }

  /** Styles the editor as a full-width block with a bottom separator. */
  private rootStyleApply(): void {
    this.element.dataset['faceAttributesEditor'] = 'true';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.width = '100%';
    this.element.style.boxSizing = 'border-box';
    this.element.style.background = hexToRgb(Theme.propertiesPanelBackground);
    this.element.style.borderBottom = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    this.element.style.fontFamily = Theme.uiFontFamily;
  }

  /**
   * Creates the strip of align preset and reset buttons.
   *
   * @returns Strip element.
   */
  private alignStripCreate(): HTMLElement {
    const strip = document.createElement('div');
    strip.style.display = 'flex';
    strip.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    strip.style.padding = `0 ${FACE_INSPECTOR_METRICS.paddingX}px`;
    strip.append(
      this.iconButtonCreate('Align to Floor', ToolbarIcons.alignFloor(), () => this.handlers.onAlign('floor')),
      this.iconButtonCreate('Align to Wall', ToolbarIcons.alignWall(), () => this.handlers.onAlign('wall')),
      this.iconButtonCreate('Align to Ceiling', ToolbarIcons.alignCeiling(), () => this.handlers.onAlign('ceiling')),
      this.iconButtonCreate('Reset UVs', ToolbarIcons.textureReset(), () => this.handlers.onReset()),
    );
    return strip;
  }

  /**
   * Creates one square icon button of the align strip.
   *
   * @param title Tooltip and accessible name.
   * @param svgIcon SVG markup.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private iconButtonCreate(title: string, svgIcon: string, onClick: () => void): HTMLButtonElement {
    const size = FACE_INSPECTOR_METRICS.iconButtonSize;
    return faceInspectorButtonCreate({ title, svgIcon, widthPx: size, heightPx: size, onClick });
  }
}
