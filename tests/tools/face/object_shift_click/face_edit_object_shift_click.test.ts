import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FaceEditObjectShiftClick } from '@/tools/face/object_shift_click/face_edit_object_shift_click.js';
import { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { PolicyEditorOverlay } from '@/tools/overlay/policy_editor_overlay.js';
import { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { displacementActionsSharedRead } from '@/displacement/controller/displacement_actions_shared.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import { expandFaceSelectionIndices } from '@/selection/face/solid_result_face_indices.js';
import { FaceRegionWorldGeometry } from '@/selection/face/face_region_world_geometry.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { collectFaceSelectionSeedsFromFacePick } from '@/selection/face/face_selection_hierarchy_targets.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { pointerEventToNdc } from '@/utils/pointer_ndc.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceCenter,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../../../displacement/displacement_test_rig.js';
import {
  displacementPickTestViewCreate,
  type DisplacementPickTestView,
} from '../../../displacement/displacement_pick_test_view.js';
import { coordinatorFaceModeTestCreate } from '../coordinator_face_mode_test_rig.js';

/** World up direction the test views look down from. */
const SHIFT_CLICK_TEST_UP = new THREE.Vector3(0, 1, 0);

/** Distance of the test cameras from the point they look at. */
const SHIFT_CLICK_TEST_CAMERA_DISTANCE = 8;

/** Editor parts one Shift+click test drives and checks. */
interface ShiftClickTestScene {
  rig: DisplacementTestRig;
  brush: SolidBrushInstance;
  views: DisplacementPickTestView[];
  objectSelection: ManagerSelection;
  coordinator: CoordinatorFaceMode;
  chrome: ControllerViewportToolChrome;
  shiftClick: FaceEditObjectShiftClick;
}

/**
 * Builds a tools palette controller over the coordinator's face selection, the
 * way the layout does.
 *
 * @param coordinator Face mode coordinator.
 * @param objectSelection Object selection of the editor.
 * @returns Tools palette controller with the object tool active.
 */
function shiftClickTestChromeCreate(
  coordinator: CoordinatorFaceMode,
  objectSelection: ManagerSelection,
): ControllerViewportToolChrome {
  return new ControllerViewportToolChrome({
    faceExtrusionController: coordinator.getFaceExtrusionController(),
    clipPlaneTool: new ToolClipPlane(),
    clipPlaneHandler: { cancel: () => undefined } as unknown as HandlerClipPlane,
    selectionManager: objectSelection,
    editorOverlayPolicy: new PolicyEditorOverlay(),
    modalToolSessionRegistry: new RegistryModalToolSession(),
    showStatusMessage: () => undefined,
    onTransformMode: () => undefined,
    faceInspectorReveal: () => undefined,
    onExtrudeFaces: () => undefined,
    onStampCurrentTexture: () => undefined,
  });
}

/**
 * Returns the meshes under a client point of the first view, nearest first, by
 * raycasting the whole world.
 *
 * @param world Scene root.
 * @param views Views of the test; the first one is clicked.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @returns Unique meshes ordered near to far.
 */
function shiftClickTestObjectStackPick(
  world: THREE.Object3D,
  views: readonly DisplacementPickTestView[],
  clientX: number,
  clientY: number,
): THREE.Mesh[] {
  const view = views[0];
  if (!view) return [];
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointerEventToNdc({ clientX, clientY }, view.pickElement), view.camera);
  world.updateMatrixWorld(true);
  const meshes = raycaster.intersectObject(world, true).map((hit) => hit.object);
  return [...new Set(meshes.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh))];
}

/**
 * Builds the Shift+click face editing over the test scene parts.
 *
 * @param parts Scene parts without the Shift+click face editing.
 * @returns Shift+click face editing.
 */
