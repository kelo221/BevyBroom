import * as THREE from 'three';
import { type LightmapTriangleSoup, LightmapTriangleSoupReader } from '@/io/glb/lightmap/lightmap_triangle_soup.js';

/**
 * One flat chart: its triangles and a 2D position in meters for each of their
 * corners, with the chart's bounds starting at zero.
 */
export interface LightmapUvChart {
  readonly triangles: readonly number[];
  /** Two numbers per corner, six per triangle, in the order of `triangles`. */
  readonly cornerUvs: Float32Array;
  readonly width: number;
  readonly height: number;
}

/** Most triangle edges tried as the chart's horizontal axis. */
const LIGHTMAP_AXIS_CANDIDATE_LIMIT = 48;

/** Axes of one chart plane. */
interface LightmapChartAxes {
  readonly horizontal: THREE.Vector3;
  readonly vertical: THREE.Vector3;
}

/**
 * Unwraps a chart of coplanar triangles flat by projecting it onto its plane,
 * turning it so its bounding rectangle is as small as possible and wider than
 * tall.
 */
export class LightmapUvChartProjector {
  /**
   * Projects one chart.
   *
   * @param soup Triangles of the mesh.
   * @param triangles Triangle indices of the chart.
   * @returns The flat chart.
   */
  static project(soup: LightmapTriangleSoup, triangles: readonly number[]): LightmapUvChart {
    const normal = new THREE.Vector3().fromArray(soup.normals, (triangles[0] ?? 0) * 3);
    const axes = LightmapUvChartProjector.axesBest(soup, triangles, normal);
    const cornerUvs = LightmapUvChartProjector.cornersProject(soup, triangles, axes);
    const bounds = LightmapUvChartProjector.boundsMove(cornerUvs);
    if (bounds.y > bounds.x) {
      LightmapUvChartProjector.quarterTurn(cornerUvs, bounds.y);
      return { triangles, cornerUvs, width: bounds.y, height: bounds.x };
    }
    return { triangles, cornerUvs, width: bounds.x, height: bounds.y };
  }

  /**
   * Picks the in-plane axes whose bounding rectangle has the smallest area,
   * trying the chart's edge directions.
   *
   * @param soup Triangles of the mesh.
   * @param triangles Triangle indices of the chart.
   * @param normal Chart normal.
   * @returns Best axes.
   */
  private static axesBest(
    soup: LightmapTriangleSoup,
    triangles: readonly number[],
    normal: THREE.Vector3,
  ): LightmapChartAxes {
    let best = LightmapUvChartProjector.axesFallback(normal);
    let bestArea = LightmapUvChartProjector.boundsArea(soup, triangles, best);
    for (const candidate of LightmapUvChartProjector.edgeDirections(soup, triangles, normal)) {
      const axes = { horizontal: candidate, vertical: new THREE.Vector3().crossVectors(normal, candidate) };
      const area = LightmapUvChartProjector.boundsArea(soup, triangles, axes);
      if (area < bestArea - 1e-9) {
        best = axes;
        bestArea = area;
      }
    }
    return best;
  }

  /**
   * Returns axes perpendicular to a normal, used before any edge is tried.
   *
   * @param normal Chart normal.
   * @returns Axes in the chart plane.
   */
  private static axesFallback(normal: THREE.Vector3): LightmapChartAxes {
    const reference = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const horizontal = new THREE.Vector3().crossVectors(reference, normal).normalize();
    if (horizontal.lengthSq() === 0) {
      horizontal.set(1, 0, 0);
    }
    return { horizontal, vertical: new THREE.Vector3().crossVectors(normal, horizontal) };
  }

