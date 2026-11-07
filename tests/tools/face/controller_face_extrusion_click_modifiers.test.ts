import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collectFaceSelectionSeedsFromFacePick } from '@/selection/face/face_selection_hierarchy_targets.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import type { FacePickResult } from '@/selection/face/raycaster_face_selection.js';
import { POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX } from '@/input/pointer_double_click_detector.js';

/**
 * Client-pixel spacing that keeps two consecutive presses from being a
 * double-click.
 */
const PRESS_SPACING_PX = (POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX + 1) * 4;

/** Modifier flags of one press. */
interface PressModifiers {
  shift: boolean;
  ctrl: boolean;
}

/** Plain press without modifiers. */
const PLAIN: PressModifiers = { shift: false, ctrl: false };

/** Ctrl press. */
const CTRL: PressModifiers = { shift: false, ctrl: true };

/** Shift press. */
const SHIFT: PressModifiers = { shift: true, ctrl: false };

/** Ctrl+Shift press. */
const CTRL_SHIFT: PressModifiers = { shift: true, ctrl: true };

/**
 * Builds a compiled single-brush solid and returns its result mesh.
 *
 * @param name Solid model name.
 * @returns Result mesh carrying the brush's triangle sources.
 */
function brushResultMeshCreate(name: string): THREE.Mesh {
  const model = new SolidModel(name);
  model.addBoxBrush(2, SolidOperation.Additive);
  model.rebuild(true);
  return model.getResultMesh();
}

/**
 * Builds a face pick on one triangle of a mesh.
 *
 * @param mesh Picked mesh.
 * @param faceIndex Picked triangle index.
 * @returns Face pick result.
 */
function facePickCreate(mesh: THREE.Mesh, faceIndex: number): FacePickResult {
  return { mesh, faceIndex, hitPoint: new THREE.Vector3(), faceNormal: new THREE.Vector3(0, 1, 0) };
}

/** Controller with picks scripted per press or move instead of raycast. */
class FaceClickRig {
  readonly controller: ControllerFaceExtrusion;
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly pickElement = document.createElement('div');
  private scriptedPick: FacePickResult | null = null;
  private pressCount = 0;

  /**
   * Creates a controller in face mode whose raycaster returns the scripted
   * pick.
   */
  constructor() {
    this.controller = new ControllerFaceExtrusion(
      new THREE.Scene(),
      new CommandStack(16),
      new GridSnap(false, 1),
      new THREE.Group(),
    );
    this.controller.setSelectionMode(SelectionMode.FACE);
    const raycaster = (this.controller as unknown as { raycaster: { pickFace: () => FacePickResult | null } })
      .raycaster;
    vi.spyOn(raycaster, 'pickFace').mockImplementation(() => this.scriptedPick);
  }

  /**
   * Presses and releases on a pick at a fresh point so it is never a
   * double-click.
   *
   * @param pick Face under the press, or null for empty space.
   * @param modifiers Shift and Ctrl state of the press.
   */
  click(pick: FacePickResult | null, modifiers: PressModifiers): void {
    this.press(pick, modifiers);
    this.controller.onPointerUp();
  }

  /**
   * Presses on a pick at a fresh point and keeps the stroke open.
   *
   * @param pick Face under the press, or null for empty space.
   * @param modifiers Shift and Ctrl state of the press.
   */
  press(pick: FacePickResult | null, modifiers: PressModifiers): void {
    this.scriptedPick = pick;
    this.pressCount += 1;
    const point = this.pressCount * PRESS_SPACING_PX;
    const event = { clientX: point, clientY: point, button: 0 } as MouseEvent;
    this.controller.onPointerDown(event, this.camera, this.pickElement, modifiers.shift, modifiers.ctrl);
  }

  /**
   * Moves the open stroke over a pick.
   *
   * @param pick Face under the pointer.
   */
  dragOver(pick: FacePickResult): void {
    this.scriptedPick = pick;
    this.controller.onPointerMove({ clientX: 0, clientY: 0 } as MouseEvent, this.camera, this.pickElement);
  }

  /**
   * Returns whether the face of a pick is selected.
   *
   * @param pick Face to query.
   * @returns True when its region is selected.
   */
  isSelected(pick: FacePickResult): boolean {
    return this.controller.isFaceSelected(pick.mesh, pick.faceIndex);
  }
}

/**
 * Builds one pick per surface seed of a brush.
 *
 * @param seeds Whole-brush seeds.
 * @returns Picks on each surface.
 */
function surfacePicksCreate(seeds: FaceSelection[]): FacePickResult[] {
  return seeds.map((seed) => facePickCreate(seed.mesh, seed.faceIndex));
}

/**
 * Returns the pick at an index, failing the test when the brush has fewer
 * surfaces.
 *
 * @param picks Surface picks.
 * @param index Wanted surface index.
 * @returns Pick at the index.
 */
