import * as THREE from 'three';

/**
 * Smooth per-vertex normals of a displaced grid from central differences
 * between neighboring vertices, turned to the side the face normal points to.
 */
export class DisplacementMeshNormals {
  private static readonly scratchAlongColumn = new THREE.Vector3();
  private static readonly scratchAlongRow = new THREE.Vector3();
  private static readonly scratchNormal = new THREE.Vector3();

  /**
   * Computes interleaved XYZ normals for a row-major grid.
   *
   * @param positions Displaced positions, row-major.
   * @param rowLength Vertices per grid side.
   * @param faceNormal Unit normal of the flat face in the same space.
   * @returns Normal buffer with three floats per vertex.
   */
  static compute(positions: readonly THREE.Vector3[], rowLength: number, faceNormal: THREE.Vector3): Float32Array {
    const normals = new Float32Array(positions.length * 3);
    for (let row = 0; row < rowLength; row++) {
      for (let column = 0; column < rowLength; column++) {
        const normal = DisplacementMeshNormals.vertexNormal(positions, rowLength, row, column, faceNormal);
        normal.toArray(normals, (row * rowLength + column) * 3);
      }
    }
    return normals;
  }

  /**
   * Computes the normal of one grid vertex.
   *
   * @param positions Displaced positions, row-major.
   * @param rowLength Vertices per grid side.
   * @param row Vertex row.
   * @param column Vertex column.
   * @param faceNormal Unit normal of the flat face.
   * @returns Shared scratch vector holding the unit normal.
   */
  private static vertexNormal(
    positions: readonly THREE.Vector3[],
    rowLength: number,
    row: number,
    column: number,
    faceNormal: THREE.Vector3,
  ): THREE.Vector3 {
    const last = rowLength - 1;
    DisplacementMeshNormals.differenceWrite(
      positions[row * rowLength + Math.min(last, column + 1)],
      positions[row * rowLength + Math.max(0, column - 1)],
      DisplacementMeshNormals.scratchAlongColumn,
    );
    DisplacementMeshNormals.differenceWrite(
      positions[Math.min(last, row + 1) * rowLength + column],
      positions[Math.max(0, row - 1) * rowLength + column],
      DisplacementMeshNormals.scratchAlongRow,
    );
    const normal = DisplacementMeshNormals.scratchNormal.crossVectors(
      DisplacementMeshNormals.scratchAlongColumn,
      DisplacementMeshNormals.scratchAlongRow,
    );
    return DisplacementMeshNormals.orientToFace(normal, faceNormal);
  }

  /**
   * Writes the difference of two positions, zero when either is missing.
   *
   * @param ahead Position ahead along the axis.
   * @param behind Position behind along the axis.
   * @param target Vector receiving ahead minus behind.
   */
  private static differenceWrite(
    ahead: THREE.Vector3 | undefined,
    behind: THREE.Vector3 | undefined,
    target: THREE.Vector3,
  ): void {
    if (!ahead || !behind) {
      target.set(0, 0, 0);
      return;
    }
    target.subVectors(ahead, behind);
  }

  /**
   * Normalizes a normal and flips it to the face side, falling back to the face
   * normal when the neighborhood is degenerate.
   *
   * @param normal Unnormalized normal, changed in place.
   * @param faceNormal Unit normal of the flat face.
   * @returns The normal vector.
   */
  private static orientToFace(normal: THREE.Vector3, faceNormal: THREE.Vector3): THREE.Vector3 {
    if (normal.lengthSq() < 1e-20) {
      return normal.copy(faceNormal);
    }
    normal.normalize();
    if (normal.dot(faceNormal) < 0) {
      normal.negate();
    }
    return normal;
  }
}
