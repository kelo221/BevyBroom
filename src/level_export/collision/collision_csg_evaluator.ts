import type { SolidCsgBranchNode, SolidCsgTree, SolidCsgTreeNode } from '@/solid/algorithm/compile/solid_csg_tree.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { CollisionConvexOps } from '@/level_export/collision/collision_convex_ops.js';

/** One convex piece of a CSG result and the brush it was cut from. */
export interface CollisionPiece {
  readonly brush: SolidBrush;
  /**
   * Index of the source brush in the evaluated list, or -1 for the inverted
   * world's bounds.
   */
  readonly sourceIndex: number;
}

/** What the evaluator combines. */
export interface CollisionCsgInput {
  /** Convex brushes in world space, by prepared index. */
  readonly brushes: readonly SolidBrush[];
  /** Operation tree over the brushes. */
  readonly tree: SolidCsgTree;
  /**
   * Solid filling the space when the world is inverted, or null for a normal
   * world.
   */
  readonly invertedWorldBounds: SolidBrush | null;
}

/**
 * Evaluates a solid model's operation tree on convex pieces instead of
 * surfaces, with the same rules as the editor's compile: brushes apply in
 * order, a subtractive brush carves what came before, a later additive brush
 * fills back in, an intersecting brush keeps only the common part, a group
 * combines its own children from empty first, and an inverted world starts
 * solid.
 */
export class CollisionCsgEvaluator {
  /**
   * Returns the convex pieces of the final result.
   *
   * @param input Brushes, operation tree and inverted world bounds.
   * @returns Pieces whose union is the result.
   */
  static evaluate(input: CollisionCsgInput): CollisionPiece[] {
    let current: CollisionPiece[] = input.invertedWorldBounds
      ? [{ brush: input.invertedWorldBounds, sourceIndex: -1 }]
      : [];
    for (const root of input.tree.roots) {
      current = CollisionCsgEvaluator.combine(current, CollisionCsgEvaluator.nodeEvaluate(input, root), root.operation);
    }
    return current;
  }

  /**
   * Returns the pieces of one tree node on its own.
   *
   * @param input Evaluation input.
   * @param node Brush or group node.
   * @returns Pieces of the node.
   */
  private static nodeEvaluate(input: CollisionCsgInput, node: SolidCsgTreeNode): CollisionPiece[] {
    if (node.kind === 'branch') {
      return CollisionCsgEvaluator.branchEvaluate(input, node);
    }
    const brush = input.brushes[node.preparedIndex];
    return brush ? [{ brush, sourceIndex: node.preparedIndex }] : [];
  }

  /**
   * Returns the pieces of a group: its children combined from empty, skipping
   * children before the first additive one.
   *
   * @param input Evaluation input.
   * @param node Group node.
   * @returns Pieces of the group.
   */
  private static branchEvaluate(input: CollisionCsgInput, node: SolidCsgBranchNode): CollisionPiece[] {
    let current: CollisionPiece[] = [];
    let isStarted = false;
    for (const child of node.children) {
      if (!isStarted && child.operation !== SolidOperation.Additive) {
        continue;
      }
      isStarted = true;
      current = CollisionCsgEvaluator.combine(
        current,
        CollisionCsgEvaluator.nodeEvaluate(input, child),
        child.operation,
      );
    }
    return current;
  }

  /**
   * Combines the pieces so far with a node's pieces.
   *
   * @param current Pieces so far.
   * @param incoming Pieces of the next node.
   * @param operation How the node applies.
   * @returns Combined pieces.
   */
  private static combine(
    current: CollisionPiece[],
    incoming: readonly CollisionPiece[],
    operation: SolidOperation,
  ): CollisionPiece[] {
    if (operation === SolidOperation.Additive) {
      return [...current, ...incoming];
    }
    if (operation === SolidOperation.Subtractive) {
      return incoming.reduce((pieces, cutter) => CollisionCsgEvaluator.subtractAll(pieces, cutter.brush), current);
    }
    return CollisionCsgEvaluator.intersectAll(current, incoming);
  }

  /**
   * Carves one convex cutter out of every piece.
   *
   * @param pieces Pieces so far.
   * @param cutter Convex cutter.
   * @returns Remaining pieces.
   */
  private static subtractAll(pieces: readonly CollisionPiece[], cutter: SolidBrush): CollisionPiece[] {
    return pieces.flatMap((piece) =>
      CollisionConvexOps.subtract(piece.brush, cutter).map((brush) => ({ brush, sourceIndex: piece.sourceIndex })),
    );
  }

  /**
   * Keeps the parts of the pieces that lie inside any incoming piece.
   *
   * @param pieces Pieces so far.
   * @param incoming Pieces of the intersecting node.
   * @returns Intersected pieces.
   */
  private static intersectAll(
    pieces: readonly CollisionPiece[],
    incoming: readonly CollisionPiece[],
  ): CollisionPiece[] {
    const result: CollisionPiece[] = [];
    for (const piece of pieces) {
      for (const other of incoming) {
        const common = CollisionConvexOps.intersect(piece.brush, other.brush);
        if (common !== null) {
          result.push({ brush: common, sourceIndex: piece.sourceIndex });
        }
      }
    }
    return result;
  }
}