function shiftClickTestShiftClickCreate(parts: Omit<ShiftClickTestScene, 'shiftClick'>): FaceEditObjectShiftClick {
  return new FaceEditObjectShiftClick({
    faceModeCoordinatorRead: () => parts.coordinator,
    pickObjectStackAtClientPoint: (clientX, clientY) =>
      shiftClickTestObjectStackPick(parts.rig.world, parts.views, clientX, clientY),
    viewportAtClientPointResolve: () => {
      const view = parts.views[0];
      return view ? { camera: view.camera, pickElement: view.pickElement } : null;
    },
    isShiftClickFaceEditAllowed: () => parts.chrome.getActiveTool() === EditorToolId.OBJECT,
    faceToolActivate: () => parts.chrome.selectTool(EditorToolId.FACE),
  });
}

/**
 * Creates a world with one box brush, a face mode coordinator, a tools palette
 * and the Shift+click face editing over them.
 *
 * @param name Solid model name.
 * @returns Test scene with the object tool active and no view yet.
 */
function shiftClickTestSceneCreate(name: string): ShiftClickTestScene {
  const rig = displacementTestRigCreate(name);
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 2, 3), new THREE.Vector3(1, 1, -2));
  const views: DisplacementPickTestView[] = [];
  const objectSelection = new ManagerSelection();
  const coordinator = coordinatorFaceModeTestCreate(rig, views, objectSelection);
  const chrome = shiftClickTestChromeCreate(coordinator, objectSelection);
  const parts = { rig, brush, views, objectSelection, coordinator, chrome };
  return { ...parts, shiftClick: shiftClickTestShiftClickCreate(parts) };
}

/**
 * Builds the target of the brush face pointing closest to a direction.
 *
 * @param scene Test scene.
 * @param direction Wanted outward direction.
 * @returns Brush face target.
 */
function shiftClickTestFaceTarget(scene: ShiftClickTestScene, direction: THREE.Vector3): SolidFaceTextureTarget {
  return displacementTestTarget(scene.rig, scene.brush, displacementTestFaceFacing(scene.brush, direction));
}

/**
 * Returns the world center of a flat brush face on the result mesh.
 *
 * @param scene Test scene.
 * @param target Brush face.
 * @returns World-space face center.
 */
function shiftClickTestFlatFaceCenter(scene: ShiftClickTestScene, target: SolidFaceTextureTarget): THREE.Vector3 {
  const resultMesh = scene.rig.model.getResultMesh();
  const triangleIndex = findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex);
  return FaceRegionWorldGeometry.centerWorld(resultMesh, expandFaceSelectionIndices(resultMesh, triangleIndex));
}

/**
 * Points the clicked view at a world point from along a direction.
 *
 * @param scene Test scene.
 * @param target World point the click lands on.
 * @param from Direction from the point to the camera.
 * @returns Client point of the click.
 */
function shiftClickTestViewAim(
  scene: ShiftClickTestScene,
  target: THREE.Vector3,
  from: THREE.Vector3,
): { clientX: number; clientY: number } {
  const view = displacementPickTestViewCreate(target, from, SHIFT_CLICK_TEST_CAMERA_DISTANCE);
  scene.views.splice(0, scene.views.length, view);
  return { clientX: view.event.clientX, clientY: view.event.clientY };
}

/**
 * Selects one brush face directly in the face selection.
 *
 * @param scene Test scene.
 * @param target Brush face.
 * @param addToSelection When false, the face selection is replaced.
 */
function shiftClickTestFaceSelect(
  scene: ShiftClickTestScene,
  target: SolidFaceTextureTarget,
  addToSelection: boolean,
): void {
  const resultMesh = scene.rig.model.getResultMesh();
  const triangleIndex = findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex);
  scene.coordinator.getFaceExtrusionController().selectFace(resultMesh, triangleIndex, addToSelection);
}

/**
 * Reads the selected brush faces as brush id and face index pairs.
 *
 * @returns Selected faces.
 */
function shiftClickTestSelectedFacesRead(): { brushId: string; surfaceIndex: number }[] {
  const targets = displacementActionsSharedRead()?.selectedTargetsRead() ?? [];
  return targets.map((target) => ({ brushId: target.brushId, surfaceIndex: target.surfaceIndex }));
}

/**
 * Builds the expected selected face entry of a target.
 *
 * @param target Brush face.
 * @returns Brush id and face index pair.
 */
