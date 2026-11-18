import * as THREE from 'three';
import { displacementBrushDisplacedIs } from '@/displacement/brush/displacement_brush_displaced.js';
import {
  displacementSurfaceMeshIdentityRead,
  displacementSurfaceMeshesUnder,
} from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { isSolidBrushMarkedNonConvex } from '@/edit/transform/brush_edit_convexity.js';
import { CollisionCsgEvaluator, type CollisionPiece } from '@/level_export/collision/collision_csg_evaluator.js';
import { CollisionMeshTriangles } from '@/level_export/collision/collision_mesh_triangles.js';
import { CollisionNumberFormat } from '@/level_export/collision/collision_number_format.js';
import {
  type CollisionTextureSource,
  CollisionPlaneTextureResolver,
} from '@/level_export/collision/collision_plane_texture_resolver.js';
import type {
  CollisionModelFlagged,
  CollisionModelPiece,
  CollisionModelResult,
} from '@/level_export/collision/collision_model_result.js';
import type { PreparedBrush, SolidCsgInputs } from '@/solid/algorithm/compile/solid_compile_types.js';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { solidModelCsgInputsRead } from '@/solid/model/solid_model_csg_inputs.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/** How far the solid of an inverted world reaches past every brush, in meters. */
export const COLLISION_INVERTED_WORLD_MARGIN = 1;

/**
 * Collects the collision of one solid model from its last compile: the convex
 * pieces of its result in world space, with the texture of every plane, and the
 * displaced surfaces and non-convex brushes it cannot give as pieces.
 */
export class CollisionSolidModelCollector {
  /**
   * Collects the collision of a solid model.
   *
   * @param solidRoot Solid model root with a current world matrix.
   * @returns Pieces and flagged parts in a stable order.
   */
  static collect(solidRoot: THREE.Object3D): CollisionModelResult {
    const inputs = solidModelCsgInputsRead(solidRoot);
    const pieces = inputs ? CollisionSolidModelCollector.piecesCollect(solidRoot, inputs) : [];
    return { pieces, flagged: CollisionSolidModelCollector.flaggedCollect(solidRoot) };
  }

  /**
   * Evaluates the convex pieces of a compile and describes them.
   *
   * @param solidRoot Solid model root.
   * @param inputs Prepared brushes and tree of the last compile.
   * @returns Piece records.
   */
  private static piecesCollect(solidRoot: THREE.Object3D, inputs: SolidCsgInputs): CollisionModelPiece[] {
    if (inputs.tree === null) {
      return [];
    }
    const brushes = inputs.prepared.map((entry) => CollisionSolidModelCollector.worldBrushOf(entry, solidRoot));
    const invertedWorldBounds = inputs.invertedWorld ? CollisionSolidModelCollector.boundsBrushOf(brushes) : null;
    const resolver = new CollisionPlaneTextureResolver(
      inputs.prepared.map((entry, index) => CollisionSolidModelCollector.textureSourceOf(entry, brushes[index])),
    );
    return CollisionCsgEvaluator.evaluate({ brushes, tree: inputs.tree, invertedWorldBounds })
      .filter((piece) => !CollisionSolidModelCollector.fromDisplacedBrushIs(piece, inputs.prepared))
      .map((piece) => CollisionSolidModelCollector.pieceDescribe(piece, inputs.prepared, resolver));
  }

  /**
   * Returns a prepared brush moved from solid model space into world space.
   *
   * @param entry Prepared brush.
   * @param solidRoot Solid model root.
   * @returns World-space copy.
   */
  private static worldBrushOf(entry: PreparedBrush, solidRoot: THREE.Object3D): SolidBrush {
    const brush = entry.brush.clone();
    brush.transformVertices(solidRoot.matrixWorld);
    return brush;
  }

