import type * as THREE from 'three';
import { LightmapTriangleSoupReader } from '@/io/glb/lightmap/lightmap_triangle_soup.js';
import { type LightmapChartSize, LightmapUvChartPacker } from '@/io/glb/lightmap/lightmap_uv_chart_packer.js';
import { LightmapUvChartGrouper } from '@/io/glb/lightmap/lightmap_uv_chart_grouper.js';
import { LightmapUvChartProjector } from '@/io/glb/lightmap/lightmap_uv_chart_projector.js';
import { LightmapUvGeometryWriter } from '@/io/glb/lightmap/lightmap_uv_geometry_writer.js';

/**
 * Lightmap texels per meter the padding is sized for; matches a coarse preview
 * bake.
 */
const LIGHTMAP_ASSUMED_TEXELS_PER_METER = 32;

/** Largest lightmap side, in texels, the padding is sized for. */
const LIGHTMAP_ASSUMED_MAX_SIZE = 2048;

/** Texels kept free between charts so bilinear filtering never mixes two charts. */
const LIGHTMAP_PADDING_TEXELS = 2;

/**
 * Lays out a second UV set for baked lighting: every flat region of a mesh gets
 * its own chart at the same texel density, packed into the unit square without
 * overlap.
 */
export class LightmapUvLayout {
  /**
   * Returns a copy of the mesh's geometry with a `uv1` lightmap attribute.
   *
   * @param mesh Mesh whose world size decides the chart sizes.
   * @returns New geometry, or the mesh's own geometry when it has no triangles.
   */
  static geometryWithLightmapUvs(mesh: THREE.Mesh): THREE.BufferGeometry {
    mesh.updateWorldMatrix(true, false);
    const soup = LightmapTriangleSoupReader.read(mesh.geometry, mesh.matrixWorld);
    if (!soup) {
      return mesh.geometry;
    }
    const charts = LightmapUvChartGrouper.group(soup).map((triangles) =>
      LightmapUvChartProjector.project(soup, triangles),
    );
    const packing = LightmapUvChartPacker.pack(charts, LightmapUvLayout.paddingChoose(charts));
    return LightmapUvGeometryWriter.write(mesh.geometry, soup.corners, soup.vertexCount, charts, packing);
  }

  /**
   * Returns the gap between charts in meters: a few texels at the density the
   * game is expected to bake, growing when the lightmap size limit makes texels
   * larger.
   *
   * @param charts Chart sizes.
   * @returns Padding in meters.
   */
  static paddingChoose(charts: readonly LightmapChartSize[]): number {
    const area = charts.reduce((total, chart) => total + chart.width * chart.height, 0);
    const texelSize = Math.max(1 / LIGHTMAP_ASSUMED_TEXELS_PER_METER, Math.sqrt(area) / LIGHTMAP_ASSUMED_MAX_SIZE);
    return texelSize * LIGHTMAP_PADDING_TEXELS;
  }
}