  /**
   * Returns unit edge directions of the chart projected into its plane.
   *
   * @param soup Triangles of the mesh.
   * @param triangles Triangle indices of the chart.
   * @param normal Chart normal.
   * @returns Up to the candidate limit of directions.
   */
  private static edgeDirections(
    soup: LightmapTriangleSoup,
    triangles: readonly number[],
    normal: THREE.Vector3,
  ): THREE.Vector3[] {
    const directions: THREE.Vector3[] = [];
    const start = new THREE.Vector3();
    for (const triangle of triangles) {
      for (let side = 0; side < 3 && directions.length < LIGHTMAP_AXIS_CANDIDATE_LIMIT; side++) {
        LightmapTriangleSoupReader.pointRead(soup.positions, soup.corners[triangle * 3 + side] ?? 0, start);
        const end = LightmapTriangleSoupReader.pointRead(
          soup.positions,
          soup.corners[triangle * 3 + ((side + 1) % 3)] ?? 0,
          new THREE.Vector3(),
        );
        const direction = end.sub(start).projectOnPlane(normal);
        if (direction.lengthSq() > 1e-12) {
          directions.push(direction.normalize());
        }
      }
    }
    return directions;
  }

  /**
   * Returns the area of the chart's bounding rectangle along some axes.
   *
   * @param soup Triangles of the mesh.
   * @param triangles Triangle indices of the chart.
   * @param axes Axes to measure along.
   * @returns Rectangle area in square meters.
   */
  private static boundsArea(soup: LightmapTriangleSoup, triangles: readonly number[], axes: LightmapChartAxes): number {
    const cornerUvs = LightmapUvChartProjector.cornersProject(soup, triangles, axes);
    const bounds = LightmapUvChartProjector.boundsMove(cornerUvs);
    return bounds.x * bounds.y;
  }

  /**
   * Projects every corner of the chart onto the axes.
   *
   * @param soup Triangles of the mesh.
   * @param triangles Triangle indices of the chart.
   * @param axes Axes to project onto.
   * @returns Two numbers per corner.
   */
  private static cornersProject(
    soup: LightmapTriangleSoup,
    triangles: readonly number[],
    axes: LightmapChartAxes,
  ): Float32Array {
    const cornerUvs = new Float32Array(triangles.length * 6);
    const point = new THREE.Vector3();
    triangles.forEach((triangle, chartTriangle) => {
      for (let corner = 0; corner < 3; corner++) {
        LightmapTriangleSoupReader.pointRead(soup.positions, soup.corners[triangle * 3 + corner] ?? 0, point);
        cornerUvs[chartTriangle * 6 + corner * 2] = point.dot(axes.horizontal);
        cornerUvs[chartTriangle * 6 + corner * 2 + 1] = point.dot(axes.vertical);
      }
    });
    return cornerUvs;
  }

  /**
   * Moves 2D points so their bounds start at zero.
   *
   * @param cornerUvs Two numbers per point; changed in place.
   * @returns Width (x) and height (y) of the bounds.
   */
  private static boundsMove(cornerUvs: Float32Array): THREE.Vector2 {
    const minimum = new THREE.Vector2(Infinity, Infinity);
    const maximum = new THREE.Vector2(-Infinity, -Infinity);
    for (let index = 0; index < cornerUvs.length; index += 2) {
      minimum.min(new THREE.Vector2(cornerUvs[index] ?? 0, cornerUvs[index + 1] ?? 0));
      maximum.max(new THREE.Vector2(cornerUvs[index] ?? 0, cornerUvs[index + 1] ?? 0));
    }
    for (let index = 0; index < cornerUvs.length; index += 2) {
      cornerUvs[index] = (cornerUvs[index] ?? 0) - minimum.x;
      cornerUvs[index + 1] = (cornerUvs[index + 1] ?? 0) - minimum.y;
    }
    return maximum.sub(minimum);
  }

  /**
   * Turns 2D points a quarter turn, keeping them in positive coordinates and
   * keeping the winding of every triangle.
   *
   * @param cornerUvs Two numbers per point, bounds starting at zero; changed in
   *   place.
   * @param height Height of the bounds before turning.
   */
  private static quarterTurn(cornerUvs: Float32Array, height: number): void {
    for (let index = 0; index < cornerUvs.length; index += 2) {
      const horizontal = cornerUvs[index] ?? 0;
      cornerUvs[index] = height - (cornerUvs[index + 1] ?? 0);
      cornerUvs[index + 1] = horizontal;
    }
  }
}
