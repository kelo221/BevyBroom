import * as THREE from 'three';
import type { Theme } from '@/theme.js';
import type { BoundsFace } from '@/types/bounds_face.js';
import { BOUNDS_CUBE_PICK_KEY } from '@/transform/bounds/gizmo_bounds_keys.js';
import { boundsHandleFacesLocalAnchorWrite } from './bounds_handle_faces.js';
import type { BoundsHandleSquareLayout } from './bounds_handle_square_layout.js';

/** UserData flag: handle mesh is drawn as a Hammer-style 2D resize square. */
export const BOUNDS_HANDLE_IS_SQUARE_KEY = 'boundsHandleIsSquare';

/** UserData flag on the white fill mesh of a resize square. */
export const BOUNDS_SQUARE_FILL_KEY = 'boundsSquareFill';

/** Render order that keeps resize squares above bounds wires and outlines. */
const BOUNDS_SQUARE_RENDER_ORDER = 1002;

/** Unit square perimeter vertices (four segments, edge length one). */
const BOUNDS_SQUARE_OUTLINE_POSITIONS = [
  -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0,
];

/** Local normal of the unit square plane before orientation. */
const BOUNDS_SQUARE_PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

/** Scratch vector for the normalized view depth direction. */
const scratchSquareDepthDirection = new THREE.Vector3();

/**
 * Builds, places and tints Hammer-style 2D resize squares: an invisible pick
 * square that owns the handle id, a white fill and a thin outline, all lying
 * flat in the view plane.
 */
export class BoundsHandleSquareStyler {
  private readonly theme: typeof Theme;

  /**
   * Creates a square styler.
   *
   * @param theme Theme supplying fill, hover and outline colours.
   */
  constructor(theme: typeof Theme) {
    this.theme = theme;
  }

  /**
   * Returns whether an object was already turned into a resize square.
   *
   * @param object Scene object under a gizmo root.
   * @returns True for resize square roots.
   */
  static isSquare(object: THREE.Object3D): boolean {
    return object.userData[BOUNDS_HANDLE_IS_SQUARE_KEY] === true;
  }

  /**
   * Creates the unit plane used for square pick roots and fills.
   *
   * @returns Plane geometry with edge length one in the local XY plane.
   */
  static squarePlaneGeometryCreate(): THREE.PlaneGeometry {
    return new THREE.PlaneGeometry(1, 1);
  }

  /**
   * Creates the invisible material of a square pick root. Raycasts still hit it
   * while nothing is drawn.
   *
   * @returns Hidden pick material.
   */
  static squarePickMaterialCreate(): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
    material.visible = false;
    return material;
  }

  /**
   * Turns a handle mesh into a resize square once: drops any other visuals and
   * adds a fresh fill and outline.
   *
   * @param mesh Handle mesh (pick root) inside a viewport clone.
   */
  squareEnsure(mesh: THREE.Mesh): void {
    if (BoundsHandleSquareStyler.isSquare(mesh)) {
      return;
    }
    this.childrenRemove(mesh);
    mesh.geometry = BoundsHandleSquareStyler.squarePlaneGeometryCreate();
    mesh.material = BoundsHandleSquareStyler.squarePickMaterialCreate();
    mesh.add(this.squareFillCreate(), this.squareOutlineCreate());
    mesh.userData[BOUNDS_HANDLE_IS_SQUARE_KEY] = true;
    mesh.userData[BOUNDS_CUBE_PICK_KEY] = false;
  }

  /**
   * Lays a square flat in the view plane.
   *
   * @param mesh Square root.
   * @param localDepthDirection View depth direction in local bounds space.
   */
  squareOrient(mesh: THREE.Object3D, localDepthDirection: THREE.Vector3): void {
    scratchSquareDepthDirection.copy(localDepthDirection).normalize();
    mesh.quaternion.setFromUnitVectors(BOUNDS_SQUARE_PLANE_NORMAL, scratchSquareDepthDirection);
  }

  /**
   * Moves a square next to its faces and sizes its pick root and visuals.
   *
   * @param mesh Square root.
   * @param faces Faces dragged by the square.
   * @param halfExtents Bounds half extents.
   * @param layout Square sizes for the current zoom.
   */
  squarePlace(
    mesh: THREE.Object3D,
    faces: readonly BoundsFace[],
    halfExtents: THREE.Vector3,
    layout: BoundsHandleSquareLayout,
  ): void {
    boundsHandleFacesLocalAnchorWrite(faces, halfExtents, layout.outwardGap, mesh.position);
    mesh.scale.setScalar(layout.pickSize);
    const visualRatio = layout.visualSize / layout.pickSize;
    for (const child of mesh.children) {
      child.scale.setScalar(visualRatio);
    }
  }

  /**
   * Tints the square fill with the hover colour or the idle fill colour.
   *
   * @param mesh Square root.
   * @param isHovered Whether the square's faces are under resize hover.
   */
  squareHighlightApply(mesh: THREE.Object3D, isHovered: boolean): void {
    const fillColor = isHovered ? this.theme.boundsHandleHoverColor : this.theme.boundsHandleColor;
    for (const child of mesh.children) {
      if (child.userData[BOUNDS_SQUARE_FILL_KEY] !== true || !(child instanceof THREE.Mesh)) {
        continue;
      }
      const material = child.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.color.setHex(fillColor);
      }
    }
  }

  /**
   * Removes every child of a handle mesh (3D arrow visuals).
   *
   * @param mesh Handle mesh.
   */
  private childrenRemove(mesh: THREE.Mesh): void {
    while (mesh.children.length > 0) {
      const child = mesh.children[0];
      if (!child) {
        return;
      }
      mesh.remove(child);
    }
  }

  /**
   * Creates the white fill of a square. It carries no handle id, so only the
   * pick root answers handle picks.
   *
   * @returns Fill mesh.
   */
  private squareFillCreate(): THREE.Mesh {
    const fill = new THREE.Mesh(BoundsHandleSquareStyler.squarePlaneGeometryCreate(), this.squareFillMaterialCreate());
    fill.name = 'bounds_handle_square_fill';
    fill.renderOrder = BOUNDS_SQUARE_RENDER_ORDER;
    fill.userData[BOUNDS_SQUARE_FILL_KEY] = true;
    return fill;
  }

  /**
   * Creates the always-on-top idle fill material of a square.
   *
   * @returns Fill material in the theme's handle colour.
   */
  private squareFillMaterialCreate(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: this.theme.boundsHandleColor,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }

  /**
   * Creates the thin outline drawn around a square.
   *
   * @returns Outline line segments.
   */
  private squareOutlineCreate(): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(BOUNDS_SQUARE_OUTLINE_POSITIONS, 3));
    const material = new THREE.LineBasicMaterial({
      color: this.theme.boundsHandleOutlineColor,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const outline = new THREE.LineSegments(geometry, material);
    outline.name = 'bounds_handle_square_outline';
    outline.renderOrder = BOUNDS_SQUARE_RENDER_ORDER + 1;
    return outline;
  }
}
