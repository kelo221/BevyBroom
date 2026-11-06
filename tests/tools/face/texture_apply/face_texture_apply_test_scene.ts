import * as THREE from 'three';
import { vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { buildTargetsFromFaceSelection } from '@/texture/uv/face_texture_applier.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { createDefaultFaceTextureMapping, type FaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { computeRegionWorldNormal } from '@/texture/uv/planar_uv_projector.js';
import { CommandTextureFaceApply } from '@/texture/commands/command_texture_face_apply.js';
import { FaceUvOperation } from '@/texture/uv/operations/face_uv_operation.js';
import { createWorldPolygonTargetContextFactory } from '@/texture/uv/operations/face_uv_operation_context_factory.js';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { FaceRegionWorldGeometry } from '@/selection/face/face_region_world_geometry.js';
import {
  FaceTextureApplyCoordinator,
  type FaceTextureApplyViewport,
} from '@/tools/face/texture_apply/face_texture_apply_coordinator.js';

/** Pixel size of the square test viewport. */
const FACE_TEXTURE_APPLY_TEST_VIEWPORT_PX = 400;

/** Texture every box face starts with. */
export const FACE_TEXTURE_APPLY_TEST_START_TEXTURE = 'walls/start_texture.png';

/** Scene, controllers and spies one texture application test drives. */
export interface FaceTextureApplyTestScene {
  readonly world: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly commandStack: CommandStack;
  readonly faceController: ControllerFaceExtrusion;
  readonly viewport: FaceTextureApplyViewport;
  readonly camera: THREE.PerspectiveCamera;
  readonly coordinator: FaceTextureApplyCoordinator;
  readonly statusMessages: string[];
  readonly altDown: { value: boolean };
}

/**
 * Builds a textured content box in face mode, a camera that sees its top, front
 * and right faces, and the texture application over them.
 *
 * @returns Test scene.
 */
export function faceTextureApplyTestSceneCreate(): FaceTextureApplyTestScene {
  const world = new THREE.Group();
  const scene = new THREE.Scene();
  scene.add(world);
  const commandStack = new CommandStack(64);
  const faceController = new ControllerFaceExtrusion(scene, commandStack, new GridSnap(false, 1), world);
  const mesh = faceTextureApplyTestSolidCreate(world, commandStack, faceController);
  faceController.setAvailableMeshes([mesh]);
  faceController.setSelectionMode(SelectionMode.FACE);
  const camera = faceTextureApplyTestCameraCreate();
  const statusMessages: string[] = [];
  const altDown = { value: false };
  const coordinator = faceTextureApplyTestCoordinatorCreate(commandStack, faceController, statusMessages, altDown);
  const viewport = { camera, pickElement: faceTextureApplyTestPickElementCreate() };
  return { world, mesh, commandStack, faceController, viewport, camera, coordinator, statusMessages, altDown };
}

/**
 * Creates the texture application with spy refresh hooks.
 *
 * @param commandStack Undo stack.
 * @param faceController Face selection controller.
 * @param statusMessages Collects status messages.
 * @param altDown Alt key state the coordinator reads.
 * @returns Texture application.
 */
function faceTextureApplyTestCoordinatorCreate(
  commandStack: CommandStack,
  faceController: ControllerFaceExtrusion,
  statusMessages: string[],
  altDown: { value: boolean },
): FaceTextureApplyCoordinator {
  return new FaceTextureApplyCoordinator({
    commandStack,
    selectionManager: new ManagerSelection(),
    faceExtrusionController: faceController,
    isAltDown: () => altDown.value,
    updateShadingMeshes: vi.fn(),
    syncPrimitivesToViewports: vi.fn(),
    showStatusMessage: (message) => statusMessages.push(message),
  });
}

/**
 * Creates a solid with one 2 m box brush in the world and paints every result
 * face with the start texture.
 *
 * @param world World group receiving the solid.
 * @param commandStack Undo stack the start texture is painted through.
 * @param faceController Face controller the painting resolves faces with.
 * @returns Result mesh of the solid.
 */
function faceTextureApplyTestSolidCreate(
  world: THREE.Group,
  commandStack: CommandStack,
  faceController: ControllerFaceExtrusion,
): THREE.Mesh {
  const model = new SolidModel('TextureApplySolid');
  world.add(model.root);
  model.addBoxBrush(2, SolidOperation.Additive);
  model.rebuild(true);
  const mesh = model.getResultMesh();
  mesh.updateMatrixWorld(true);
  const assignment = new ControllerTextureAssignment(new ManagerSelection(), faceController, commandStack);
  const allFaces = Array.from({ length: faceTextureApplyTestTriangleCount(mesh) }, (_, faceIndex) => ({
    mesh,
    faceIndex,
  }));
  assignment.faceTextureAssignmentBuild(allFaces, FACE_TEXTURE_APPLY_TEST_START_TEXTURE)?.command.execute();
  return mesh;
}

/**
 * Counts the triangles of a mesh.
 *
 * @param mesh Mesh to count.
 * @returns Triangle count.
 */
function faceTextureApplyTestTriangleCount(mesh: THREE.Mesh): number {
  const index = mesh.geometry.getIndex();
  return Math.floor((index ? index.count : mesh.geometry.getAttribute('position').count) / 3);
}

/**
 * Creates a camera above the front right corner looking at the box center.
 *
 * @returns Camera.
 */
function faceTextureApplyTestCameraCreate(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(4, 5, 6);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Creates a mounted square pick element whose rectangle starts at the client
 * origin.
 *
 * @returns Pick element.
 */
function faceTextureApplyTestPickElementCreate(): HTMLElement {
  const size = FACE_TEXTURE_APPLY_TEST_VIEWPORT_PX;
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', { value: size });
  Object.defineProperty(element, 'clientHeight', { value: size });
  element.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: size,
      height: size,
      right: size,
      bottom: size,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

/**
 * Finds a triangle of the box face whose world normal points along a direction.
 *
 * @param mesh Box mesh.
 * @param direction World direction of the face normal.
 * @returns Seed triangle index.
 */
export function faceTextureApplyTestFaceSeed(mesh: THREE.Mesh, direction: THREE.Vector3): number {
  const triangleCount = faceTextureApplyTestTriangleCount(mesh);
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const normal = computeRegionWorldNormal(mesh, [triangleIndex]);
    if (normal.dot(direction.clone().normalize()) > 0.999) {
      return triangleIndex;
    }
  }
  throw new Error('no face points along the direction');
}

/**
 * Projects the world center of a face region to client coordinates.
 *
 * @param scene Test scene.
 * @param seedTriangle Seed triangle of the face.
 * @returns Client point over the face center.
 */
export function faceTextureApplyTestClientPoint(
  scene: FaceTextureApplyTestScene,
  seedTriangle: number,
): { clientX: number; clientY: number } {
  const center = FaceRegionWorldGeometry.centerWorld(scene.mesh, faceTextureApplyTestRegion(scene.mesh, seedTriangle));
  const ndc = center.project(scene.camera);
  const size = FACE_TEXTURE_APPLY_TEST_VIEWPORT_PX;
  return { clientX: ((ndc.x + 1) / 2) * size, clientY: ((1 - ndc.y) / 2) * size };
}

/**
 * Builds a mouse event at a client point.
 *
 * @param point Client point.
 * @returns Mouse event.
 */
export function faceTextureApplyTestMouseEvent(point: { clientX: number; clientY: number }): MouseEvent {
  return new MouseEvent('pointerdown', { clientX: point.clientX, clientY: point.clientY, button: 0 });
}

/**
 * Returns the triangles of the coplanar region of a seed triangle.
 *
 * @param mesh Box mesh.
 * @param seedTriangle Seed triangle.
 * @returns Region triangles.
 */
export function faceTextureApplyTestRegion(mesh: THREE.Mesh, seedTriangle: number): number[] {
  const target = buildTargetsFromFaceSelection([{ mesh, faceIndex: seedTriangle }])[0];
  if (!target) {
    throw new Error('region missing');
  }
  return target.triangleIndices;
}

/**
 * Reads the stored mapping of the region of a seed triangle.
 *
 * @param mesh Box mesh.
 * @param seedTriangle Seed triangle.
 * @returns Stored mapping.
 */
export function faceTextureApplyTestMappingRead(mesh: THREE.Mesh, seedTriangle: number): FaceTextureMapping {
  const entry = getFaceTextureMaps(mesh).find((candidate) => candidate.triangleIndices.includes(seedTriangle));
  if (!entry) {
    throw new Error('mapping missing');
  }
  return entry.mapping;
}

/** Face UV operation that replaces any matrix with a fixed one. */
class FaceUvOperationTestFixedMatrix extends FaceUvOperation {
  private readonly fixedMatrix: SurfaceUvMatrix;

  /**
   * Creates the operation.
   *
   * @param fixedMatrix Matrix every face receives.
   */
  constructor(fixedMatrix: SurfaceUvMatrix) {
    super();
    this.fixedMatrix = fixedMatrix;
  }

  /**
   * Returns the fixed matrix.
   *
   * @returns Fixed matrix.
   */
  apply(): SurfaceUvMatrix {
    return this.fixedMatrix.clone();
  }
}

/**
 * Paints a texture and UV matrix onto one face through the editor's undoable
 * face commands, outside the undo history.
 *
 * @param scene Test scene.
 * @param direction World direction of the face normal.
 * @param textureId Texture to write.
 * @param uv UV matrix to write.
 */
export function faceTextureApplyTestFacePaint(
  scene: FaceTextureApplyTestScene,
  direction: THREE.Vector3,
  textureId: string,
  uv: SurfaceUvMatrix,
): void {
  const face = { mesh: scene.mesh, faceIndex: faceTextureApplyTestFaceSeed(scene.mesh, direction) };
  new CommandTextureFaceApply(buildTargetsFromFaceSelection([face]), createDefaultFaceTextureMapping(), {
    matrixOperation: new FaceUvOperationTestFixedMatrix(uv),
    matrixOperationContextFactory: createWorldPolygonTargetContextFactory(null),
  }).execute();
  const assignment = new ControllerTextureAssignment(new ManagerSelection(), scene.faceController, scene.commandStack);
  assignment.faceTextureAssignmentBuild([face], textureId)?.command.execute();
}

/**
 * Collects the world corners two face regions share.
 *
 * @param mesh Box mesh.
 * @param firstSeed Seed triangle of the first face.
 * @param secondSeed Seed triangle of the second face.
 * @returns Shared corners.
 */
export function faceTextureApplyTestSharedCorners(
  mesh: THREE.Mesh,
  firstSeed: number,
  secondSeed: number,
): THREE.Vector3[] {
  const first = FaceRegionWorldGeometry.cornersWorld(mesh, faceTextureApplyTestRegion(mesh, firstSeed));
  const second = FaceRegionWorldGeometry.cornersWorld(mesh, faceTextureApplyTestRegion(mesh, secondSeed));
  const shared = first.filter((corner) => second.some((other) => other.distanceTo(corner) < 1e-6));
  return shared.filter((corner, index) => shared.findIndex((other) => other.distanceTo(corner) < 1e-6) === index);
}

/**
 * Removes the test pick element from the document.
 *
 * @param scene Test scene.
 */
export function faceTextureApplyTestSceneDispose(scene: FaceTextureApplyTestScene): void {
  scene.coordinator.dispose();
  scene.viewport.pickElement.remove();
}
