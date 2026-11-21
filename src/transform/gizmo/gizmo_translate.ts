import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { GizmoAxis } from '@/types/transform_mode.js';
import { GizmoHandle } from './gizmo_handle.js';
import { GizmoBuilderBase } from './gizmo_builder_base.js';
import {
  GizmoVisualStyle,
  GIZMO_PRESERVE_OPACITY_USERDATA,
  createGizmoOccludedMesh,
  createGizmoPickMesh,
} from './gizmo_visual_style.js';

/** One square plane handle: the plane it moves in and how its square is placed. */
interface GizmoTranslatePlaneSpec {
  /** Plane axis the handle drags in. */
  axis: GizmoAxis;
  /** Color of the axis normal to the plane. */
  color: number;
  /** Rotation that turns a square in the XY plane into this plane. */
  rotation: THREE.Euler;
  /** First in-plane direction the square is offset along. */
  firstDirection: THREE.Vector3;
  /** Second in-plane direction the square is offset along. */
  secondDirection: THREE.Vector3;
}

/**
 * Creates the translate transform gizmo with axis arrows, thick invisible pick
 * volumes, square plane handles that move in two axes at once, and a
 * Unity-style free-move center cube (camera-plane drag).
 */
export class GizmoTranslate extends GizmoBuilderBase {
  /**
   * Creates a new translate gizmo builder.
   *
   * @param theme The theme containing gizmo color definitions.
   */
  constructor(theme: typeof Theme) {
    super(theme);
  }

  /**
   * Creates three axis arrows, three plane handles and a free-move center
   * handle.
   *
   * @returns GizmoHandle instances for X, Y, Z, the XY, YZ and XZ planes, and
   *   VIEW.
   */
  createHandles(): GizmoHandle[] {
    this.beginHandleBuild();
    for (const spec of this.listStandardAxisSpecs()) {
      this.createAxisArrow(spec.axis, spec.color, spec.direction);
    }
    for (const planeSpec of this.listPlaneSpecs()) {
      this.createPlaneHandle(planeSpec);
    }
    this.createCenterHandle();
    return this.handles;
  }

  /**
   * Lists the three plane handles, each colored like the axis normal to it.
   *
   * @returns Plane handle specs for XY, YZ and XZ.
   */
  private listPlaneSpecs(): GizmoTranslatePlaneSpec[] {
    const unitX = new THREE.Vector3(1, 0, 0);
    const unitY = new THREE.Vector3(0, 1, 0);
    const unitZ = new THREE.Vector3(0, 0, 1);
    const xyTurn = new THREE.Euler(0, 0, 0);
    const yzTurn = new THREE.Euler(0, Math.PI / 2, 0);
    const xzTurn = new THREE.Euler(-Math.PI / 2, 0, 0);
    const theme = this.theme;
    return [
      this.planeSpecCreate(GizmoAxis.XY_PLANE, theme.gizmoZAxisColor, xyTurn, unitX, unitY),
      this.planeSpecCreate(GizmoAxis.YZ_PLANE, theme.gizmoXAxisColor, yzTurn, unitY, unitZ),
      this.planeSpecCreate(GizmoAxis.XZ_PLANE, theme.gizmoYAxisColor, xzTurn, unitX, unitZ),
    ];
  }

  /**
   * Bundles the placement of one plane handle.
   *
   * @param axis Plane axis the handle drags in.
   * @param color Color of the axis normal to the plane.
   * @param rotation Rotation that turns a square in the XY plane into this
   *   plane.
   * @param firstDirection First in-plane direction the square is offset along.
   * @param secondDirection Second in-plane direction the square is offset
   *   along.
   * @returns Plane handle spec.
   */
  private planeSpecCreate(
    axis: GizmoAxis,
    color: number,
    rotation: THREE.Euler,
    firstDirection: THREE.Vector3,
    secondDirection: THREE.Vector3,
  ): GizmoTranslatePlaneSpec {
    return { axis, color, rotation, firstDirection, secondDirection };
  }

  /**
   * Creates one square plane handle between two axis arrows, with a pick square
   * of the same size.
   *
   * @param spec Plane, color and placement of the handle.
   */
  private createPlaneHandle(spec: GizmoTranslatePlaneSpec): void {
    const group = new THREE.Group();
    const size = GizmoVisualStyle.movePlaneHandleSize;
    const geometry = new THREE.PlaneGeometry(size, size);
    const mesh = this.createFrontMesh(geometry, spec.color);
    this.planeHandleMaterialSoften(mesh);
    const handle = new GizmoHandle(spec.axis, spec.color, mesh);
    const handleId = handle.getHandleId();
    this.tagHandleId(mesh, handleId);
    const ghost = createGizmoOccludedMesh(geometry, spec.color, handleId);
    const pick = createGizmoPickMesh(new THREE.PlaneGeometry(size, size), handleId);
    this.planeHandleMeshesPlace([ghost, pick, mesh], spec);
    group.add(ghost, pick, mesh);
    this.registerSceneRoot(group);
    this.registerHandle(handle);
  }

