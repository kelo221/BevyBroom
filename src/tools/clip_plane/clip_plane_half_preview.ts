import * as THREE from 'three';
import { CsgClipper } from '@/csg/csg_clipper.js';
import { BuilderCsgMesh } from '@/csg/builder_csg_mesh.js';
import { CsgPolygon } from '@/csg/csg_polygon.js';
import { buildPlaneCapPolygon } from '@/csg/csg_plane_cap.js';
import { planeToCsgForm } from '@/csg/csg_plane_from_points.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import { Theme } from '@/theme.js';
import { CLIP_PREVIEW_USERDATA_KEY } from './clip_plane_preview_keys.js';
import { ClipKeepMode } from './clip_keep_mode.js';
import { clipPreviewDepthTestPerPaneApply } from './clip_plane_preview_render_hooks.js';

/** UserData key storing the role of a clip piece preview mesh. */
export const CLIP_PIECE_ROLE_USERDATA_KEY = 'clipPieceRole';

/**
 * What happens to a previewed piece: removed, kept, or kept as the second of
 * two.
 */
export type ClipPieceRole = 'discard' | 'keep_first' | 'keep_second';

/**
 * Skip full half-mesh rebuilds above this triangle count so dragging stays
 * interactive on dense CSG results (silhouette lines still draw).
 */
const MAX_HALF_PREVIEW_TRIANGLES = 6000;

/** Fill opacity of the piece a clip removes. */
const DISCARD_OPACITY = 0.45;

/** Fill opacity of each piece when a clip keeps both. */
const KEEP_BOTH_OPACITY = 0.35;

/** Polygon offset that pulls piece fills in front of the coplanar brush faces. */
const PIECE_POLYGON_OFFSET_UNITS = -4;

/** Look of one piece preview: its side of the plane, color, opacity and role. */
interface ClipPiecePreviewLook {
  readonly isFrontSide: boolean;
  readonly color: number;
  readonly opacity: number;
  readonly role: ClipPieceRole;
}

/** Shared CSG helpers reused across preview rebuilds. */
const sharedMeshBuilder = new BuilderCsgMesh();
const sharedClipper = new CsgClipper();

/**
 * Builds the piece previews of one source target. Keeping one side shows only
 * the removed piece, in red; keeping both shows the two pieces in two colors.
 * Pieces are closed (capped) solids, depth-tested in perspective panes and
 * drawn on top in orthographic panes.
 *
 * @param sourceMesh Selected mesh to preview-clip.
 * @param plane World clip plane.
 * @param mode Which pieces the clip keeps.
 * @returns Piece preview meshes (empty pieces are left out).
 */
export function buildClipPiecePreviews(sourceMesh: THREE.Mesh, plane: THREE.Plane, mode: ClipKeepMode): THREE.Mesh[] {
  if (!canBuildHalfPreview(sourceMesh)) return [];
  sourceMesh.updateMatrixWorld(true);
  const sourcePolygons = sharedMeshBuilder.meshToPolygons(sourceMesh);
  if (sourcePolygons.length === 0) return [];
  const meshes: THREE.Mesh[] = [];
  clipPieceLooksFor(mode).forEach((look) => {
    const mesh = buildHalfMesh(sourcePolygons, plane, look);
    if (mesh) meshes.push(mesh);
  });
  return meshes;
}

/**
 * Returns the pieces to preview for a keep mode and how each one looks.
 *
 * @param mode Which pieces the clip keeps.
 * @returns Piece looks.
 */
function clipPieceLooksFor(mode: ClipKeepMode): ClipPiecePreviewLook[] {
  if (mode === ClipKeepMode.BOTH) {
    return [
      { isFrontSide: true, color: Theme.clipKeepColor, opacity: KEEP_BOTH_OPACITY, role: 'keep_first' },
      { isFrontSide: false, color: Theme.clipKeepSecondColor, opacity: KEEP_BOTH_OPACITY, role: 'keep_second' },
    ];
  }
  const isDiscardFrontSide = mode === ClipKeepMode.SIDE_B;
  return [
    { isFrontSide: isDiscardFrontSide, color: Theme.clipDiscardColor, opacity: DISCARD_OPACITY, role: 'discard' },
  ];
}

/**
 * Builds one capped piece preview mesh for a CSG side.
 *
 * @param sourcePolygons World-space source polygons.
 * @param plane Cutting plane.
 * @param look Piece side, color, opacity and role.
 * @returns Preview mesh, or null when that side is empty.
 */
