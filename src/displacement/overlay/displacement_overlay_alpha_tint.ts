import * as THREE from 'three';
import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import type { DisplacementOverlayMaterials } from './displacement_overlay_materials.js';
import { DisplacementOverlayPart } from './displacement_overlay_part.js';

/**
 * Builds grayscale vertex colors from painted alphas: alpha 0 is black and the
 * largest alpha is white.
 *
 * @param alphas Per-vertex alphas from 0 to DISPLACEMENT_ALPHA_MAX.
 * @param vertexCount Number of vertices to color; missing alphas count as 0.
 * @returns RGB floats, one triple per vertex.
 */
export function displacementOverlayAlphaColorsBuild(alphas: readonly number[], vertexCount: number): Float32Array {
  const colors = new Float32Array(vertexCount * 3);
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
    const gray = Math.min(1, Math.max(0, (alphas[vertexIndex] ?? 0) / DISPLACEMENT_ALPHA_MAX));
    colors.fill(gray, vertexIndex * 3, vertexIndex * 3 + 3);
  }
  return colors;
}

/**
 * Grayscale copy of one displacement surface that shows its painted alphas as
 * vertex colors while Paint Alpha is active. The copy owns its geometry so the
 * surface mesh itself never carries a color attribute.
 */
export class DisplacementOverlayAlphaTint extends DisplacementOverlayPart {
  /** Vertex colored surface copy. */
  readonly mesh: THREE.Mesh;

  /**
   * Creates the tint around its mesh.
   *
   * @param mesh Vertex colored surface copy.
   */
  private constructor(mesh: THREE.Mesh) {
    super('displacement_overlay_alpha_tint', [mesh]);
    this.mesh = mesh;
  }

  /**
   * Builds the tint of a displacement surface geometry.
   *
   * @param surfaceGeometry Displacement surface geometry with position and
   *   index.
   * @param alphas Per-vertex alphas of the displacement.
   * @param materials Shared overlay materials.
   * @returns Alpha tint over the surface.
   */
  static create(
    surfaceGeometry: THREE.BufferGeometry,
    alphas: readonly number[],
    materials: DisplacementOverlayMaterials,
  ): DisplacementOverlayAlphaTint {
    const positions = surfaceGeometry.getAttribute('position');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', positions.clone());
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(displacementOverlayAlphaColorsBuild(alphas, positions.count), 3),
    );
    const index = surfaceGeometry.getIndex();
    if (index) {
      geometry.setIndex(index.clone());
    }
    geometry.computeBoundingSphere();
    return new DisplacementOverlayAlphaTint(new THREE.Mesh(geometry, materials.alphaTint));
  }

  /** Releases the tint geometry. */
  protected geometriesDispose(): void {
    this.mesh.geometry.dispose();
  }
}
