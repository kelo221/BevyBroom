import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { LightmapUvChartPacker } from '@/io/glb/lightmap/lightmap_uv_chart_packer.js';
import { LIGHTMAP_UV_ATTRIBUTE_NAME } from '@/io/glb/lightmap/lightmap_uv_geometry_writer.js';
import { LightmapUvLayout } from '@/io/glb/lightmap/lightmap_uv_layout.js';
import { glbJsonRead } from '../glb_json_read.js';

/** One lightmap triangle with its world area. */
interface LightmapTriangle {
  readonly uv: [THREE.Vector2, THREE.Vector2, THREE.Vector2];
  readonly worldArea: number;
}

/**
 * Reads every triangle's lightmap coordinates and world area.
 *
 * @param geometry Geometry with `position`, `uv1` and an index.
 * @returns Triangles in index order.
 */
function lightmapTrianglesRead(geometry: THREE.BufferGeometry): LightmapTriangle[] {
  const index = geometry.getIndex();
  const uv1 = geometry.getAttribute(LIGHTMAP_UV_ATTRIBUTE_NAME) as THREE.BufferAttribute;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const triangles: LightmapTriangle[] = [];
  for (let corner = 0; index && corner < index.count; corner += 3) {
    const vertices = [index.getX(corner), index.getX(corner + 1), index.getX(corner + 2)];
    const uv = vertices.map((vertex) => new THREE.Vector2().fromBufferAttribute(uv1, vertex));
    const points = vertices.map((vertex) => new THREE.Vector3().fromBufferAttribute(position, vertex));
    const [a, b, c] = points as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const worldArea = new THREE.Triangle(a, b, c).getArea();
    triangles.push({ uv: uv as [THREE.Vector2, THREE.Vector2, THREE.Vector2], worldArea });
  }
  return triangles;
}

/**
 * Returns the signed area of a 2D triangle.
 *
 * @param triangle Corner coordinates.
 * @returns Signed area.
 */
