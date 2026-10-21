import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidModel } from '@/solid/model/solid_model.js';
import { computeBrushWorldBounds } from '@/solid/model/solid_brush_world_bounds.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/** What a solid model warning is about. */
export type SolidModelWarningKind = 'empty' | 'inverted_world' | 'subtractive_without_overlap';

/** One non-fatal problem of a solid model. */
export interface SolidModelWarning {
  /** What the warning is about. */
  readonly kind: SolidModelWarningKind;
  /** Explanation for the author. */
  readonly text: string;
  /** Brush the warning is about, or null when it is about the whole model. */
  readonly brush: SolidBrushInstance | null;
}

/**
 * Collects the non-fatal problems of a solid model: no brushes, an inverted
 * world, and subtractive brushes that overlap no additive brush.
 *
 * @param model Solid model.
 * @param brushes Brushes of the model in evaluation order.
 * @returns Warnings in model, then brush order.
 */
export function solidModelWarningsCollect(
  model: SolidModel,
  brushes: readonly SolidBrushInstance[] = model.getBrushes(),
): SolidModelWarning[] {
  const warnings: SolidModelWarning[] = [];
  if (brushes.length === 0) {
    warnings.push({ kind: 'empty', text: 'Solid model has no brushes', brush: null });
  }
  if (model.isInvertedWorld()) {
    warnings.push(solidModelWarningInvertedWorldCreate());
  }
  for (const brush of brushes) {
    if (
      brush.operation === SolidOperation.Subtractive &&
      !solidModelSubtractiveOverlapsAdditive(model, brush, brushes)
    ) {
      warnings.push(solidModelWarningSubtractiveWithoutOverlapCreate(brush));
    }
  }
  return warnings;
}

/**
 * Creates the warning of a model whose world starts solid.
 *
 * @returns Warning about the whole model.
 */
function solidModelWarningInvertedWorldCreate(): SolidModelWarning {
  return {
    kind: 'inverted_world',
    text: 'invertedWorld is ON: universe starts solid; subtractives dig voids. Leave off for normal additive maps.',
    brush: null,
  };
}

/**
 * Creates the warning of a subtractive brush that cuts nothing.
 *
 * @param brush Subtractive brush.
 * @returns Warning about the brush.
 */
function solidModelWarningSubtractiveWithoutOverlapCreate(brush: SolidBrushInstance): SolidModelWarning {
  return {
    kind: 'subtractive_without_overlap',
    text: `Subtractive "${brush.name}" (${brush.id}) does not overlap any additive brush AABB — cut will have no effect in normal (non-inverted) mode`,
    brush,
  };
}

/**
 * Returns whether a subtractive brush's world box overlaps the box of an
 * additive brush of the same model.
 *
 * @param model Solid model.
 * @param subtractiveBrush Subtractive brush.
 * @param brushes Every brush of the model.
 * @returns True when an additive overlap exists.
 */
function solidModelSubtractiveOverlapsAdditive(
  model: SolidModel,
  subtractiveBrush: SolidBrushInstance,
  brushes: readonly SolidBrushInstance[],
): boolean {
  const subtractiveBox = computeBrushWorldBounds(model, subtractiveBrush);
  if (subtractiveBox.isEmpty()) {
    return false;
  }
  return brushes.some((peer) => {
    if (peer.id === subtractiveBrush.id || peer.operation !== SolidOperation.Additive) {
      return false;
    }
    const peerBox = computeBrushWorldBounds(model, peer);
    return !peerBox.isEmpty() && peerBox.intersectsBox(subtractiveBox);
  });
}
