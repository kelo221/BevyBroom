import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { GizmoAxis } from '@/types/transform_mode.js';
import { GizmoTranslate } from '@/transform/gizmo/gizmo_translate.js';
import { GIZMO_PICK_VOLUME_USERDATA } from '@/transform/gizmo/gizmo_visual_style.js';

describe('GizmoTranslate', () => {
  let gizmo: GizmoTranslate;

  beforeEach(() => {
    gizmo = new GizmoTranslate(Theme);
  });

  it('should create three axis handles, three plane handles and a free-move center handle', () => {
    const handles = gizmo.createHandles();
    expect(handles.length).toBe(7);
    expect(handles.some((handle) => handle.getAxis() === GizmoAxis.VIEW)).toBe(true);
  });

  /**
   * Each plane handle is a square lying in its plane, off the center on the
   * positive side of both in-plane axes, colored like the axis normal to it.
   */
  it('creates one square per plane, lying in that plane between its two arrows', () => {
    const handles = gizmo.createHandles();
    const planes = [
      { axis: GizmoAxis.XY_PLANE, normal: new THREE.Vector3(0, 0, 1), color: Theme.gizmoZAxisColor },
      { axis: GizmoAxis.YZ_PLANE, normal: new THREE.Vector3(1, 0, 0), color: Theme.gizmoXAxisColor },
      { axis: GizmoAxis.XZ_PLANE, normal: new THREE.Vector3(0, 1, 0), color: Theme.gizmoYAxisColor },
    ];
    for (const plane of planes) {
      const handle = handles.find((candidate) => candidate.getAxis() === plane.axis);
      expect(handle?.getColor()).toBe(plane.color);
      const mesh = handle?.getVisualMesh();
      if (!mesh) throw new Error(`missing ${plane.axis} handle`);
      mesh.updateMatrixWorld(true);
      const worldNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
      expect(Math.abs(worldNormal.dot(plane.normal))).toBeCloseTo(1, 6);
      expect(mesh.position.dot(plane.normal)).toBeCloseTo(0, 6);
      const normalComponents = plane.normal.toArray();
      const inPlaneOffsets = mesh.position
        .toArray()
        .filter((_offset, index) => Math.abs(normalComponents[index] ?? 0) < 0.5);
      expect(inPlaneOffsets).toHaveLength(2);
      inPlaneOffsets.forEach((offset) => expect(offset).toBeGreaterThan(0));
    }
  });

  it('should assign correct axis to X handle', () => {
    const handles = gizmo.createHandles();
    const xHandle = handles.find((h) => h.getAxis() === GizmoAxis.X);
    expect(xHandle).toBeDefined();
    expect(xHandle!.getAxis()).toBe(GizmoAxis.X);
  });

  it('should assign correct axis to Y handle', () => {
    const handles = gizmo.createHandles();
    const yHandle = handles.find((h) => h.getAxis() === GizmoAxis.Y);
    expect(yHandle).toBeDefined();
    expect(yHandle!.getAxis()).toBe(GizmoAxis.Y);
  });

  it('should assign correct axis to Z handle', () => {
    const handles = gizmo.createHandles();
    const zHandle = handles.find((h) => h.getAxis() === GizmoAxis.Z);
    expect(zHandle).toBeDefined();
    expect(zHandle!.getAxis()).toBe(GizmoAxis.Z);
  });

  it('should use correct colors for axis handles', () => {
    const handles = gizmo.createHandles();
    const xHandle = handles.find((h) => h.getAxis() === GizmoAxis.X)!;
    const yHandle = handles.find((h) => h.getAxis() === GizmoAxis.Y)!;
    const zHandle = handles.find((h) => h.getAxis() === GizmoAxis.Z)!;
    expect(xHandle.getColor()).toBe(Theme.gizmoXAxisColor);
    expect(yHandle.getColor()).toBe(Theme.gizmoYAxisColor);
    expect(zHandle.getColor()).toBe(Theme.gizmoZAxisColor);
  });

  it('should have valid visual meshes for all handles', () => {
    const handles = gizmo.createHandles();
    handles.forEach((handle) => {
      const mesh = handle.getVisualMesh();
      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });
  });

  it('should expose thick invisible pick volumes for easier clicking', () => {
    gizmo.createHandles();
    const sceneObjects = gizmo.getAllSceneObjects();
    let pickCount = 0;
    sceneObjects.forEach((root) => {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData[GIZMO_PICK_VOLUME_USERDATA] === true) {
          pickCount += 1;
        }
      });
    });
    expect(pickCount).toBeGreaterThanOrEqual(7);
  });

  it('should have scene objects that can be added to a scene', () => {
    gizmo.createHandles();
    const sceneObjects = gizmo.getAllSceneObjects();
    expect(sceneObjects.length).toBe(7);
  });

  it('should clear handles on new creation', () => {
    const first = gizmo.createHandles();
    const second = gizmo.createHandles();
    expect(second.length).toBe(7);
    expect(second).not.toBe(first);
  });
});
