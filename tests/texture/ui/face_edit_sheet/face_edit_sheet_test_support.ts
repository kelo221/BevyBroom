import { vi } from 'vitest';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import type { FaceEditSheetSelectionState } from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';
import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import { setStateFaceEditSessionForTests, StateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';

/** Face Edit Sheet handlers whose every callback is a spy. */
export type FaceEditSheetTestHandlers = {
  [Key in keyof Required<DialogFaceEditSheetHandlers>]: ReturnType<typeof vi.fn>;
};

/**
 * Creates Face Edit Sheet handlers whose callbacks are spies; the texture list
 * and describer return nothing until a test replaces them.
 *
 * @returns Spy handlers.
 */
export function faceEditSheetTestHandlersCreate(): FaceEditSheetTestHandlers {
  return {
    onAlign: vi.fn(),
    onApplyPartialTrs: vi.fn(),
    onRelativeOp: vi.fn(),
    onReset: vi.fn(),
    onFit: vi.fn(),
    onJustify: vi.fn(),
    onAlignEdge: vi.fn(),
    onFlip: vi.fn(),
    onRotate: vi.fn(),
    onResetFace: vi.fn(),
    onResetWorld: vi.fn(),
    onShearCommit: vi.fn(),
    onShiftFullTile: vi.fn(),
    onSetVectors2x3: vi.fn(),
    onMarkFacesWithTexture: vi.fn(),
    onBrowseMaterial: vi.fn(),
    onReplaceTexture: vi.fn(),
    onApplyTexture: vi.fn(),
    texturesList: vi.fn(() => []),
    textureDescribe: vi.fn(() => null),
  };
}

/**
 * Reads the spy handlers as Face Edit Sheet handlers.
 *
 * @param handlers Spy handlers.
 * @returns The same object typed as sheet handlers.
 */
export function faceEditSheetTestHandlersAsSheetHandlers(
  handlers: FaceEditSheetTestHandlers,
): DialogFaceEditSheetHandlers {
  return handlers as unknown as DialogFaceEditSheetHandlers;
}

/** Installs a fresh Face Edit Sheet session and resets the current texture. */
export function faceEditSheetTestStateReset(): void {
  setStateFaceEditSessionForTests(new StateFaceEditSession());
  getStateTexturePaint().reset();
}

/**
 * Builds a selection whose fields are shared values, overridden as given.
 *
 * @param fieldOverrides Field values replacing the defaults.
 * @param uvToolStatus Tool status of the single selected face, or null.
 * @returns Selection values.
 */
export function faceEditSheetTestSelectionCreate(
  fieldOverrides: Partial<UvEditorTrsFieldState> = {},
  uvToolStatus: FaceUvToolSelectionStatus | null = null,
): FaceEditSheetSelectionState {
  return {
    fields: {
      scaleU: 1,
      scaleV: 1,
      offsetU: 0,
      offsetV: 0,
      rotationDeg: 0,
      align: 'auto',
      textureId: null,
      targetCount: 1,
      ...fieldOverrides,
    },
    vectors: null,
    uvToolStatus,
    shearU: null,
    shearV: null,
  };
}

/**
 * Builds a tool status with every flag false except the given overrides.
 *
 * @param overrides Flags set to true.
 * @returns Status flags.
 */
export function faceEditSheetTestStatusCreate(
  overrides: Partial<FaceUvToolSelectionStatus>,
): FaceUvToolSelectionStatus {
  return {
    fittedU: false,
    fittedV: false,
    justifiedLeft: false,
    justifiedRight: false,
    justifiedTop: false,
    justifiedBottom: false,
    justifiedCenter: false,
    aligned: false,
    ...overrides,
  };
}

/**
 * Finds a button by its accessible name inside a root.
 *
 * @param root Element to search.
 * @param name Accessible name of the button.
 * @returns Button element.
 */
export function faceEditSheetTestButtonRead(root: ParentNode, name: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  if (!button) {
    throw new Error(`button not found: ${name}`);
  }
  return button;
}