  /**
   * Makes a plane handle see-through and keeps that opacity while hovered.
   *
   * @param mesh Visual plane handle mesh.
   */
  private planeHandleMaterialSoften(mesh: THREE.Mesh): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.opacity = GizmoVisualStyle.movePlaneHandleOpacity;
    }
    mesh.userData[GIZMO_PRESERVE_OPACITY_USERDATA] = GizmoVisualStyle.movePlaneHandleOpacity;
  }

  /**
   * Turns plane handle meshes into their plane and moves them off the center
   * along both in-plane directions.
   *
   * @param meshes Meshes of one plane handle.
   * @param spec Plane, color and placement of the handle.
   */
  private planeHandleMeshesPlace(meshes: readonly THREE.Mesh[], spec: GizmoTranslatePlaneSpec): void {
    const centerOffset = GizmoVisualStyle.movePlaneHandleOffset + GizmoVisualStyle.movePlaneHandleSize * 0.5;
    const center = spec.firstDirection.clone().add(spec.secondDirection).multiplyScalar(centerOffset);
    for (const mesh of meshes) {
      mesh.rotation.copy(spec.rotation);
      mesh.position.copy(center);
    }
  }

  /**
   * Creates a single axis arrow with thin visuals and a thicker pick volume.
   *
   * @param axis The gizmo axis for this arrow.
   * @param color The hex color of the arrow.
   * @param direction The unit direction vector for the arrow orientation.
   */
  private createAxisArrow(axis: GizmoAxis, color: number, direction: THREE.Vector3): void {
    const group = new THREE.Group();
    const stemMesh = this.createMoveStemMesh(color);
    const headMesh = this.createMoveHeadMesh(color);
    const handle = new GizmoHandle(axis, color, headMesh);
    this.attachAxisArrowMeshes(group, stemMesh, headMesh, handle.getHandleId());
    this.alignGroupLocalYToDirection(group, direction);
    this.registerSceneRoot(group);
    this.registerHandle(handle);
  }

  /**
   * Creates the thin cylinder stem for a move arrow.
   *
   * @param color Axis color.
   * @returns Front stem mesh positioned along local +Y.
   */
  private createMoveStemMesh(color: number): THREE.Mesh {
    const stemGeometry = new THREE.CylinderGeometry(
      GizmoVisualStyle.stemRadius,
      GizmoVisualStyle.stemRadius,
      GizmoVisualStyle.moveStemLength,
      8,
    );
    const stemMesh = this.createFrontMesh(stemGeometry, color);
    stemMesh.position.set(0, GizmoVisualStyle.moveStemLength * 0.5, 0);
    return stemMesh;
  }

  /**
   * Creates the cone head for a move arrow.
   *
   * @param color Axis color.
   * @returns Front head mesh positioned at the stem tip.
   */
  private createMoveHeadMesh(color: number): THREE.Mesh {
    const headGeometry = new THREE.ConeGeometry(GizmoVisualStyle.moveHeadRadius, GizmoVisualStyle.moveHeadLength, 8);
    const headMesh = this.createFrontMesh(headGeometry, color);
    const headOffset = GizmoVisualStyle.moveStemLength + GizmoVisualStyle.moveHeadLength * 0.5;
    headMesh.position.set(0, headOffset, 0);
    return headMesh;
  }

  /**
   * Tags, ghosts, pick-volumes, and parents stem and head under the axis group.
   *
   * @param group Axis handle group.
   * @param stemMesh Visual stem.
   * @param headMesh Visual head.
   * @param handleId Shared handle id.
   */
  private attachAxisArrowMeshes(
    group: THREE.Group,
    stemMesh: THREE.Mesh,
    headMesh: THREE.Mesh,
    handleId: number,
  ): void {
    this.tagHandleId(stemMesh, handleId);
    this.tagHandleId(headMesh, handleId);
    this.addOccludedPair(group, stemMesh.geometry, this.materialColorOf(stemMesh), handleId, stemMesh.position);
    this.addOccludedPair(group, headMesh.geometry, this.materialColorOf(headMesh), handleId, headMesh.position);
    this.addAxisPickVolumes(group, handleId, stemMesh.position, headMesh.position);
    group.add(stemMesh);
    group.add(headMesh);
  }

  /**
   * Adds invisible thicker pick meshes for stem and head along local Y.
   *
   * @param group Axis handle group.
   * @param handleId Shared handle id.
   * @param stemPosition Local stem center.
   * @param headPosition Local head center.
   */
  private addAxisPickVolumes(
    group: THREE.Group,
    handleId: number,
    stemPosition: THREE.Vector3,
    headPosition: THREE.Vector3,
  ): void {
    const stemPick = createGizmoPickMesh(
      new THREE.CylinderGeometry(
        GizmoVisualStyle.stemPickRadius,
        GizmoVisualStyle.stemPickRadius,
        GizmoVisualStyle.moveStemLength,
        8,
      ),
      handleId,
    );
    stemPick.position.copy(stemPosition);
    const headPick = createGizmoPickMesh(
      new THREE.ConeGeometry(GizmoVisualStyle.moveHeadPickRadius, GizmoVisualStyle.moveHeadLength, 8),
      handleId,
    );
    headPick.position.copy(headPosition);
    group.add(stemPick);
    group.add(headPick);
  }

  /** Creates the free-move center cube used for camera-plane translation. */
  private createCenterHandle(): void {
    const group = new THREE.Group();
    const size = GizmoVisualStyle.centerHandleSize;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const color = this.theme.gizmoCenterColor;
    const mesh = this.createFrontMesh(geometry, color);
    const handle = new GizmoHandle(GizmoAxis.VIEW, color, mesh);
    const handleId = handle.getHandleId();
    this.tagHandleId(mesh, handleId);
    this.addOccludedPair(group, geometry, color, handleId, mesh.position);
    const pick = createGizmoPickMesh(new THREE.BoxGeometry(size * 1.35, size * 1.35, size * 1.35), handleId);
    group.add(pick);
    group.add(mesh);
    this.registerSceneRoot(group);
    this.registerHandle(handle);
  }
}
