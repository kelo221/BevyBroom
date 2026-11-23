import { Theme } from '@/theme.js';
import type { ToolInstruction } from '@/tools/chrome/instruction/tool_instruction.js';
import {
  TOOL_INSTRUCTION_CLIP_APPLY,
  TOOL_INSTRUCTION_CLIP_KEEP_BOTH,
  TOOL_INSTRUCTION_CLIP_KEEP_SIDE_A,
  TOOL_INSTRUCTION_CLIP_KEEP_SIDE_B,
} from '@/tools/chrome/instruction/tool_instruction_catalog.js';
import { styleViewportToolRailButton } from '@/tools/chrome/rail/viewport_tool_rail_button.js';
import { ClipKeepMode, clipKeepModeLabel } from '@/tools/clip_plane/clip_keep_mode.js';
import { viewportToolOptionsTextActionCreate } from './viewport_tool_options_control_style.js';

/** Actions the clip controls run. */
export interface ViewportToolClipControlsHandlers {
  onClipKeepModeSet: (mode: ClipKeepMode) => void;
  onClipApply: () => void;
}

/** Keep mode buttons in display order with their tooltips. */
const VIEWPORT_TOOL_CLIP_KEEP_MODE_BUTTONS: ReadonlyArray<readonly [ClipKeepMode, ToolInstruction]> = [
  [ClipKeepMode.SIDE_A, TOOL_INSTRUCTION_CLIP_KEEP_SIDE_A],
  [ClipKeepMode.SIDE_B, TOOL_INSTRUCTION_CLIP_KEEP_SIDE_B],
  [ClipKeepMode.BOTH, TOOL_INSTRUCTION_CLIP_KEEP_BOTH],
];

/**
 * Clip tool options: a "Keep" segmented choice of Side A, Side B or Both, and
 * an Apply button that is enabled once the plane is ready.
 */
export class ViewportToolClipControls {
  private readonly container: HTMLElement;
  private readonly keepModeButtons: Map<ClipKeepMode, HTMLButtonElement>;
  private readonly applyButton: HTMLButtonElement;
  private readonly handlers: ViewportToolClipControlsHandlers;

  /**
   * Creates the clip controls.
   *
   * @param ownerDocument Document used to construct DOM nodes.
   * @param handlers Actions the controls run.
   */
  constructor(ownerDocument: Document, handlers: ViewportToolClipControlsHandlers) {
    this.handlers = handlers;
    this.container = ownerDocument.createElement('div');
    this.keepModeButtons = new Map();
    this.containerStyle();
    this.container.appendChild(this.keepLabelCreate(ownerDocument));
    VIEWPORT_TOOL_CLIP_KEEP_MODE_BUTTONS.forEach(([mode, instruction]) => {
      const button = viewportToolOptionsTextActionCreate(ownerDocument, clipKeepModeLabel(mode), instruction, () =>
        this.handlers.onClipKeepModeSet(mode),
      );
      button.dataset['clipKeepMode'] = mode;
      this.keepModeButtons.set(mode, button);
      this.container.appendChild(button);
    });
    this.applyButton = viewportToolOptionsTextActionCreate(ownerDocument, 'Apply', TOOL_INSTRUCTION_CLIP_APPLY, () =>
      this.handlers.onClipApply(),
    );
    this.applyButton.style.marginLeft = '6px';
    this.container.appendChild(this.applyButton);
    this.clipStateSet(false, ClipKeepMode.SIDE_A);
  }

  /**
   * Returns the controls container element.
   *
   * @returns Container element.
   */
  elementRead(): HTMLElement {
    return this.container;
  }

  /**
   * Shows the current keep mode and whether Apply may run.
   *
   * @param isPlaneReady True when a plane is placed.
   * @param keepMode Current keep mode.
   */
  clipStateSet(isPlaneReady: boolean, keepMode: ClipKeepMode): void {
    this.keepModeButtons.forEach((button, mode) => styleViewportToolRailButton(button, mode === keepMode));
    this.applyButton.disabled = !isPlaneReady;
    this.applyButton.style.opacity = isPlaneReady ? '1' : '0.45';
  }

  /** Removes the controls from the DOM. */
  dispose(): void {
    this.container.remove();
  }

  /** Lays the controls out in one compact row. */
  private containerStyle(): void {
    this.container.className = 'viewport-tool-clip-controls';
    this.container.style.display = 'inline-flex';
    this.container.style.alignItems = 'center';
    this.container.style.gap = '2px';
  }

  /**
   * Creates the "Keep" label in front of the keep mode buttons.
   *
   * @param ownerDocument Document used to construct the label.
   * @returns Label element.
   */
  private keepLabelCreate(ownerDocument: Document): HTMLElement {
    const label = ownerDocument.createElement('span');
    label.textContent = 'Keep';
    label.style.fontFamily = Theme.uiFontFamily;
    label.style.fontSize = '11px';
    label.style.color = Theme.buttonTextColor;
    label.style.marginRight = '4px';
    return label;
  }
}