  /**
   * Returns the box filling an inverted world: every brush with a margin.
   *
   * @param brushes World-space brushes.
   * @returns Bounds box brush.
   */
  private static boundsBrushOf(brushes: readonly SolidBrush[]): SolidBrush {
    const bounds = new THREE.Box3();
    brushes.forEach((brush) => bounds.union(brush.computeLocalBounds()));
    bounds.expandByScalar(COLLISION_INVERTED_WORLD_MARGIN);
    return SolidBrushFactory.createBox(bounds.min, bounds.max);
  }

  /**
   * Returns a prepared brush as a texture source.
   *
   * @param entry Prepared brush.
   * @param worldBrush Its world-space copy.
   * @returns Texture source.
   */
  private static textureSourceOf(entry: PreparedBrush, worldBrush: SolidBrush | undefined): CollisionTextureSource {
    const brush = worldBrush ?? entry.brush;
    return {
      brush,
      operation: entry.operation,
      textureOfFace: (faceIndex) =>
        entry.instance.getFaceSurface(brush.faces[faceIndex]?.surfaceIndex ?? faceIndex).textureId,
    };
  }

  /**
   * Returns whether a piece was cut from a brush whose surface a displacement
   * replaces.
   *
   * @param piece Convex piece.
   * @param prepared Prepared brushes.
   * @returns True for pieces of displaced brushes.
   */
  private static fromDisplacedBrushIs(piece: CollisionPiece, prepared: readonly PreparedBrush[]): boolean {
    const entry = prepared[piece.sourceIndex];
    return entry !== undefined && displacementBrushDisplacedIs(entry.instance);
  }

  /**
   * Describes one piece with its planes, textures and vertices.
   *
   * @param piece Convex piece.
   * @param prepared Prepared brushes.
   * @param resolver Plane texture resolver.
   * @returns Piece record.
   */
  private static pieceDescribe(
    piece: CollisionPiece,
    prepared: readonly PreparedBrush[],
    resolver: CollisionPlaneTextureResolver,
  ): CollisionModelPiece {
    piece.brush.recalculatePlanes();
    const instance = prepared[piece.sourceIndex]?.instance;
    return {
      brush_id: instance?.id ?? '',
      brush_name: instance?.name ?? '',
      planes: piece.brush.planes.map((plane) => ({
        normal: CollisionNumberFormat.vector3(plane.normal),
        distance: CollisionNumberFormat.round(-plane.offset),
        texture: resolver.textureOf(plane, piece.sourceIndex),
      })),
      vertices: piece.brush.vertices.map((vertex) => CollisionNumberFormat.vector3(vertex)),
    };
  }

  /**
   * Lists the displaced surfaces and non-convex brushes of a solid model.
   *
   * @param solidRoot Solid model root.
   * @returns Flagged parts.
   */
  private static flaggedCollect(solidRoot: THREE.Object3D): CollisionModelFlagged[] {
    const brushes = SolidModel.fromObject(solidRoot)?.getBrushes() ?? [];
    const nameOf = (brushId: string): string => brushes.find((brush) => brush.id === brushId)?.name ?? '';
    const displaced = displacementSurfaceMeshesUnder(solidRoot).map((mesh): CollisionModelFlagged => {
      const brushId = displacementSurfaceMeshIdentityRead(mesh)?.brushId ?? '';
      return {
        brush_id: brushId,
        brush_name: nameOf(brushId),
        reason: 'displacement',
        ...CollisionMeshTriangles.ofMesh(mesh),
      };
    });
    const nonConvex = brushes
      .filter((brush) => brush.mesh !== null && isSolidBrushMarkedNonConvex(brush.mesh))
      .map((brush): CollisionModelFlagged => {
        const world = brush.getModelSpaceBrush();
        world.transformVertices(solidRoot.matrixWorld);
        return {
          brush_id: brush.id,
          brush_name: brush.name,
          reason: 'non_convex_brush',
          ...CollisionMeshTriangles.ofBrush(world),
        };
      });
    return [...displaced, ...nonConvex];
  }
}