function buildHalfMesh(
  sourcePolygons: CsgPolygon[],
  plane: THREE.Plane,
  look: ClipPiecePreviewLook,
): THREE.Mesh | null {
  const polygons = buildCappedHalf(sourcePolygons, plane, look.isFrontSide);
  return polygonsToPreviewMesh(polygons, look);
}

/**
 * Returns whether a mesh is cheap enough for live half-mesh preview.
 *
 * @param mesh Candidate mesh.
 * @returns True when half previews should be built.
 */
function canBuildHalfPreview(mesh: THREE.Mesh): boolean {
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.BufferGeometry)) return false;
  return getTriangleCount(geometry) <= MAX_HALF_PREVIEW_TRIANGLES;
}

/**
 * Clips source polygons to one half-space and caps the cut.
 *
 * @param sourcePolygons World-space source polygons.
 * @param plane Cutting plane.
 * @param keepFront Whether to keep the CSG front half-space.
 * @returns Capped polygons, or empty when that side is void.
 */
function buildCappedHalf(sourcePolygons: CsgPolygon[], plane: THREE.Plane, keepFront: boolean): CsgPolygon[] {
  const csgPlane = planeToCsgForm(plane);
  const clipped = clipToSide(sourcePolygons, csgPlane.normal, csgPlane.constant, keepFront);
  if (clipped.length === 0) return [];
  const outward = keepFront ? csgPlane.normal.clone().negate() : csgPlane.normal.clone();
  const cap = buildPlaneCapPolygon(sourcePolygons, csgPlane.normal, csgPlane.constant, outward);
  return cap ? [...clipped, cap] : clipped;
}

/**
 * Clips polygons to the front or back half-space.
 *
 * @param polygons Source polygons.
 * @param planeNormal CSG plane normal.
 * @param planeConstant CSG plane constant.
 * @param keepFront Whether to keep the front side.
 * @returns Clipped polygons without a cap.
 */
function clipToSide(
  polygons: CsgPolygon[],
  planeNormal: THREE.Vector3,
  planeConstant: number,
  keepFront: boolean,
): CsgPolygon[] {
  if (keepFront) {
    return sharedClipper.clipPolygonsToFront(polygons, planeNormal, planeConstant);
  }
  return sharedClipper.clipPolygonsToFront(polygons, planeNormal.clone().negate(), -planeConstant);
}

/**
 * Fan-triangulates polygons into a transparent piece preview mesh without
 * textures.
 *
 * @param polygons Half-space polygons.
 * @param look Piece color, opacity and role.
 * @returns Preview mesh, or null when empty.
 */
function polygonsToPreviewMesh(polygons: CsgPolygon[], look: ClipPiecePreviewLook): THREE.Mesh | null {
  if (polygons.length === 0) return null;
  const positions: number[] = [];
  polygons.forEach((polygon) => appendFanTriangles(polygon.getVertices(), positions));
  if (positions.length < 9) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, piecePreviewMaterialCreate(look));
  mesh.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
  mesh.userData[CLIP_PIECE_ROLE_USERDATA_KEY] = look.role;
  mesh.renderOrder = 980;
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  clipPreviewDepthTestPerPaneApply(mesh);
  return mesh;
}

/**
 * Creates the translucent material of a piece preview. It never writes depth
 * and is pulled toward the camera so it wins against the coplanar brush faces.
 *
 * @param look Piece color and opacity.
 * @returns Piece material.
 */
function piecePreviewMaterialCreate(look: ClipPiecePreviewLook): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: look.color,
    transparent: true,
    opacity: look.opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: PIECE_POLYGON_OFFSET_UNITS,
  });
  material.toneMapped = false;
  return material;
}

/**
 * Appends fan-triangulated positions for one polygon.
 *
 * @param vertices Polygon vertices in winding order.
 * @param positions Output xyz list.
 */
function appendFanTriangles(vertices: THREE.Vector3[], positions: number[]): void {
  for (let i = 1; i + 1 < vertices.length; i++) {
    const first = vertices[0]!;
    const second = vertices[i]!;
    const third = vertices[i + 1]!;
    positions.push(first.x, first.y, first.z, second.x, second.y, second.z, third.x, third.y, third.z);
  }
}
