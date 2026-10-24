import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { findSolidModel } from './editor_api_lookup.js';
import type { ShapeDrawShapeParameterValues } from '@/tools/shape_draw/shapes/shape_draw_shape_parameter.js';
import { shapeDrawShapesList } from '@/tools/shape_draw/shapes/shape_draw_shape_registry.js';
import {
  ShapeDrawBrushCommit,
  type ShapeDrawBrushCommitDeps,
  type ShapeDrawFrameView,
} from '@/tools/shape_draw/shape_draw_brush_commit.js';

/** Arguments of the create_shape_brush tool. */
export interface CreateShapeBrushArgs {
  /** Shape identifier from the shape catalogue. */
  shapeId: string;
  /** World minimum corner of the bounds. */
  min: { x: number; y: number; z: number };
  /** World maximum corner of the bounds. */
  max: { x: number; y: number; z: number };
  /** Parameter values keyed by parameter id. */
  params?: Record<string, number | string>;
  /** Solid model uuid; defaults to the active model. */
  modelId?: string;
}

/** Frame view that treats world coordinates as the shape frame. */
export const EDITOR_API_SHAPE_WORLD_FRAME: ShapeDrawFrameView = {
  positionToWorld: (localPosition: THREE.Vector3): THREE.Vector3 => localPosition.clone(),
  orientationWorld: (): THREE.Quaternion => new THREE.Quaternion(),
};

/** Shape brush creation helpers for the AI EditorApi path. */
export class EditorApiShapeWrites {
  private readonly host: EditorApiHost;

  /**
   * Creates shape write helpers.
   *
   * @param host Injected editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Creates the brushes of a catalogue shape inside world bounds as one undo
   * step, grouping multi-piece shapes.
   *
   * @param args Shape id, world bounds and optional parameters.
   * @returns Tool result with created brush and group ids.
   */
  createShapeBrush(args: CreateShapeBrushArgs): McpToolResult {
    const shape = shapeDrawShapesList().find((entry) => entry.id === args.shapeId);
    if (!shape) {
      return { ok: false, message: `Unknown shape: ${args.shapeId}` };
    }
    const model = this.modelResolve(args.modelId);
    if (model === null && args.modelId) {
      return { ok: false, message: `Solid model not found: ${args.modelId}` };
    }
    const bounds = this.boundsResolve(args);
    const commit = new ShapeDrawBrushCommit(this.commitDepsCreate(model));
    const mesh = commit.shapeCommit({
      shape,
      parameters: this.parametersResolve(args),
      boundsLocal: bounds,
      gridFrame: EDITOR_API_SHAPE_WORLD_FRAME,
      upAxis: 'y',
    });
    return this.resultBuild(mesh, shape.id, bounds);
  }

  /**
   * Builds the world bounds from the min and max corners.
   *
   * @param args Tool arguments.
   * @returns World bounds.
   */
  private boundsResolve(args: CreateShapeBrushArgs): THREE.Box3 {
    const min = new THREE.Vector3(args.min?.x ?? 0, args.min?.y ?? 0, args.min?.z ?? 0);
    const max = new THREE.Vector3(args.max?.x ?? 0, args.max?.y ?? 0, args.max?.z ?? 0);
    return new THREE.Box3(min, max);
  }

  /**
   * Reads the parameter values of the tool call.
   *
   * @param args Tool arguments.
   * @returns Values keyed by parameter id.
   */
  private parametersResolve(args: CreateShapeBrushArgs): ShapeDrawShapeParameterValues {
    return args.params && typeof args.params === 'object' ? { ...args.params } : {};
  }

  /**
   * Resolves the solid model the shape joins.
   *
   * @param modelId Optional model uuid; falls back to the active model.
   * @returns Model, or null when an explicit id matches nothing.
   */
  private modelResolve(modelId?: string): SolidModel | null {
    if (modelId) {
      return findSolidModel(this.host.worldObject, modelId);
    }
    return this.host.solidModelController.resolveActiveModel();
  }

  /**
   * Builds the committer deps over the editor host.
   *
   * @param model Model the shape joins, or null to create a new one.
   * @returns Commit dependencies.
   */
  private commitDepsCreate(model: SolidModel | null): ShapeDrawBrushCommitDeps {
    return {
      commandStack: this.host.commandStack,
      worldObject: this.host.worldObject,
      selectObject: (mesh: THREE.Mesh) => this.host.selectionManager.selectObject(mesh),
      selectObjects: (meshes: THREE.Mesh[]) => this.host.selectionManager.setSelection(meshes),
      activeModelResolve: () => model,
      brushInsertParentResolve: (model: { root: THREE.Object3D }) => model.root,
      textureIdResolve: () => null,
      afterWorldMutation: () => {
        this.host.refreshAfterWorldMutation();
        this.host.refreshOutliner();
      },
    };
  }

  /**
   * Builds the tool result from the created mesh.
   *
   * @param mesh First created brush mesh, or null.
   * @param shapeId Shape identifier.
   * @param bounds World bounds drawn into.
   * @returns Tool result.
   */
  private resultBuild(mesh: THREE.Mesh | null, shapeId: string, bounds: THREE.Box3): McpToolResult {
    if (!mesh) {
      return { ok: false, message: 'Shape produced no brushes (bounds may be flat)' };
    }
    const model = SolidModel.fromObject(mesh);
    return {
      ok: true,
      message: `Created ${shapeId} shape`,
      data: { shapeId, brushMeshId: mesh.uuid, modelId: model?.root.uuid ?? null, bounds: this.boundsData(bounds) },
    };
  }

  /**
   * Lists the bounds corners for the result payload.
   *
   * @param bounds World bounds.
   * @returns Min and max components.
   */
  private boundsData(bounds: THREE.Box3): { min: number[]; max: number[] } {
    return {
      min: [bounds.min.x, bounds.min.y, bounds.min.z],
      max: [bounds.max.x, bounds.max.y, bounds.max.z],
    };
  }
}