function surfacePickAt(picks: readonly FacePickResult[], index: number): FacePickResult {
  const pick = picks[index];
  if (!pick) {
    throw new Error(`brush has no surface ${index}`);
  }
  return pick;
}

describe('ControllerFaceExtrusion Hammer click modifiers', () => {
  let rig: FaceClickRig;
  let brushASeeds: FaceSelection[];
  let brushAPicks: FacePickResult[];
  let brushBPick: FacePickResult;

  beforeEach(() => {
    rig = new FaceClickRig();
    const brushAMesh = brushResultMeshCreate('ClickModifiersBrushA');
    brushASeeds = collectFaceSelectionSeedsFromFacePick(brushAMesh, 0);
    brushAPicks = surfacePicksCreate(brushASeeds);
    brushBPick = facePickCreate(brushResultMeshCreate('ClickModifiersBrushB'), 0);
    expect(brushAPicks.length).toBeGreaterThan(2);
  });

  it('selects only the clicked face on a plain click', () => {
    rig.click(brushBPick, PLAIN);
    rig.click(surfacePickAt(brushAPicks, 0), PLAIN);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(true);
    expect(rig.isSelected(brushBPick)).toBe(false);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(false);
  });

  it('toggles the clicked face with Ctrl and keeps the rest of the selection', () => {
    rig.click(surfacePickAt(brushAPicks, 0), PLAIN);
    rig.click(surfacePickAt(brushAPicks, 1), CTRL);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(true);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(true);
    rig.click(surfacePickAt(brushAPicks, 0), CTRL);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(false);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(true);
  });

  it('selects only the whole brush with Shift', () => {
    rig.click(brushBPick, PLAIN);
    rig.click(surfacePickAt(brushAPicks, 0), SHIFT);
    expect(brushAPicks.every((pick) => rig.isSelected(pick))).toBe(true);
    expect(rig.isSelected(brushBPick)).toBe(false);
    expect(rig.controller.getSelectedFaces().every((face) => face.mesh === brushASeeds[0]?.mesh)).toBe(true);
  });

  it('adds the whole brush to the selection with Ctrl+Shift', () => {
    rig.click(brushBPick, PLAIN);
    rig.click(surfacePickAt(brushAPicks, 0), CTRL_SHIFT);
    expect(brushAPicks.every((pick) => rig.isSelected(pick))).toBe(true);
    expect(rig.isSelected(brushBPick)).toBe(true);
  });

  it('gives a Ctrl drag that starts on a selected face the remove polarity', () => {
    brushAPicks.forEach((pick) => rig.controller.selectFace(pick.mesh, pick.faceIndex, true));
    rig.press(surfacePickAt(brushAPicks, 0), CTRL);
    rig.dragOver(surfacePickAt(brushAPicks, 1));
    rig.dragOver(brushBPick);
    rig.controller.onPointerUp();
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(false);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(false);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 2))).toBe(true);
    expect(rig.isSelected(brushBPick)).toBe(false);
  });

  it('gives a Ctrl drag that starts on an unselected face the add polarity', () => {
    rig.click(surfacePickAt(brushAPicks, 2), PLAIN);
    rig.controller.selectFace(brushBPick.mesh, brushBPick.faceIndex, true);
    rig.press(surfacePickAt(brushAPicks, 0), CTRL);
    rig.dragOver(surfacePickAt(brushAPicks, 1));
    rig.dragOver(brushBPick);
    rig.controller.onPointerUp();
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(true);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(true);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 2))).toBe(true);
    expect(rig.isSelected(brushBPick)).toBe(true);
  });

  it('takes the polarity of a Ctrl drag that starts on empty space from the first face it crosses', () => {
    rig.click(surfacePickAt(brushAPicks, 0), PLAIN);
    rig.controller.selectFace(surfacePickAt(brushAPicks, 1).mesh, surfacePickAt(brushAPicks, 1).faceIndex, true);
    rig.press(null, CTRL);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(true);
    rig.dragOver(surfacePickAt(brushAPicks, 0));
    rig.dragOver(surfacePickAt(brushAPicks, 2));
    rig.controller.onPointerUp();
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(false);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(true);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 2))).toBe(false);
  });

  it('adds faces crossed by a plain drag', () => {
    rig.press(surfacePickAt(brushAPicks, 0), PLAIN);
    rig.dragOver(surfacePickAt(brushAPicks, 1));
    rig.controller.onPointerUp();
    expect(rig.isSelected(surfacePickAt(brushAPicks, 0))).toBe(true);
    expect(rig.isSelected(surfacePickAt(brushAPicks, 1))).toBe(true);
  });

  it('selects only the clicked face with Shift when it belongs to no brush', () => {
    const freeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const freePick = facePickCreate(freeMesh, 0);
    rig.click(brushBPick, PLAIN);
    rig.click(freePick, SHIFT);
    expect(rig.isSelected(freePick)).toBe(true);
    expect(rig.isSelected(brushBPick)).toBe(false);
  });
});
