import { ShadingMode } from '@/types/shading_mode.js';
import {
  VIEWPORT_KIND_MENU_ORDER,
  ViewportKind,
  getViewportKindDisplayLabel,
  isPerspectiveViewportKind,
} from '@/viewports/core/viewport_kind.js';
import { viewportAxisPairForKind } from './viewport_axis_caption.js';

/** One view a viewport can switch to: a view kind with an optional shading mode. */
export interface ViewportViewChoice {
  /** Menu label such as "2D Top (x/z)" or "3D Textured". */
  readonly label: string;
  /** View kind the pane switches to. */
  readonly kind: ViewportKind;
  /** Shading mode applied with the kind, or null to keep the pane shading. */
  readonly shadingMode: ShadingMode | null;
}

/**
 * Shading modes offered by the 3D view choices with their label words, in menu
 * order.
 */
const VIEWPORT_VIEW_CHOICE_3D_SHADINGS: ReadonlyArray<{ readonly word: string; readonly mode: ShadingMode }> = [
  { word: 'Wireframe', mode: ShadingMode.WIREFRAME },
  { word: 'Wireframe Overlay', mode: ShadingMode.WIREFRAME_OVERLAY },
  { word: 'Flat', mode: ShadingMode.FLAT },
  { word: 'Textured', mode: ShadingMode.SOLID },
];

/**
 * Builds the view choice of an orthographic kind, labelled with its screen
 * axes.
 *
 * @param kind Orthographic viewport kind.
 * @returns View choice that keeps the pane shading.
 */
function viewportViewChoice2dCreate(kind: ViewportKind): ViewportViewChoice {
  const label = `2D ${getViewportKindDisplayLabel(kind)} (${viewportAxisPairForKind(kind)})`;
  return { label, kind, shadingMode: null };
}

/**
 * Builds the perspective view choice of one shading mode.
 *
 * @param word Label word of the shading mode.
 * @param mode Shading mode applied with the perspective kind.
 * @returns Perspective view choice.
 */
function viewportViewChoice3dCreate(word: string, mode: ShadingMode): ViewportViewChoice {
  return { label: `3D ${word}`, kind: ViewportKind.PERSPECTIVE, shadingMode: mode };
}

/** Orthographic view choices in menu order. */
export const VIEWPORT_VIEW_CHOICES_2D: readonly ViewportViewChoice[] = VIEWPORT_KIND_MENU_ORDER.filter(
  (kind) => !isPerspectiveViewportKind(kind),
).map((kind) => viewportViewChoice2dCreate(kind));

/** Perspective view choices, one per shading mode, in menu order. */
export const VIEWPORT_VIEW_CHOICES_3D: readonly ViewportViewChoice[] = VIEWPORT_VIEW_CHOICE_3D_SHADINGS.map((entry) =>
  viewportViewChoice3dCreate(entry.word, entry.mode),
);

/**
 * Returns whether a view choice describes the current kind and shading of a
 * pane. A choice without a shading mode matches on the kind alone.
 *
 * @param choice View choice to test.
 * @param kind Current view kind of the pane.
 * @param shadingMode Current shading mode of the pane.
 * @returns True when the choice is the current view.
 */
export function viewportViewChoiceIsCurrent(
  choice: ViewportViewChoice,
  kind: ViewportKind,
  shadingMode: ShadingMode,
): boolean {
  if (choice.kind !== kind) {
    return false;
  }
  return choice.shadingMode === null || choice.shadingMode === shadingMode;
}
