import * as THREE from 'three';
import type { Theme } from '@/theme.js';
import { BoundsFace, BOUNDS_FACE_USERDATA_KEY } from '@/types/bounds_face.js';
import type { DataOrientedBounds } from './builder_oriented_bounds.js';
import { BOUNDS_FACE_EDGE_HIGHLIGHT_KEY } from './bounds_face_highlight.js';
import { BOUNDS_HANDLE_FACE_HALF_KEY, getViewPlaneDepthDirection } from './bounds_handle_geometry.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import {
  computeBoundsCubeVisualWorldSizeForFace,
  computeBoundsCubeWorldSizeForFace,
} from './bounds_handle_screen_size.js';
import { BOUNDS_ARROW_VISUAL_GROUP_KEY, BOUNDS_CUBE_PICK_KEY } from './gizmo_bounds_keys.js';
import {
  boundsFaceAxisLetter,
  boundsFaceLocalNormalWrite,
  boundsHandleFacesEqual,
  boundsHandleFacesIsCorner,
  boundsHandleFacesRead,
  boundsHandleFacesSmallestHalfExtent,
  boundsHandleFacesTouchAxes,
  type BoundsFaceAxisLetter,
} from './handle/bounds_handle_faces.js';
import { BoundsHandleSquareStyler } from './handle/bounds_handle_square.js';
import {
  boundsHandleSquareCornerFits,
  boundsHandleSquareLayoutForCamera,
  boundsHandleSquareLayoutFromFallback,
  type BoundsHandleSquareLayout,
} from './handle/bounds_handle_square_layout.js';

/** Host state needed for bounds gizmo screen-space styling. */
export interface GizmoBoundsScreenStyleHost {
  /**
   * Returns the current oriented bounds, if any.
   *
   * @returns Bounds data or null.
   */
  getCurrentBounds(): DataOrientedBounds | null;

  /**
   * Returns whether the selection may be resized, which decides whether resize
   * grips are shown.
   *
   * @returns True when resizing is allowed.
   */
  isResizeAllowed(): boolean;

  /**
   * Returns the faces currently under resize hover.
   *
   * @returns Highlighted faces; empty when nothing is hovered.
   */
  getHighlightedFaces(): readonly BoundsFace[];

  /**
   * Returns the theme colors.
   *
   * @returns Theme object.
   */
  getTheme(): typeof Theme;

  /**
   * Returns the pick square world size used before screen sizing is known.
   *
   * @returns Fallback square size in world units.
   */
  getSquareFallbackWorldSize(): number;
}

/** State shared by every square styled in one pass over a gizmo clone. */
interface GizmoBoundsSquareStylePass {
  /** Whether bounds exist to place squares around. */
  hasBounds: boolean;
  /** Bounds half extents the squares sit around. */
  halfExtents: THREE.Vector3;
  /** Square sizes for the current zoom. */
  layout: BoundsHandleSquareLayout;
  /** Whether resize squares may show. */
  resizeAllowed: boolean;
  /** Faces under resize hover. */
  highlightedFaces: readonly BoundsFace[];
}

/** Local axis the arrow handle geometry points along before orientation. */
const BOUNDS_ARROW_LOCAL_UP = new THREE.Vector3(0, 1, 0);

/** Scratch vector for a face outward normal in local bounds space. */
const scratchArrowFaceNormal = new THREE.Vector3();

/** Applies 2D square and 3D arrow screen-space styling for bounds gizmo clones. */
export class GizmoBoundsScreenStyle {
  private readonly host: GizmoBoundsScreenStyleHost;
  private readonly squareStyler: BoundsHandleSquareStyler;
  private readonly squarePass: GizmoBoundsSquareStylePass;
  private readonly squareStyleVisit: (child: THREE.Object3D) => void;

  /**
   * Creates a screen-style helper for a bounds gizmo.
   *
   * @param host Gizmo host providing bounds and theme state.
   */
  constructor(host: GizmoBoundsScreenStyleHost) {
    this.host = host;
    this.squareStyler = new BoundsHandleSquareStyler(host.getTheme());
    this.squarePass = {
      hasBounds: false,
      halfExtents: new THREE.Vector3(),
      layout: boundsHandleSquareLayoutFromFallback(host.getSquareFallbackWorldSize()),
      resizeAllowed: false,
      highlightedFaces: [],
    };
    this.squareStyleVisit = (child) => {
      if (BoundsHandleSquareStyler.isSquare(child)) {
        this.squarePlaceShowAndHighlight(child);
      }
    };
  }

