import * as THREE from 'three';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import { getTriangleCount, getTriangleVertexIndices } from '@/selection/pick/utils_triangle_geometry.js';
import {
  displacementFaceKeyBuild,
  displacementSurfaceMeshIdentityRead,
  displacementSurfaceMeshesUnder,
} from '@/displacement/mesh/displacement_surface_mesh_keys.js';

/** Kept result triangles grouped by material slot, in first-seen order. */
type DisplacementExportTriangleBuckets = Map<number, number[]>;

/**
 * Builds export geometry for solid result meshes whose model carries
 * displacement surfaces: triangles of displaced brush faces are dropped so only
 * the displacement surface represents those faces.
 */
export class DisplacementExportResultFilter {
  /**
   * Returns the geometry a solid result mesh exports with.
   *
   * @param resultMesh Live solid result mesh.
   * @param solidRoot Solid model root owning the result and its displacement
   *   surfaces.
   * @returns The result's own geometry when nothing is displaced, otherwise a
   *   new non-indexed geometry without the displaced faces' triangles.
   */
  static geometryRead(resultMesh: THREE.Mesh, solidRoot: THREE.Object3D): THREE.BufferGeometry {
    const displacedFaceKeys = DisplacementExportResultFilter.displacedFaceKeysRead(solidRoot);
    const sources = resultMesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as unknown;
    if (displacedFaceKeys.size === 0 || !Array.isArray(sources)) {
      return resultMesh.geometry;
    }
    const buckets = DisplacementExportResultFilter.keptTriangleBucketsBuild(
      resultMesh.geometry,
      sources as readonly (SolidTriangleSourceRef | undefined)[],
      displacedFaceKeys,
    );
    return DisplacementExportResultFilter.geometryFromBuckets(resultMesh.geometry, buckets);
  }

  /**
   * Collects the brush face keys of every displacement surface under a solid
   * root.
   *
   * @param solidRoot Solid model root.
   * @returns Set of keys built by displacementFaceKeyBuild.
   */
  static displacedFaceKeysRead(solidRoot: THREE.Object3D): Set<string> {
    const keys = new Set<string>();
    for (const surfaceMesh of displacementSurfaceMeshesUnder(solidRoot)) {
      const identity = displacementSurfaceMeshIdentityRead(surfaceMesh);
      if (identity) {
        keys.add(displacementFaceKeyBuild(identity.brushId, identity.surfaceIndex));
      }
    }
    return keys;
  }

  /**
   * Groups the triangles that are not part of a displaced face by material
   * slot.
   *
   * @param geometry Result geometry.
   * @param sources Per-triangle brush face sources.
   * @param displacedFaceKeys Keys of displaced brush faces.
   * @returns Kept triangle indices per material slot.
   */
  private static keptTriangleBucketsBuild(
    geometry: THREE.BufferGeometry,
    sources: readonly (SolidTriangleSourceRef | undefined)[],
    displacedFaceKeys: ReadonlySet<string>,
  ): DisplacementExportTriangleBuckets {
    const materialSlots = DisplacementExportResultFilter.triangleMaterialSlotsRead(geometry);
    const buckets: DisplacementExportTriangleBuckets = new Map();
    const triangleCount = getTriangleCount(geometry);
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
      const source = sources[triangleIndex];
      if (source && displacedFaceKeys.has(displacementFaceKeyBuild(source.brushId, source.surfaceIndex))) {
        continue;
      }
      const slot = materialSlots[triangleIndex] ?? 0;
      const bucket = buckets.get(slot) ?? [];
      bucket.push(triangleIndex);
      buckets.set(slot, bucket);
    }
    return buckets;
  }

  /**
   * Reads the material slot of every triangle from the geometry's draw groups.
   *
   * @param geometry Result geometry.
   * @returns Material slot per triangle index; triangles outside every group
   *   are left unset.
   */
  private static triangleMaterialSlotsRead(geometry: THREE.BufferGeometry): number[] {
    const slots: number[] = [];
    for (const group of geometry.groups) {
      const firstTriangle = Math.floor(group.start / 3);
      const endTriangle = firstTriangle + Math.floor(group.count / 3);
      for (let triangleIndex = firstTriangle; triangleIndex < endTriangle; triangleIndex++) {
        slots[triangleIndex] = group.materialIndex ?? 0;
      }
    }
    return slots;
  }

  /**
   * Builds a non-indexed geometry from kept triangles, one draw group per
   * material slot.
   *
   * @param source Result geometry the triangles come from.
   * @param buckets Kept triangle indices per material slot.
   * @returns New geometry carrying every attribute of the source.
   */
  private static geometryFromBuckets(
    source: THREE.BufferGeometry,
    buckets: DisplacementExportTriangleBuckets,
  ): THREE.BufferGeometry {
    const orderedTriangles: number[] = [];
    const output = new THREE.BufferGeometry();
    for (const [slot, triangles] of buckets) {
      output.addGroup(orderedTriangles.length * 3, triangles.length * 3, slot);
      orderedTriangles.push(...triangles);
    }
    const vertexIndices = DisplacementExportResultFilter.vertexIndicesRead(source, orderedTriangles);
    for (const [name, attribute] of Object.entries(source.attributes)) {
      output.setAttribute(name, DisplacementExportResultFilter.attributeGather(attribute, vertexIndices));
    }
    return output;
  }

  /**
   * Lists the source vertex index of every corner of the given triangles.
   *
   * @param source Result geometry.
   * @param triangles Triangle indices in output order.
   * @returns Source vertex indices, three per triangle.
   */
  private static vertexIndicesRead(source: THREE.BufferGeometry, triangles: readonly number[]): number[] {
    const vertexIndices: number[] = [];
    for (const triangleIndex of triangles) {
      vertexIndices.push(...getTriangleVertexIndices(source, triangleIndex));
    }
    return vertexIndices;
  }

  /**
   * Copies the listed vertices of one attribute into a new attribute.
   *
   * @param attribute Source attribute.
   * @param vertexIndices Source vertex indices in output order.
   * @returns New float attribute with the same item size holding the
   *   denormalized values.
   */
  private static attributeGather(
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    vertexIndices: readonly number[],
  ): THREE.BufferAttribute {
    const itemSize = attribute.itemSize;
    const values = new Float32Array(vertexIndices.length * itemSize);
    vertexIndices.forEach((vertexIndex, outputIndex) => {
      for (let component = 0; component < itemSize; component++) {
        values[outputIndex * itemSize + component] = attribute.getComponent(vertexIndex, component);
      }
    });
    return new THREE.BufferAttribute(values, itemSize);
  }
}
