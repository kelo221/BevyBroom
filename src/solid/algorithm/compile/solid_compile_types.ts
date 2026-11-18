import * as THREE from 'three';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import type { SolidCsgTree } from './solid_csg_tree.js';

/** Options controlling full versus partial solid CSG compilation. */
export interface SolidCompileOptions {
  /**
   * Brush ids known to have changed. When set (and forceFull is false), only
   * those brushes and their spatial neighbors are recompiled.
   */
  dirtyBrushIds?: Iterable<string>;
  /** When true, discards reuse and recompiles every brush. */
  forceFull?: boolean;
  /**
   * When true, skips concatenating all cached polygons into one array. Solid
   * model meshing reads per-brush caches directly.
   */
  skipPolygonAssembly?: boolean;
  /**
   * When true, CSG starts as solid (inside) so subtractive brushes carve rooms
   * from an inverted world.
   */
  invertedWorld?: boolean;
  /**
   * Optional solid model root for hierarchical group CSG. When set, the
   * compiler builds a branch/leaf tree from the scene graph so compound groups
   * can apply a single operation to multiple child brushes.
   */
  solidRoot?: import('three').Object3D;
}

/** Diagnostics from the most recent compile pass (for tests and profiling). */
export interface SolidCompileStats {
  /** True when every brush was recompiled. */
  fullRebuild: boolean;
  /** Number of brushes whose surfaces were regenerated. */
  recompiledBrushCount: number;
  /** Number of brushes that reused cached polygons. */
  reusedBrushCount: number;
  /** Visible brush count in the compile. */
  preparedBrushCount: number;
}

/** World-space brush snapshot used during compilation. */
export interface PreparedBrush {
  /** Source brush instance. */
  instance: SolidBrushInstance;
  /** Model-space brush geometry. */
  brush: SolidBrush;
  /** Axis-aligned bounds of the model-space brush. */
  bounds: THREE.Box3;
  /** Indices of other prepared brushes whose bounds overlap this one. */
  overlappingPeerIndices: number[];
  /** CSG operation for this brush. */
  operation: SolidOperation;
}

/** The brushes and the operation tree a compile combined, in solid model space. */
export interface SolidCsgInputs {
  /** Prepared brushes in evaluation order. */
  readonly prepared: readonly PreparedBrush[];
  /** Operation tree over the prepared brushes, or null when nothing compiled. */
  readonly tree: SolidCsgTree | null;
  /** True when the compile treated space outside every brush as solid. */
  readonly invertedWorld: boolean;
}