  /**
   * Styles a viewport gizmo clone for its view plane: in-plane handles become
   * resize squares, depth-axis handles and outlines hide.
   *
   * @param root Viewport gizmo clone root.
   * @param viewPlane Plane for this viewport (`xyz` = perspective).
   * @param hiddenAxes Depth axes to hide for resize grips only.
   */
  styleCloneForViewPlane(
    root: THREE.Object3D,
    viewPlane: CadViewPlane,
    hiddenAxes: ReadonlyArray<BoundsFaceAxisLetter>,
  ): void {
    const depthDirection = getViewPlaneDepthDirection(viewPlane);
    if (!depthDirection) {
      return;
    }
    this.squarePassPrepare(boundsHandleSquareLayoutFromFallback(this.host.getSquareFallbackWorldSize()));
    root.traverse((child) => {
      this.edgeHighlightHideOnHiddenAxis(child, hiddenAxes);
      this.handleStyleForViewPlane(child, hiddenAxes, depthDirection);
    });
  }

  /**
   * Applies per-frame screen-space sizing for a viewport bounds clone.
   *
   * @param root Viewport gizmo clone.
   * @param viewPlane Plane for this viewport.
   * @param camera Active viewport camera.
   * @param viewportHeightPx Drawable pane height in CSS pixels.
   */
  applyScreenSpaceStyleToClone(
    root: THREE.Object3D,
    viewPlane: CadViewPlane,
    camera: THREE.Camera,
    viewportHeightPx: number,
  ): void {
    if (viewPlane === 'xyz') {
      this.applyPerspectiveArrowScreenStyle(root, camera);
      return;
    }
    this.applyOrthographicSquareScreenStyle(root, camera, viewportHeightPx);
  }

  /**
   * Tints every resize square under a root: squares whose faces match the
   * hovered faces use the hover colour.
   *
   * @param root Gizmo root whose squares are recolored.
   */
  applySquareHighlightColors(root: THREE.Object3D): void {
    const highlightedFaces = this.host.getHighlightedFaces();
    root.traverse((child) => {
      if (BoundsHandleSquareStyler.isSquare(child)) {
        this.squareHighlightFromFaces(child, highlightedFaces);
      }
    });
  }

  /**
   * Tints one resize square with the hover colour when its faces match the
   * hovered faces, otherwise with the idle colour.
   *
   * @param square Square root.
   * @param highlightedFaces Faces under resize hover.
   */
  private squareHighlightFromFaces(square: THREE.Object3D, highlightedFaces: readonly BoundsFace[]): void {
    const isHovered =
      highlightedFaces.length > 0 && boundsHandleFacesEqual(boundsHandleFacesRead(square), highlightedFaces);
    this.squareStyler.squareHighlightApply(square, isHovered);
  }

  /**
   * Fills the reusable square pass with the host bounds, the layout, the resize
   * permission and the hovered faces of the current styling pass.
   *
   * @param layout Square sizes to place squares with.
   */
  private squarePassPrepare(layout: BoundsHandleSquareLayout): void {
    const bounds = this.host.getCurrentBounds();
    this.squarePass.hasBounds = bounds !== null;
    if (bounds) {
      this.squarePass.halfExtents.copy(bounds.halfExtents);
    }
    this.squarePass.layout = layout;
    this.squarePass.resizeAllowed = this.host.isResizeAllowed();
    this.squarePass.highlightedFaces = this.host.getHighlightedFaces();
  }

