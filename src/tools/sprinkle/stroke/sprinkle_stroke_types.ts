import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type { SprinkleGridLayout } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import type { SprinkleSurfaceProjector } from '@/tools/sprinkle/surface/sprinkle_surface_projector.js';
import type { SprinklePlacementMode } from '@/tools/sprinkle/sprinkle_types.js';

/** How many entities a stroke or dab added and removed. */
export interface SprinkleStrokeResult {
  /** Entities placed. */
  readonly added: number;
  /** Sprinkled entities removed. */
  readonly removed: number;
}

/** Everything one stroke paints with; fixed for the whole stroke. */
export interface SprinkleStrokeSettings {
  /** Definition whose cases are placed. */
  readonly definition: SprinkleDefinition;
  /** Placement mode of the stroke. */
  readonly mode: SprinklePlacementMode;
  /** Brush radius in meters. */
  readonly radius: number;
  /** Chance in percent that a visited cell receives an entity. */
  readonly densityPercent: number;
  /** Grid the cells are laid out on. */
  readonly grid: SprinkleGridLayout;
  /** Whether placed entities get a random yaw. */
  readonly randomYaw: boolean;
  /** Whether placed entities tilt +Y onto the surface normal. */
  readonly alignToNormal: boolean;
  /** Seed of the stroke's random stream. */
  readonly seed: number;
}

/** Services a stroke works with. */
export interface SprinkleStrokeDeps {
  /** Undo stack receiving one step per stroke that changed the scene. */
  readonly commandStack: CommandStack;
  /**
   * World root new entities are added under and sprinkled entities are found
   * in.
   */
  readonly worldObject: THREE.Object3D;
  /** Projects grid cells onto the surfaces entities land on. */
  readonly projector: SprinkleSurfaceProjector;
  /**
   * Shows a status message, such as an unknown entity class.
   *
   * @param message Message text.
   */
  readonly statusShow: (message: string) => void;
  /** Refreshes the editor after a dab changed the scene. */
  readonly afterWorldMutation: () => void;
}

/**
 * Creates an empty stroke result.
 *
 * @returns Result with nothing added or removed.
 */
export function sprinkleStrokeResultEmpty(): SprinkleStrokeResult {
  return { added: 0, removed: 0 };
}

/**
 * Returns the changes made between two counts of the same stroke.
 *
 * @param later Counts taken later.
 * @param earlier Counts taken earlier.
 * @returns Entities added and removed in between.
 */
export function sprinkleStrokeResultSince(
  later: SprinkleStrokeResult,
  earlier: SprinkleStrokeResult,
): SprinkleStrokeResult {
  return { added: later.added - earlier.added, removed: later.removed - earlier.removed };
}

/**
 * Returns whether a result holds any change.
 *
 * @param result Stroke or dab result.
 * @returns True when something was added or removed.
 */
export function sprinkleStrokeResultChangedIs(result: SprinkleStrokeResult): boolean {
  return result.added > 0 || result.removed > 0;
}
