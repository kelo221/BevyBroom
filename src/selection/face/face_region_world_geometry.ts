import * as THREE from 'three';
import {
  computeTriangleNormal,
  getTriangleCount,
  getTriangleVertexIndices,
  getVertexPosition,
} from '@/selection/pick/utils_triangle_geometry.js';
import { displacementFaceRegionRead } from '@/displacement/pick/displacement_face_region.js';

/**
 * World-space shape of a selected face region. Regions of displaced brush faces
 * are described by the flat brush face (normal, corners, center) and by the
 * displacement surface (overlay triangles) instead of the result triangles,
 * which carry no area for displaced faces.
 */
export class FaceRegionWorldGeometry {
  /**
   * Returns the unit world normal of a region.
   *
   * @param mesh Mesh owning the region.
   * @param triangleIndices Region triangles.
   * @returns Unit world normal; +Y when the region has no usable triangle.
   */
  static normalWorld(mesh: THREE.Mesh, triangleIndices: readonly number[]): THREE.Vector3 {
    const displaced = displacementFaceRegionRead(mesh, triangleIndices);
    return displaced ? displaced.normal : FaceRegionWorldGeometry.triangleNormalAverage(mesh, triangleIndices);
  }

  /**
   * Returns world corner positions describing a region's flat outline.
   *
   * @param mesh Mesh owning the region.
   * @param triangleIndices Region triangles.
   * @returns Flat brush face corners for displaced faces, otherwise every
   *   triangle corner (three per triangle).
   */
  static cornersWorld(mesh: THREE.Mesh, triangleIndices: readonly number[]): THREE.Vector3[] {
    const displaced = displacementFaceRegionRead(mesh, triangleIndices);
    return displaced ? displaced.corners : FaceRegionWorldGeometry.meshTrianglesWorld(mesh, triangleIndices);
  }

  /**
   * Returns the world center of a region.
   *
   * @param mesh Mesh owning the region.
   * @param triangleIndices Region triangles.
   * @returns Mean of the region corners, or the origin for an empty region.
   */
  static centerWorld(mesh: THREE.Mesh, triangleIndices: readonly number[]): THREE.Vector3 {
    const corners = FaceRegionWorldGeometry.cornersWorld(mesh, triangleIndices);
    const sum = corners.reduce((total, corner) => total.add(corner), new THREE.Vector3());
    return corners.length === 0 ? sum : sum.multiplyScalar(1 / corners.length);
  }

  /**
   * Returns the world triangles a selection overlay draws for a region.
   *
   * @param mesh Mesh owning the region.
   * @param triangleIndices Region triangles.
   * @returns Corner positions, three per triangle: the displacement surface for
   *   displaced faces, otherwise the region triangles.
   */
  static overlayTrianglesWorld(mesh: THREE.Mesh, triangleIndices: readonly number[]): THREE.Vector3[] {
    const displaced = displacementFaceRegionRead(mesh, triangleIndices);
    if (!displaced) {
      return FaceRegionWorldGeometry.meshTrianglesWorld(mesh, triangleIndices);
    }
    if (!displaced.surfaceMesh) {
      return FaceRegionWorldGeometry.polygonFanTriangles(displaced.corners);
    }
    const surfaceGeometry = displaced.surfaceMesh.geometry;
    const allTriangles = Array.from({ length: getTriangleCount(surfaceGeometry) }, (_unused, index) => index);
    return FaceRegionWorldGeometry.meshTrianglesWorld(displaced.surfaceMesh, allTriangles);
  }

  /**
   * Returns an identity that changes whenever the overlay of a region changes
   * shape.
   *
   * @param mesh Mesh owning the region.
   * @param triangleIndices Region triangles.
   * @returns Geometry identity of the displacement surface for displaced faces,
   *   otherwise of the mesh.
   */
  static overlaySourceIdRead(mesh: THREE.Mesh, triangleIndices: readonly number[]): string {
    const surfaceMesh = displacementFaceRegionRead(mesh, triangleIndices)?.surfaceMesh;
    return surfaceMesh ? surfaceMesh.geometry.uuid : mesh.geometry.uuid;
  }

  /**
   * Averages the world normals of the region triangles.
   *
   * @param mesh Mesh owning the region.
   * @param triangleIndices Region triangles.
   * @returns Unit world normal; +Y when the normals cancel or are degenerate.
   */
  private static triangleNormalAverage(mesh: THREE.Mesh, triangleIndices: readonly number[]): THREE.Vector3 {
    mesh.updateMatrixWorld(true);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const accumulator = new THREE.Vector3();
    triangleIndices.forEach((triangleIndex) => {
      accumulator.add(computeTriangleNormal(mesh.geometry, triangleIndex).applyMatrix3(normalMatrix).normalize());
    });
    if (accumulator.lengthSq() < 1e-12) {
      return new THREE.Vector3(0, 1, 0);
    }
    return accumulator.normalize();
  }

  /**
   * Lists the world corners of mesh triangles, three per triangle.
   *
   * @param mesh Mesh owning the triangles.
   * @param triangleIndices Triangles to list.
   * @returns World corner positions.
   */
  private static meshTrianglesWorld(mesh: THREE.Mesh, triangleIndices: readonly number[]): THREE.Vector3[] {
    const position = mesh.geometry.getAttribute('position');
    if (!position) {
      return [];
    }
    mesh.updateMatrixWorld(true);
    return triangleIndices.flatMap((triangleIndex) =>
      getTriangleVertexIndices(mesh.geometry, triangleIndex).map((vertexIndex) =>
        getVertexPosition(position, vertexIndex).applyMatrix4(mesh.matrixWorld),
      ),
    );
  }

  /**
   * Splits a convex polygon into a triangle fan.
   *
   * @param corners Polygon corners in winding order.
   * @returns Corner positions, three per triangle.
   */
  private static polygonFanTriangles(corners: readonly THREE.Vector3[]): THREE.Vector3[] {
    const first = corners[0];
    if (!first) {
      return [];
    }
    return corners.slice(1, -1).flatMap((corner, index) => [first, corner, corners[index + 2] ?? corner]);
  }
}