  /**
   * Updates 3D arrow pick and visual scales from the perspective camera
   * distance.
   *
   * @param root Perspective gizmo clone.
   * @param camera Perspective camera.
   */
  private applyPerspectiveArrowScreenStyle(root: THREE.Object3D, camera: THREE.Camera): void {
    const bounds = this.host.getCurrentBounds();
    if (!bounds) {
      return;
    }
    const resizeAllowed = this.host.isResizeAllowed();
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || child.userData[BOUNDS_CUBE_PICK_KEY] !== true) {
        return;
      }
      child.visible = resizeAllowed;
      if (resizeAllowed) {
        this.arrowScaleForCamera(child, bounds, camera);
      }
    });
  }

  /**
   * Scales one 3D arrow for the perspective camera distance with a per-face
   * edge cap so large faces of thin brushes keep readable arrows.
   *
   * @param arrow Arrow pick root.
   * @param bounds Current bounds.
   * @param camera Perspective camera.
   */
  private arrowScaleForCamera(arrow: THREE.Mesh, bounds: DataOrientedBounds, camera: THREE.Camera): void {
    const face = arrow.userData[BOUNDS_FACE_USERDATA_KEY] as BoundsFace | undefined;
    if (!face) {
      return;
    }
    const pickSize = computeBoundsCubeWorldSizeForFace(bounds, camera, face);
    const visualSize = computeBoundsCubeVisualWorldSizeForFace(bounds, camera, face);
    this.scaleArrowPickAndVisual(arrow, pickSize, visualSize);
  }

  /**
   * Keeps 2D resize squares a constant size on screen for the ortho zoom.
   *
   * @param root Orthographic gizmo clone.
   * @param camera Orthographic camera.
   * @param viewportHeightPx Drawable height in CSS pixels.
   */
  private applyOrthographicSquareScreenStyle(
    root: THREE.Object3D,
    camera: THREE.Camera,
    viewportHeightPx: number,
  ): void {
    this.squarePassPrepare(boundsHandleSquareLayoutForCamera(camera, viewportHeightPx));
    root.traverse(this.squareStyleVisit);
  }

  /**
   * Places, shows and tints one square from the current square pass. A square
   * shows when resizing is allowed and, for corners, when it keeps clear of the
   * neighbouring edge squares.
   *
   * @param square Square root.
   */
  private squarePlaceShowAndHighlight(square: THREE.Object3D): void {
    const pass = this.squarePass;
    if (!pass.hasBounds) {
      return;
    }
    const faces = boundsHandleFacesRead(square);
    this.squareStyler.squarePlace(square, faces, pass.halfExtents, pass.layout);
    const cornerFits =
      !boundsHandleFacesIsCorner(faces) ||
      boundsHandleSquareCornerFits(boundsHandleFacesSmallestHalfExtent(faces, pass.halfExtents), pass.layout);
    square.visible = pass.resizeAllowed && cornerFits;
    this.squareHighlightFromFaces(square, pass.highlightedFaces);
  }

  /**
   * Hides a face edge-highlight outline whose face lies on a hidden depth axis.
   *
   * @param child Scene object in the clone tree.
   * @param hiddenAxes Depth axes hidden in this view.
   */
  private edgeHighlightHideOnHiddenAxis(child: THREE.Object3D, hiddenAxes: ReadonlyArray<BoundsFaceAxisLetter>): void {
    if (child.userData[BOUNDS_FACE_EDGE_HIGHLIGHT_KEY] !== true) {
      return;
    }
    const face = child.userData[BOUNDS_FACE_USERDATA_KEY] as BoundsFace | undefined;
    if (face && hiddenAxes.includes(boundsFaceAxisLetter(face))) {
      child.visible = false;
    }
  }

  /**
   * Turns an in-plane resize handle into a square laid flat in the view, or
   * hides handles that resize along the depth axis or may not resize.
   *
   * @param child Scene object in the clone tree.
   * @param hiddenAxes Depth axes hidden in this view.
   * @param depthDirection Local view depth direction.
   */
  private handleStyleForViewPlane(
    child: THREE.Object3D,
    hiddenAxes: ReadonlyArray<BoundsFaceAxisLetter>,
    depthDirection: THREE.Vector3,
  ): void {
    const faces = boundsHandleFacesRead(child);
    if (faces.length === 0 || !(child instanceof THREE.Mesh)) {
      return;
    }
    if (!this.squarePass.resizeAllowed || boundsHandleFacesTouchAxes(faces, hiddenAxes)) {
      child.traverse((part) => {
        part.visible = false;
      });
      return;
    }
    this.squareStyler.squareEnsure(child);
    this.squareStyler.squareOrient(child, depthDirection);
    this.squarePlaceShowAndHighlight(child);
  }

  /**
   * Scales a 3D arrow pick root and its visual group.
   *
   * @param pickMesh Handle root mesh (pick volume).
   * @param pickSize World edge length for picking.
   * @param visualSize World length for the arrow graphic.
   */
  scaleArrowPickAndVisual(pickMesh: THREE.Mesh, pickSize: number, visualSize: number): void {
    const face = pickMesh.userData[BOUNDS_FACE_USERDATA_KEY] as BoundsFace | undefined;
    const faceHalf = (pickMesh.userData[BOUNDS_HANDLE_FACE_HALF_KEY] as number | undefined) ?? 0.5;
    pickMesh.scale.set(pickSize, pickSize, pickSize);
    if (face) {
      this.orientHandleAlongFaceNormal(pickMesh, face);
      const pickOffsetAlongNormal = pickSize * 0.35;
      boundsFaceLocalNormalWrite(face, pickMesh.position).multiplyScalar(faceHalf + pickOffsetAlongNormal);
    }
    const visualRatio = pickSize > 1e-8 ? visualSize / pickSize : 0.7;
    for (const child of pickMesh.children) {
      if (child.userData[BOUNDS_ARROW_VISUAL_GROUP_KEY] === true) {
        child.scale.set(visualRatio, visualRatio, visualRatio);
      }
    }
  }

  /**
   * Orients a handle so local +Y aligns with the face outward normal.
   *
   * @param mesh Handle root.
   * @param face Bounds face.
   */
  private orientHandleAlongFaceNormal(mesh: THREE.Object3D, face: BoundsFace): void {
    boundsFaceLocalNormalWrite(face, scratchArrowFaceNormal);
    mesh.quaternion.setFromUnitVectors(BOUNDS_ARROW_LOCAL_UP, scratchArrowFaceNormal);
  }
}
