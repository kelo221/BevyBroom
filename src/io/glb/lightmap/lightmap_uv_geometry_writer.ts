import * as THREE from 'three';
import type { LightmapChartPacking } from '@/io/glb/lightmap/lightmap_uv_chart_packer.js';
import type { LightmapUvChart } from '@/io/glb/lightmap/lightmap_uv_chart_projector.js';

/** Name of the lightmap UV attribute; GLTFExporter writes it as TEXCOORD_1. */
export const LIGHTMAP_UV_ATTRIBUTE_NAME = 'uv1';

/**
 * New vertices (the source vertex each copies and its lightmap coordinate) and
 * the new corner indices.
 */
interface LightmapSplitVertices {
  readonly sourceVertices: number[];
  readonly lightmapUvs: number[];
  readonly corners: Uint32Array;
}

/** One chart corner being resolved to a new vertex. */
interface LightmapCornerContext {
  readonly chart: LightmapUvChart;
  readonly chartIndex: number;
  readonly chartTriangle: number;
  readonly corner: number;
  readonly sourceCorners: Uint32Array;
  readonly vertexCount: number;
  readonly packing: LightmapChartPacking;
}

/**
 * Writes packed charts into a copy of a geometry. A source vertex used by
 * several charts is split into one vertex per chart, so every chart keeps its
 * own lightmap coordinates; triangle order, material groups and every other
 * attribute are kept.
 */
export class LightmapUvGeometryWriter {
  /**
   * Builds the geometry copy with lightmap coordinates.
   *
   * @param source Source geometry.
   * @param sourceCorners Source vertex per triangle corner.
   * @param vertexCount Number of source vertices.
   * @param charts Projected charts.
   * @param packing Chart offsets and scale.
   * @returns Indexed geometry copy with a `uv1` attribute.
   */
  static write(
    source: THREE.BufferGeometry,
    sourceCorners: Uint32Array,
    vertexCount: number,
    charts: readonly LightmapUvChart[],
    packing: LightmapChartPacking,
  ): THREE.BufferGeometry {
    const split = LightmapUvGeometryWriter.verticesSplit(sourceCorners, vertexCount, charts, packing);
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      geometry.setAttribute(name, LightmapUvGeometryWriter.attributeGather(attribute, split.sourceVertices));
    }
    geometry.setAttribute(LIGHTMAP_UV_ATTRIBUTE_NAME, new THREE.Float32BufferAttribute(split.lightmapUvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(split.corners, 1));
    for (const group of source.groups) {
      geometry.addGroup(group.start, group.count, group.materialIndex);
    }
    geometry.name = source.name;
    return geometry;
  }

  /**
   * Assigns one new vertex per used pair of source vertex and chart.
   *
   * @param sourceCorners Source vertex per triangle corner.
   * @param vertexCount Number of source vertices.
   * @param charts Projected charts.
   * @param packing Chart offsets and scale.
   * @returns New vertices and corner indices in source triangle order.
   */
  private static verticesSplit(
    sourceCorners: Uint32Array,
    vertexCount: number,
    charts: readonly LightmapUvChart[],
    packing: LightmapChartPacking,
  ): LightmapSplitVertices {
    const result: LightmapSplitVertices = {
      sourceVertices: [],
      lightmapUvs: [],
      corners: new Uint32Array(sourceCorners.length),
    };
    const newVertexByKey = new Map<number, number>();
    charts.forEach((chart, chartIndex) => {
      chart.triangles.forEach((triangle, chartTriangle) => {
        for (let corner = 0; corner < 3; corner++) {
          const context = { chart, chartIndex, chartTriangle, corner, sourceCorners, vertexCount, packing };
          result.corners[triangle * 3 + corner] = LightmapUvGeometryWriter.vertexResolve(
            context,
            newVertexByKey,
            result,
          );
        }
      });
    });
    return result;
  }

  /**
   * Returns the new vertex of one chart corner, creating it on first use.
   *
   * @param context Chart, corner position and packing of the corner.
   * @param newVertexByKey New vertex per source vertex and chart pair.
   * @param result Receives created vertices.
   * @returns New vertex index.
   */
  private static vertexResolve(
    context: LightmapCornerContext,
    newVertexByKey: Map<number, number>,
    result: LightmapSplitVertices,
  ): number {
    const triangle = context.chart.triangles[context.chartTriangle] ?? 0;
    const sourceVertex = context.sourceCorners[triangle * 3 + context.corner] ?? 0;
    const key = context.chartIndex * context.vertexCount + sourceVertex;
    const existing = newVertexByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created = result.sourceVertices.length;
    newVertexByKey.set(key, created);
    result.sourceVertices.push(sourceVertex);
    LightmapUvGeometryWriter.lightmapUvAppend(context, result.lightmapUvs);
    return created;
  }

  /**
   * Appends the packed 0..1 lightmap coordinate of one chart corner.
   *
   * @param context Chart, corner position and packing of the corner.
   * @param lightmapUvs Receives two numbers.
   */
  private static lightmapUvAppend(context: LightmapCornerContext, lightmapUvs: number[]): void {
    const uvIndex = (context.chartTriangle * 3 + context.corner) * 2;
    const offsets = context.packing.offsets;
    const scale = context.packing.scale;
    lightmapUvs.push(
      ((offsets[context.chartIndex * 2] ?? 0) + (context.chart.cornerUvs[uvIndex] ?? 0)) * scale,
      ((offsets[context.chartIndex * 2 + 1] ?? 0) + (context.chart.cornerUvs[uvIndex + 1] ?? 0)) * scale,
    );
  }

  /**
   * Copies an attribute's values for a list of source vertices.
   *
   * @param attribute Source attribute.
   * @param sourceVertices Source vertex per new vertex.
   * @returns New float attribute of the same item size holding the denormalized
   *   values.
   */
  private static attributeGather(
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    sourceVertices: readonly number[],
  ): THREE.BufferAttribute {
    const itemSize = attribute.itemSize;
    const values = new Float32Array(sourceVertices.length * itemSize);
    sourceVertices.forEach((sourceVertex, newVertex) => {
      for (let component = 0; component < itemSize; component++) {
        values[newVertex * itemSize + component] = attribute.getComponent(sourceVertex, component);
      }
    });
    return new THREE.BufferAttribute(values, itemSize);
  }
}