function shiftClickTestFaceEntry(target: SolidFaceTextureTarget): { brushId: string; surfaceIndex: number } {
  return { brushId: target.brushId, surfaceIndex: target.surfaceIndex };
}

/**
 * Asserts the object tool is still active and face editing did not start.
 *
 * @param scene Test scene.
 */
function shiftClickTestObjectToolKeptExpect(scene: ShiftClickTestScene): void {
  expect(scene.chrome.getActiveTool()).toBe(EditorToolId.OBJECT);
  expect(scene.coordinator.getFaceExtrusionController().getSelectionMode()).toBe(SelectionMode.OBJECT);
  expect(getStateFaceEditSession().sheetOpenRead()).toBe(false);
}

/**
 * Proves that an object tool Shift+click on a brush face behaves like choosing
 * the Face tool on the tools palette and clicking that face: the Face tool is
 * active, the Face Edit Sheet is open and exactly the clicked face is selected,
 * while clicks on other objects or empty space are left to object selection.
 */
describe('FaceEditObjectShiftClick', () => {
  afterEach(() => {
    getStateFaceEditSession().reset();
  });

  it('activates the Face tool, opens the sheet and selects exactly the clicked face', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickSelect');
    const clicked = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    const point = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, clicked), SHIFT_CLICK_TEST_UP);
    const notified: FaceSelection[][] = [];
    scene.coordinator.getFaceExtrusionController().setFaceSelectionChangedCallback((faces) => notified.push(faces));
    expect(scene.shiftClick.clickApply(point.clientX, point.clientY)).toBe(true);
    expect(scene.chrome.getActiveTool()).toBe(EditorToolId.FACE);
    expect(scene.coordinator.getFaceExtrusionController().getSelectionMode()).toBe(SelectionMode.FACE);
    expect(getStateFaceEditSession().sheetOpenRead()).toBe(true);
    expect(shiftClickTestSelectedFacesRead()).toEqual([shiftClickTestFaceEntry(clicked)]);
    expect(notified.at(-1)?.length).toBe(scene.coordinator.getFaceExtrusionController().getSelectedFaceCount());
    scene.coordinator.dispose();
  });

  it('replaces a previous face selection with the clicked face', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickReplace');
    const side = new THREE.Vector3(1, 0, 0);
    const previousFaces = [
      shiftClickTestFaceTarget(scene, side),
      shiftClickTestFaceTarget(scene, side.clone().negate()),
    ];
    previousFaces.forEach((target) => shiftClickTestFaceSelect(scene, target, true));
    expect(shiftClickTestSelectedFacesRead()).toHaveLength(previousFaces.length);
    const clicked = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    const point = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, clicked), SHIFT_CLICK_TEST_UP);
    expect(scene.shiftClick.clickApply(point.clientX, point.clientY)).toBe(true);
    expect(shiftClickTestSelectedFacesRead()).toEqual([shiftClickTestFaceEntry(clicked)]);
    scene.coordinator.dispose();
  });

  it('selects the displaced face whose surface was clicked', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickDisplaced');
    const displaced = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    displacementTestCreate(scene.rig, displaced, 2);
    const point = shiftClickTestViewAim(scene, displacementTestFaceCenter(displaced), SHIFT_CLICK_TEST_UP);
    expect(scene.shiftClick.clickApply(point.clientX, point.clientY)).toBe(true);
    expect(scene.chrome.getActiveTool()).toBe(EditorToolId.FACE);
    expect(shiftClickTestSelectedFacesRead()).toEqual([shiftClickTestFaceEntry(displaced)]);
    scene.coordinator.dispose();
  });

  it('leaves a click whose nearest object is no brush to object selection', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickOtherObject');
    const clicked = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    const faceCenter = shiftClickTestFlatFaceCenter(scene, clicked);
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    blocker.position.copy(faceCenter).addScaledVector(SHIFT_CLICK_TEST_UP, SHIFT_CLICK_TEST_CAMERA_DISTANCE / 2);
    scene.rig.world.add(blocker);
    const point = shiftClickTestViewAim(scene, faceCenter, SHIFT_CLICK_TEST_UP);
    expect(shiftClickTestObjectStackPick(scene.rig.world, scene.views, point.clientX, point.clientY)[0]).toBe(blocker);
    expect(scene.shiftClick.clickApply(point.clientX, point.clientY)).toBe(false);
    shiftClickTestObjectToolKeptExpect(scene);
    scene.coordinator.dispose();
  });

  it('leaves a click on empty space to object selection', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickEmpty');
    const bounds = new THREE.Box3().setFromObject(scene.rig.model.getResultMesh());
    const emptyPoint = bounds.max.clone().add(bounds.getSize(new THREE.Vector3()));
    const point = shiftClickTestViewAim(scene, emptyPoint, SHIFT_CLICK_TEST_UP);
    expect(scene.shiftClick.clickApply(point.clientX, point.clientY)).toBe(false);
    shiftClickTestObjectToolKeptExpect(scene);
    scene.coordinator.dispose();
  });

  it('does nothing while another tool than the object tool is active', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickOtherTool');
    scene.chrome.selectTool(EditorToolId.BLOCK);
    const clicked = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    const point = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, clicked), SHIFT_CLICK_TEST_UP);
    expect(scene.shiftClick.clickApply(point.clientX, point.clientY)).toBe(false);
    expect(scene.chrome.getActiveTool()).toBe(EditorToolId.BLOCK);
    expect(shiftClickTestSelectedFacesRead()).toEqual([]);
    scene.coordinator.dispose();
  });

  it('adds faces with Ctrl+click once the Face tool is active', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickFaceModeAdd');
    const first = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    const firstPoint = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, first), SHIFT_CLICK_TEST_UP);
    expect(scene.shiftClick.clickApply(firstPoint.clientX, firstPoint.clientY)).toBe(true);
    const sideDirection = new THREE.Vector3(1, 0, 0);
    const second = shiftClickTestFaceTarget(scene, sideDirection);
    const secondPoint = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, second), sideDirection);
    expect(scene.coordinator.beginFaceSelectPointerDown(secondPoint.clientX, secondPoint.clientY, false, true)).toBe(
      true,
    );
    scene.coordinator.endFaceSelectPointerUp();
    expect(shiftClickTestSelectedFacesRead()).toEqual(
      expect.arrayContaining([shiftClickTestFaceEntry(first), shiftClickTestFaceEntry(second)]),
    );
    expect(shiftClickTestSelectedFacesRead()).toHaveLength(2);
    scene.coordinator.dispose();
  });

  it('selects the whole brush with Shift+click once the Face tool is active', () => {
    const scene = shiftClickTestSceneCreate('ShiftClickFaceModeBrush');
    const first = shiftClickTestFaceTarget(scene, SHIFT_CLICK_TEST_UP);
    const firstPoint = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, first), SHIFT_CLICK_TEST_UP);
    expect(scene.shiftClick.clickApply(firstPoint.clientX, firstPoint.clientY)).toBe(true);
    const sideDirection = new THREE.Vector3(1, 0, 0);
    const second = shiftClickTestFaceTarget(scene, sideDirection);
    const secondPoint = shiftClickTestViewAim(scene, shiftClickTestFlatFaceCenter(scene, second), sideDirection);
    expect(scene.coordinator.beginFaceSelectPointerDown(secondPoint.clientX, secondPoint.clientY, true, false)).toBe(
      true,
    );
    scene.coordinator.endFaceSelectPointerUp();
    const brushSurfaceCount = collectFaceSelectionSeedsFromFacePick(scene.rig.model.getResultMesh(), 0).length;
    expect(brushSurfaceCount).toBeGreaterThan(2);
    expect(shiftClickTestSelectedFacesRead()).toEqual(
      expect.arrayContaining([shiftClickTestFaceEntry(first), shiftClickTestFaceEntry(second)]),
    );
    expect(shiftClickTestSelectedFacesRead()).toHaveLength(brushSurfaceCount);
    scene.coordinator.dispose();
  });
});
