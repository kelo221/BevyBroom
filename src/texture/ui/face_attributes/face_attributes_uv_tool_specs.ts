import { buttonCompactActiveWrite } from '@/ui/button/button_compact.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';
import type { FaceAttributesUvToolStripHandlers } from './face_attributes_uv_tool_strip.js';

/** Declarative description of one face UV tool button. */
export interface FaceAttributesUvToolButtonSpec {
  /** Button label and tooltip. */
  readonly title: string;
  /** Runs the button's operation against the tool handlers. */
  readonly run: (handlers: FaceAttributesUvToolStripHandlers) => void;
  /** Highlight flag read from the selection status, when tracked. */
  readonly isHighlighted?: (status: FaceUvToolSelectionStatus) => boolean;
}

/** Every face UV tool button, keyed by the operation it runs. */
export const FACE_ATTRIBUTES_UV_TOOL_SPECS = Object.freeze({
  fitU: { title: 'Fit H', run: (h) => h.onFit('u'), isHighlighted: (s) => s.fittedU },
  fitV: { title: 'Fit V', run: (h) => h.onFit('v'), isHighlighted: (s) => s.fittedV },
  fitBoth: { title: 'Fit', run: (h) => h.onFit('both'), isHighlighted: (s) => s.fittedU && s.fittedV },
  justifyLeft: { title: 'Justify ←', run: (h) => h.onJustify('left'), isHighlighted: (s) => s.justifiedLeft },
  justifyRight: { title: 'Justify →', run: (h) => h.onJustify('right'), isHighlighted: (s) => s.justifiedRight },
  justifyTop: { title: 'Justify ↑', run: (h) => h.onJustify('top'), isHighlighted: (s) => s.justifiedTop },
  justifyBottom: { title: 'Justify ↓', run: (h) => h.onJustify('bottom'), isHighlighted: (s) => s.justifiedBottom },
  justifyCenter: { title: 'Center', run: (h) => h.onJustify('center'), isHighlighted: (s) => s.justifiedCenter },
  alignPrevious: { title: 'Align ◀', run: (h) => h.onAlignEdge('previous'), isHighlighted: (s) => s.aligned },
  alignBest: { title: 'Align', run: (h) => h.onAlignEdge('best'), isHighlighted: (s) => s.aligned },
  alignNext: { title: 'Align ▶', run: (h) => h.onAlignEdge('next'), isHighlighted: (s) => s.aligned },
  flipHorizontal: { title: 'Flip H', run: (h) => h.onFlip('horizontal') },
  flipVertical: { title: 'Flip V', run: (h) => h.onFlip('vertical') },
  rotateCounterClockwise: { title: 'Rot −90', run: (h) => h.onRotate(-90) },
  rotateClockwise: { title: 'Rot 90', run: (h) => h.onRotate(90) },
  resetFace: { title: 'Reset Face', run: (h) => h.onResetFace() },
  resetWorld: { title: 'Reset World', run: (h) => h.onResetWorld() },
} as const satisfies Record<string, FaceAttributesUvToolButtonSpec>);

/**
 * Button rows of the docked UV tool strip: fit and justify, then align to
 * reset.
 */
export const FACE_ATTRIBUTES_UV_TOOL_ROWS_DEFAULT: ReadonlyArray<readonly FaceAttributesUvToolButtonSpec[]> = [
  [
    FACE_ATTRIBUTES_UV_TOOL_SPECS.fitU,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.fitV,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.fitBoth,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyLeft,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyRight,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyTop,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyBottom,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyCenter,
  ],
  [
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignPrevious,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignBest,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignNext,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.flipHorizontal,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.flipVertical,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.rotateCounterClockwise,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.rotateClockwise,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.resetFace,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.resetWorld,
  ],
];

/**
 * Shows a compact UV tool button as highlighted (already satisfied) or idle.
 *
 * @param button Compact button element.
 * @param highlighted Whether the condition is satisfied.
 */
export function faceAttributesUvToolButtonHighlightApply(button: HTMLButtonElement, highlighted: boolean): void {
  buttonCompactActiveWrite(button, highlighted);
}
