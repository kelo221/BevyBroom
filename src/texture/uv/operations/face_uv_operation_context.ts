import * as THREE from 'three';
import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';

/** Texture image size in pixels. */
export interface FaceUvTextureSizePixels {
  width: number;
  height: number;
}

/** Options accepted when constructing a face UV operation context. */
export interface FaceUvOperationContextOptions {
  /** Face polygon vertices in winding order (world space). */
  vertices: THREE.Vector3[];
  /** Unit face normal in world space. */
  faceNormal: THREE.Vector3;
  /** Optional texture image size in pixels. */
  textureSizePixels?: FaceUvTextureSizePixels;
  /** Optional camera right direction for camera-relative operations. */
  cameraRight?: THREE.Vector3;
  /** Optional camera up direction for camera-relative tie-breaks. */
  cameraUp?: THREE.Vector3;
}

/** U and V coordinate pair. */
export interface FaceUvPoint {
  u: number;
  v: number;
}

/** Min/max UV coordinates a face covers under a matrix. */
export interface FaceUvBounds {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

/**
 * Immutable world-space description of one face polygon that UV operations
 * evaluate against: vertices in winding order, the face normal, and optional
 * texture size and camera directions.
 */
export class FaceUvOperationContext {
  readonly vertices: readonly THREE.Vector3[];
  readonly faceNormal: THREE.Vector3;
  readonly textureSizePixels: FaceUvTextureSizePixels | undefined;
  readonly cameraRight: THREE.Vector3 | undefined;
  readonly cameraUp: THREE.Vector3 | undefined;

  /**
   * Creates a face UV operation context from polygon data.
   *
   * @param options Vertices, normal, and optional texture/camera data. All
   *   vectors are cloned so later external mutation cannot affect operations.
   */
  constructor(options: FaceUvOperationContextOptions) {
    this.vertices = options.vertices.map((vertex) => vertex.clone());
    this.faceNormal = options.faceNormal.clone().normalize();
    this.textureSizePixels = options.textureSizePixels ? { ...options.textureSizePixels } : undefined;
    this.cameraRight = options.cameraRight?.clone();
    this.cameraUp = options.cameraUp?.clone();
  }

  /**
   * Returns the number of polygon vertices.
   *
   * @returns Vertex count.
   */
  vertexCount(): number {
    return this.vertices.length;
  }

  /**
   * Returns one polygon vertex as an independent copy.
   *
   * @param index Vertex index.
   * @returns Cloned vertex, or undefined when out of range.
   */
  vertexWorldAt(index: number): THREE.Vector3 | undefined {
    return this.vertices[index]?.clone();
  }

  /**
   * Projects every polygon vertex through a UV matrix.
   *
   * @param matrix Surface UV matrix to evaluate.
   * @returns UV pair per vertex, in vertex order.
   */
  vertexUvs(matrix: SurfaceUvMatrix): FaceUvPoint[] {
    return this.vertices.map((vertex) => {
      const projected = matrix.project(vertex);
      return { u: projected.u, v: projected.v };
    });
  }

  /**
   * Measures the UV-space axis-aligned bounds of the face polygon under a
   * matrix.
   *
   * @param matrix Surface UV matrix to evaluate.
   * @returns Bounds spanning every projected vertex. An empty polygon returns
   *   zeros.
   */
  uvBounds(matrix: SurfaceUvMatrix): FaceUvBounds {
    const uvs = this.vertexUvs(matrix);
    const first = uvs[0];
    if (!first) {
      return { minU: 0, maxU: 0, minV: 0, maxV: 0 };
    }
    return uvs.reduce<FaceUvBounds>(
      (bounds, uv) => ({
        minU: Math.min(bounds.minU, uv.u),
        maxU: Math.max(bounds.maxU, uv.u),
        minV: Math.min(bounds.minV, uv.v),
        maxV: Math.max(bounds.maxV, uv.v),
      }),
      { minU: first.u, maxU: first.u, minV: first.v, maxV: first.v },
    );
  }

  /**
   * Measures the center of the face's UV bounds under a matrix.
   *
   * @param matrix Surface UV matrix to evaluate.
   * @returns Midpoint of the UV bounds.
   */
  uvBoundsCenter(matrix: SurfaceUvMatrix): FaceUvPoint {
    const bounds = this.uvBounds(matrix);
    return { u: (bounds.minU + bounds.maxU) / 2, v: (bounds.minV + bounds.maxV) / 2 };
  }

  /**
   * Computes the average of the polygon vertices.
   *
   * @returns World-space centroid.
   */
  worldCentroid(): THREE.Vector3 {
    const centroid = new THREE.Vector3();
    this.vertices.forEach((vertex) => centroid.add(vertex));
    centroid.divideScalar(Math.max(1, this.vertices.length));
    return centroid;
  }

  /**
   * Projects the world centroid of the polygon through a UV matrix.
   *
   * @param matrix Surface UV matrix to evaluate.
   * @returns UV pair of the centroid.
   */
  worldCentroidUv(matrix: SurfaceUvMatrix): FaceUvPoint {
    const projected = matrix.project(this.worldCentroid());
    return { u: projected.u, v: projected.v };
  }

  /**
   * Returns the number of polygon edges.
   *
   * @returns Edge count (equal to vertex count).
   */
  faceEdgeCount(): number {
    return this.vertices.length;
  }

  /**
   * Computes one polygon edge direction, from vertex i to the following vertex
   * in winding order.
   *
   * @param edgeIndex Edge index; wraps around the polygon.
   * @returns Edge direction vector, or null when the polygon has no edges.
   */
  faceEdgeWorldDirection(edgeIndex: number): THREE.Vector3 | null {
    if (this.vertices.length === 0) {
      return null;
    }
    const count = this.vertices.length;
    const from = this.vertices[((edgeIndex % count) + count) % count];
    const to = this.vertices[(((edgeIndex + 1) % count) + count) % count];
    if (!from || !to) {
      return null;
    }
    return to.clone().sub(from);
  }

  /**
   * Projects every polygon edge direction into UV space under a matrix.
   *
   * @param matrix Surface UV matrix to evaluate.
   * @returns UV direction per edge (unnormalized), in edge order.
   */
  faceEdgeUvDirections(matrix: SurfaceUvMatrix): FaceUvPoint[] {
    const uvs = this.vertexUvs(matrix);
    return uvs.map((uv, index) => {
      const next = uvs[(index + 1) % uvs.length];
      if (!next) {
        return { u: 0, v: 0 };
      }
      return { u: next.u - uv.u, v: next.v - uv.v };
    });
  }
}
