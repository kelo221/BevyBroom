import type { LightmapTriangleSoup } from '@/io/glb/lightmap/lightmap_triangle_soup.js';

/** Smallest normal dot product of two triangles that count as coplanar. */
const LIGHTMAP_COPLANAR_NORMAL_DOT = 0.9999;

/**
 * Largest plane offset difference, in meters, of two triangles that count as
 * coplanar.
 */
const LIGHTMAP_COPLANAR_OFFSET_TOLERANCE = 1e-4;

/** Positions are rounded to this many steps per meter to find shared edges. */
const LIGHTMAP_EDGE_KEY_STEPS_PER_METER = 1e4;

/**
 * Groups the triangles of a soup into charts: sets of coplanar triangles
 * connected through shared edges. Each chart is later unwrapped flat.
 */
export class LightmapUvChartGrouper {
  private readonly soup: LightmapTriangleSoup;
  private readonly parents: Int32Array;

  /**
   * Prepares grouping of one soup.
   *
   * @param soup Triangles to group.
   */
  private constructor(soup: LightmapTriangleSoup) {
    this.soup = soup;
    this.parents = new Int32Array(soup.triangleCount).map((_, index) => index);
  }

  /**
   * Returns the charts of a soup as lists of triangle indices.
   *
   * @param soup Triangles to group.
   * @returns Charts in order of their first triangle.
   */
  static group(soup: LightmapTriangleSoup): number[][] {
    const grouper = new LightmapUvChartGrouper(soup);
    grouper.edgesJoin();
    return grouper.chartsCollect();
  }

  /** Joins coplanar triangles that share an edge. */
  private edgesJoin(): void {
    const trianglesByEdge = new Map<string, number[]>();
    for (let triangle = 0; triangle < this.soup.triangleCount; triangle++) {
      for (let side = 0; side < 3; side++) {
        this.edgeJoin(trianglesByEdge, this.edgeKey(triangle, side), triangle);
      }
    }
  }

  /**
   * Joins a triangle with every coplanar triangle already seen on one edge.
   *
   * @param trianglesByEdge Triangles seen per edge key.
   * @param key Edge key.
   * @param triangle Triangle index.
   */
  private edgeJoin(trianglesByEdge: Map<string, number[]>, key: string, triangle: number): void {
    const seen = trianglesByEdge.get(key);
    if (!seen) {
      trianglesByEdge.set(key, [triangle]);
      return;
    }
    for (const other of seen) {
      if (this.coplanarAre(triangle, other)) {
        this.union(triangle, other);
      }
    }
    seen.push(triangle);
  }

  /**
   * Returns an order independent key of one triangle edge.
   *
   * @param triangle Triangle index.
   * @param side Edge 0, 1 or 2.
   * @returns Key of the rounded endpoint positions.
   */
  private edgeKey(triangle: number, side: number): string {
    const first = this.vertexKey(this.soup.corners[triangle * 3 + side] ?? 0);
    const second = this.vertexKey(this.soup.corners[triangle * 3 + ((side + 1) % 3)] ?? 0);
    return first < second ? `${first}/${second}` : `${second}/${first}`;
  }

  /**
   * Returns the rounded position key of a vertex.
   *
   * @param vertex Source vertex index.
   * @returns Key string.
   */
  private vertexKey(vertex: number): string {
    const positions = this.soup.positions;
    const round = (value: number): number => Math.round(value * LIGHTMAP_EDGE_KEY_STEPS_PER_METER);
    return `${round(positions[vertex * 3] ?? 0)},${round(positions[vertex * 3 + 1] ?? 0)},${round(positions[vertex * 3 + 2] ?? 0)}`;
  }

  /**
   * Returns whether two triangles lie in the same plane facing the same way.
   *
   * @param first First triangle.
   * @param second Second triangle.
   * @returns True when coplanar.
   */
  private coplanarAre(first: number, second: number): boolean {
    const normals = this.soup.normals;
    let dot = 0;
    for (let axis = 0; axis < 3; axis++) {
      dot += (normals[first * 3 + axis] ?? 0) * (normals[second * 3 + axis] ?? 0);
    }
    const offsetDifference = Math.abs((this.soup.planeOffsets[first] ?? 0) - (this.soup.planeOffsets[second] ?? 0));
    return dot >= LIGHTMAP_COPLANAR_NORMAL_DOT && offsetDifference <= LIGHTMAP_COPLANAR_OFFSET_TOLERANCE;
  }

  /**
   * Returns the representative triangle of a set, compressing the path.
   *
   * @param triangle Triangle index.
   * @returns Representative triangle index.
   */
  private find(triangle: number): number {
    let root = triangle;
    while ((this.parents[root] ?? root) !== root) {
      root = this.parents[root] ?? root;
    }
    let current = triangle;
    while (current !== root) {
      const next = this.parents[current] ?? root;
      this.parents[current] = root;
      current = next;
    }
    return root;
  }

  /**
   * Merges the sets of two triangles.
   *
   * @param first First triangle.
   * @param second Second triangle.
   */
  private union(first: number, second: number): void {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot !== secondRoot) {
      this.parents[Math.max(firstRoot, secondRoot)] = Math.min(firstRoot, secondRoot);
    }
  }

  /**
   * Lists the triangles of every set.
   *
   * @returns Charts in order of their first triangle.
   */
  private chartsCollect(): number[][] {
    const chartsByRoot = new Map<number, number[]>();
    for (let triangle = 0; triangle < this.soup.triangleCount; triangle++) {
      const root = this.find(triangle);
      const chart = chartsByRoot.get(root);
      if (chart) {
        chart.push(triangle);
      } else {
        chartsByRoot.set(root, [triangle]);
      }
    }
    return [...chartsByRoot.values()];
  }
}
