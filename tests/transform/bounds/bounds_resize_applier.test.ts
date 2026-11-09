import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { notificationFrameEvents } from '@/audio/notification/notification_frame_events.js';
import { audioSettings } from '@/audio/settings/audio_settings.js';
import { BoundsResizeApplier } from '@/transform/bounds/bounds_resize_applier.js';
import { BuilderOrientedBounds, type DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { BoundsFace } from '@/types/bounds_face.js';

/** Grid interval used by snapping applier tests. */
const SNAP_INTERVAL = 0.5;

/** An applier over a session armed for a resize of one box. */
interface ApplierRig {
  applier: BoundsResizeApplier;
  session: TransformDragSession;
  box: THREE.Mesh;
}

beforeEach(() => {
  audioSettings.setEnabled(true);
  notificationFrameEvents.reset();
});

afterEach(() => {
  audioSettings.setEnabled(true);
  notificationFrameEvents.reset();
});

/**
 * Builds an applier for a box whose session drags the given faces.
 *
 * @param snapEnabled Whether grid snap is on.
 * @param primaryFace Face the drag started on.
 * @param secondaryFace Second face of a corner drag, or null.
 * @returns Applier, session and box.
 */
function applierRigCreate(snapEnabled: boolean, primaryFace: BoundsFace, secondaryFace: BoundsFace | null): ApplierRig {
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshBasicMaterial());
  box.position.set(-1.25, 0.5, 2);
  box.updateMatrixWorld(true);
  const session = new TransformDragSession();
  session.snapshotPreDragState([box]);
  session.startBounds = boundsOf(box);
  session.activeBoundsFace = primaryFace;
  session.secondaryBoundsFace = secondaryFace;
  const applier = new BoundsResizeApplier(session, new TransformExecutor(new GridSnap(snapEnabled, SNAP_INTERVAL)));
  return { applier, session, box };
}

/**
 * Builds the world oriented bounds of a box.
 *
 * @param box Box mesh with an up-to-date world matrix.
 * @returns Oriented bounds.
 */
function boundsOf(box: THREE.Mesh): DataOrientedBounds {
  const bounds = new BuilderOrientedBounds().buildFromMeshes([box]);
  if (!bounds) {
    throw new Error('Box has no bounds');
  }
  return bounds;
}

/**
 * Returns the world box of a mesh after a resize.
 *
 * @param box Resized mesh.
 * @returns World box.
 */
function worldBoxOf(box: THREE.Mesh): THREE.Box3 {
  box.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(box);
}

/** Resize steps, per-axis snapping and snap audio of bounds drags. */
describe('BoundsResizeApplier', () => {
  it('builds one step for an edge drag and two for a corner drag', () => {
    const edge = applierRigCreate(false, BoundsFace.POS_X, null);
    expect(edge.applier.stepsBuild(0.3, 0.7)).toEqual([{ face: BoundsFace.POS_X, deltaAlongNormal: 0.3 }]);
    const corner = applierRigCreate(false, BoundsFace.POS_X, BoundsFace.NEG_Z);
    expect(corner.applier.stepsBuild(0.3, 0.7)).toEqual([
      { face: BoundsFace.POS_X, deltaAlongNormal: 0.3 },
      { face: BoundsFace.NEG_Z, deltaAlongNormal: 0.7 },
    ]);
  });

  it('snaps each corner axis to the grid on its own', () => {
    const rig = applierRigCreate(true, BoundsFace.POS_X, BoundsFace.NEG_Z);
    const rawPrimary = SNAP_INTERVAL * 1.2;
    const rawSecondary = SNAP_INTERVAL * 2.9;
    const snappedPrimary = rig.applier.deltaSnap(rawPrimary);
    const snappedSecondary = rig.applier.deltaSnap(rawSecondary);
    expect(snappedPrimary).toBeCloseTo(SNAP_INTERVAL, 10);
    expect(snappedSecondary).toBeCloseTo(SNAP_INTERVAL * 3, 10);
    const startBox = worldBoxOf(rig.box);
    const startSize = startBox.getSize(new THREE.Vector3());
    rig.applier.objectsResize([rig.box], rig.applier.stepsBuild(snappedPrimary, snappedSecondary));
    const endBox = worldBoxOf(rig.box);
    const endSize = endBox.getSize(new THREE.Vector3());
    expect(endSize.x).toBeCloseTo(startSize.x + snappedPrimary, 6);
    expect(endSize.z).toBeCloseTo(startSize.z + snappedSecondary, 6);
    expect(endSize.y).toBeCloseTo(startSize.y, 6);
    expect(endBox.min.x).toBeCloseTo(startBox.min.x, 6);
    expect(endBox.max.z).toBeCloseTo(startBox.max.z, 6);
  });

  it('leaves the travel untouched while snapping is off', () => {
    const rig = applierRigCreate(false, BoundsFace.POS_X, null);
    const raw = SNAP_INTERVAL * 1.37;
    expect(rig.applier.deltaSnap(raw)).toBeCloseTo(raw, 10);
  });

  it('raises snap audio when either corner axis steps and not when nothing changes', () => {
    const rig = applierRigCreate(true, BoundsFace.POS_X, BoundsFace.NEG_Z);
    rig.applier.snapStepAudioRaiseIfStepped(rig.applier.stepsBuild(0, SNAP_INTERVAL));
    notificationFrameEvents.beginFrame();
    expect(notificationFrameEvents.hasSelectionScaledWithSnappingSnapshot()).toBe(true);
    rig.applier.snapStepAudioRaiseIfStepped(rig.applier.stepsBuild(0, SNAP_INTERVAL));
    notificationFrameEvents.beginFrame();
    expect(notificationFrameEvents.hasSelectionScaledWithSnappingSnapshot()).toBe(false);
    rig.applier.snapStepAudioRaiseIfStepped(rig.applier.stepsBuild(SNAP_INTERVAL, SNAP_INTERVAL));
    notificationFrameEvents.beginFrame();
    expect(notificationFrameEvents.hasSelectionScaledWithSnappingSnapshot()).toBe(true);
  });

  it('raises again after snap step tracking is cleared', () => {
    const rig = applierRigCreate(true, BoundsFace.POS_X, BoundsFace.NEG_Z);
    const steps = rig.applier.stepsBuild(SNAP_INTERVAL, SNAP_INTERVAL);
    rig.applier.snapStepAudioRaiseIfStepped(steps);
    notificationFrameEvents.beginFrame();
    rig.applier.snapStepTrackingClear();
    rig.applier.snapStepAudioRaiseIfStepped(steps);
    notificationFrameEvents.beginFrame();
    expect(notificationFrameEvents.hasSelectionScaledWithSnappingSnapshot()).toBe(true);
  });
});