function uvArea(triangle: readonly THREE.Vector2[]): number {
  const [a, b, c] = triangle as [THREE.Vector2, THREE.Vector2, THREE.Vector2];
  return ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

/**
 * Returns whether two 2D triangles overlap in more than a shared edge or
 * corner, by testing sample points inside each against the other.
 *
 * @param first First triangle.
 * @param second Second triangle.
 * @returns True when their interiors intersect.
 */
function uvTrianglesOverlap(first: readonly THREE.Vector2[], second: readonly THREE.Vector2[]): boolean {
  const toTriangle = (points: readonly THREE.Vector2[]): THREE.Triangle =>
    new THREE.Triangle(
      ...(points.map((point) => new THREE.Vector3(point.x, point.y, 0)) as [
        THREE.Vector3,
        THREE.Vector3,
        THREE.Vector3,
      ]),
    );
  const firstTriangle = toTriangle(first);
  const secondTriangle = toTriangle(second);
  const weights = [0.2, 0.35, 0.5, 0.65];
  const samples = (triangle: THREE.Triangle): THREE.Vector3[] =>
    weights.flatMap((u) =>
      weights
        .filter((v) => u + v < 0.95)
        .map((v) =>
          new THREE.Vector3()
            .addScaledVector(triangle.a, 1 - u - v)
            .addScaledVector(triangle.b, u)
            .addScaledVector(triangle.c, v),
        ),
    );
  return (
    samples(firstTriangle).some((point) => secondTriangle.containsPoint(point)) ||
    samples(secondTriangle).some((point) => firstTriangle.containsPoint(point))
  );
}

/**
 * Builds a mesh from a non-indexed geometry with the given world transform.
 *
 * @param geometry Source geometry.
 * @param scale Mesh scale.
 * @returns Mesh with updated world matrix.
 */
function meshCreate(geometry: THREE.BufferGeometry, scale: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.scale.copy(scale);
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Lightmap UVs give every flat region its own non-overlapping chart in the unit
 * square, at one texel density for the whole mesh.
 */
describe('lightmap uv layout', () => {
  it('lays out a box as charts that stay inside the unit square and never overlap', () => {
    const geometry = LightmapUvLayout.geometryWithLightmapUvs(
      meshCreate(new THREE.BoxGeometry(2, 1, 3), new THREE.Vector3(1, 1, 1)),
    );
    const triangles = lightmapTrianglesRead(geometry);
    expect(triangles.length).toBe(12);
    for (const triangle of triangles) {
      for (const uv of triangle.uv) {
        expect(uv.x).toBeGreaterThanOrEqual(0);
        expect(uv.y).toBeGreaterThanOrEqual(0);
        expect(uv.x).toBeLessThanOrEqual(1);
        expect(uv.y).toBeLessThanOrEqual(1);
      }
    }
    for (let first = 0; first < triangles.length; first++) {
      for (let second = first + 1; second < triangles.length; second++) {
        expect(uvTrianglesOverlap(triangles[first]?.uv ?? [], triangles[second]?.uv ?? [])).toBe(false);
      }
    }
  });

  it('keeps one texel density across faces of different sizes, including the mesh scale', () => {
    const geometry = LightmapUvLayout.geometryWithLightmapUvs(
      meshCreate(new THREE.BoxGeometry(1, 1, 1), new THREE.Vector3(4, 1, 2)),
    );
    const scaledPositions = geometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(4, 1, 2));
    const triangles = lightmapTrianglesRead(scaledPositions);
    const ratios = triangles.map((triangle) => Math.abs(uvArea(triangle.uv)) / triangle.worldArea);
    const firstRatio = ratios[0] ?? 0;
    expect(firstRatio).toBeGreaterThan(0);
    for (const ratio of ratios) {
      expect(ratio).toBeCloseTo(firstRatio, 6);
    }
  });

  it('keeps triangle winding, material groups and the original attributes', () => {
    const source = new THREE.BoxGeometry(1, 2, 1);
    const geometry = LightmapUvLayout.geometryWithLightmapUvs(meshCreate(source, new THREE.Vector3(1, 1, 1)));
    expect(geometry.groups).toEqual(source.groups);
    expect(geometry.getAttribute('uv')).toBeDefined();
    expect(geometry.getAttribute('normal')).toBeDefined();
    for (const triangle of lightmapTrianglesRead(geometry)) {
      expect(uvArea(triangle.uv)).toBeGreaterThan(0);
    }
    expect(source.getAttribute(LIGHTMAP_UV_ATTRIBUTE_NAME)).toBeUndefined();
  });

  it('writes TEXCOORD_1 into GLB exports that ask for lightmap UVs only', async () => {
    const world = new THREE.Group();
    world.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    const withUvs = glbJsonRead(await new GlbExporter().export(world, null, { includeLightmapUvs: true }));
    const withoutUvs = glbJsonRead(await new GlbExporter().export(world));
    expect(withUvs.meshes?.[0]?.primitives[0]?.attributes['TEXCOORD_1']).toBeDefined();
    expect(withoutUvs.meshes?.[0]?.primitives[0]?.attributes['TEXCOORD_1']).toBeUndefined();
  });
});

/** The chart packer places rectangles without overlap inside the unit square. */
describe('lightmap uv chart packer', () => {
  it('separates every chart by at least the padding', () => {
    const sizes = [
      { width: 3, height: 1 },
      { width: 1, height: 1 },
      { width: 2, height: 2 },
      { width: 0.5, height: 4 },
      { width: 1, height: 0.25 },
    ];
    const padding = 0.1;
    const packing = LightmapUvChartPacker.pack(sizes, padding);
    const rectangles = sizes.map((size, chart) => {
      const x = packing.offsets[chart * 2] ?? 0;
      const y = packing.offsets[chart * 2 + 1] ?? 0;
      return { minX: x, minY: y, maxX: x + size.width, maxY: y + size.height };
    });
    for (const rectangle of rectangles) {
      expect(rectangle.minX).toBeGreaterThanOrEqual(padding - 1e-6);
      expect(rectangle.minY).toBeGreaterThanOrEqual(padding - 1e-6);
      expect(rectangle.maxX * packing.scale).toBeLessThanOrEqual(1 + 1e-6);
      expect(rectangle.maxY * packing.scale).toBeLessThanOrEqual(1 + 1e-6);
    }
    for (let first = 0; first < rectangles.length; first++) {
      for (let second = first + 1; second < rectangles.length; second++) {
        const a = rectangles[first];
        const b = rectangles[second];
        if (!a || !b) continue;
        const apart =
          a.maxX + padding <= b.minX + 1e-6 ||
          b.maxX + padding <= a.minX + 1e-6 ||
          a.maxY + padding <= b.minY + 1e-6 ||
          b.maxY + padding <= a.minY + 1e-6;
        expect(apart).toBe(true);
      }
    }
  });
});
