import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import { ShapeDrawBrushCommit, type ShapeDrawFrameView } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { HandlerShapeDrawRegenerate } from '@/tools/shape_draw/handler_shape_draw_regenerate.js';
import type { ShapeDrawShape } from '@/tools/shape_draw/shapes/shape_draw_shape.js';
import type { ShapeDrawShapeParameterValues } from '@/tools/shape_draw/shapes/shape_draw_shape_parameter.js';
import type { FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';

/** Frame view that keeps grid-local coordinates as world coordinates. */
const SHAPE_DRAW_SURFACE_TEST_WORLD_FRAME: ShapeDrawFrameView = {
  positionToWorld: (localPosition) => localPosition.clone(),
  orientationWorld: () => new THREE.Quaternion(),
};

/** One drawn shape group with the systems needed to regenerate it. */
export interface ShapeDrawSurfaceTestScene {
  /** Model holding the group. */
  model: SolidModel;
  /** Undo history. */
  commandStack: CommandStack;
  /** Shape group. */
  group: THREE.Group;
  /** Regeneration handler. */
  handler: HandlerShapeDrawRegenerate;
}

/** One brush face located in model space. */
export interface ShapeDrawSurfaceTestFace {
  /** Brush owning the face. */
  brush: SolidBrushInstance;
  /** Face index on the brush. */
  faceIndex: number;
  /** Face plane in model space. */
  modelPlane: SolidPlane;
}

/**
 * Draws a multi-piece shape into a fresh model and returns the group.
 *
 * @param shape Shape to draw.
 * @param parameters Parameter values of the draw.
 * @param bounds World bounds of the draw.
 * @returns Scene around the drawn group.
 */
export function shapeDrawSurfaceTestSceneCreate(
  shape: ShapeDrawShape,
  parameters: ShapeDrawShapeParameterValues,
  bounds: THREE.Box3,
): ShapeDrawSurfaceTestScene {
  const world = new THREE.Group();
  const model = new SolidModel('SurfaceCarryModel');
  world.add(model.root);
  const commandStack = new CommandStack(64);
  const first = shapeDrawSurfaceTestCommitCreate(world, model, commandStack).shapeCommit({
    shape,
    parameters,
    boundsLocal: bounds,
    gridFrame: SHAPE_DRAW_SURFACE_TEST_WORLD_FRAME,
    upAxis: 'y',
  });
  const group = first?.parent;
  if (!(group instanceof THREE.Group)) {
    throw new Error('Shape did not create a group');
  }
  const handler = new HandlerShapeDrawRegenerate({
    commandStack,
    getSelectedObjects: () => [],
    showStatusMessage: () => {},
  });
  return { model, commandStack, group, handler };
}

/**
 * Builds a committer drawing into one model.
 *
 * @param world World root.
 * @param model Model receiving the shape.
 * @param commandStack Undo history.
 * @returns Shape committer.
 */
function shapeDrawSurfaceTestCommitCreate(
  world: THREE.Group,
  model: SolidModel,
  commandStack: CommandStack,
): ShapeDrawBrushCommit {
  return new ShapeDrawBrushCommit({
    commandStack,
    worldObject: world,
    selectObject: () => true,
    selectObjects: () => true,
    activeModelResolve: () => model,
    brushInsertParentResolve: (target) => target.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
}

/**
 * Lists the brushes of the scene group in piece order.
 *
 * @param scene Test scene.
 * @returns Group brushes.
 */
export function shapeDrawSurfaceTestBrushes(scene: ShapeDrawSurfaceTestScene): SolidBrushInstance[] {
  return scene.handler.groupBrushesCollect(scene.group);
}

/**
 * Returns one brush of the scene group, failing the test when it is missing.
 *
 * @param scene Test scene.
 * @param pieceIndex Piece index; negative counts from the end.
 * @returns Group brush.
 */
export function shapeDrawSurfaceTestBrushAt(scene: ShapeDrawSurfaceTestScene, pieceIndex: number): SolidBrushInstance {
  const brushes = shapeDrawSurfaceTestBrushes(scene);
  const brush = brushes.at(pieceIndex);
  if (!brush) {
    throw new Error(`Missing shape piece ${pieceIndex} of ${brushes.length}`);
  }
  return brush;
}

/**
 * Finds the face of a brush whose model-space normal points most along a
 * direction.
 *
 * @param brush Brush to search.
 * @param direction Model-space direction.
 * @returns Located face.
 */
export function shapeDrawSurfaceTestFaceAlong(
  brush: SolidBrushInstance,
  direction: THREE.Vector3,
): ShapeDrawSurfaceTestFace {
  const planes = brush.getModelSpacePlanes();
  let faceIndex = 0;
  planes.forEach((plane, index) => {
    if (plane.normal.dot(direction) > (planes[faceIndex]?.normal.dot(direction) ?? -Infinity)) {
      faceIndex = index;
    }
  });
  return { brush, faceIndex, modelPlane: planes[faceIndex] as SolidPlane };
}

/**
 * Returns the model-space centroid of one brush face.
 *
 * @param face Located face.
 * @returns Centroid in model space.
 */
export function shapeDrawSurfaceTestFaceCentroid(face: ShapeDrawSurfaceTestFace): THREE.Vector3 {
  const brushFace = face.brush.brush.faces[face.faceIndex];
  if (!brushFace) {
    throw new Error('Face does not exist');
  }
  const vertices = face.brush.brush.getFaceVertices(brushFace);
  const centroid = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3());
  return centroid.multiplyScalar(1 / vertices.length).applyMatrix4(face.brush.getModelSpaceMatrix());
}

/**
 * Projects a model-space point through a face surface authored on a brush pose.
 *
 * @param surface Face surface with a brush-local UV matrix.
 * @param brushModelMatrix Brush-local to model-space matrix the surface belongs
 *   to.
 * @param modelPoint Model-space point.
 * @returns UV pair at that point.
 */
export function shapeDrawSurfaceTestUvAt(
  surface: FaceSurfaceDescription,
  brushModelMatrix: THREE.Matrix4,
  modelPoint: THREE.Vector3,
): { u: number; v: number } {
  const localPoint = modelPoint.clone().applyMatrix4(brushModelMatrix.clone().invert());
  return surface.uv.project(localPoint);
}
