import type * as THREE from 'three';
import { resolveInspectorObjects } from '@/selection/object/resolve_transform_targets.js';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';
import { selectionQuerySimilarSignatureRead } from './selection_query_similar_signature.js';

/**
 * Selects every object that looks like a copy of a selected object: same name
 * apart from the copy suffix and the same hierarchy shape. Objects are compared
 * at the level the current selection filter picks, so groups match groups and
 * single objects match single objects.
 */
export class SelectionQuerySimilar extends SelectionQuery {
  readonly id: SelectionQueryId = 'similar';
  readonly label = 'Similar';

  /**
   * Returns the candidates whose object shares a signature with a selected
   * object.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Selected meshes and the meshes of every similar object.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    const signatureByTarget = new Map<THREE.Object3D, string>();
    const signatureOf = (mesh: THREE.Mesh): string => this.meshSignatureRead(mesh, signatureByTarget);
    const selectedSignatures = new Set(selected.map(signatureOf));
    return candidates.filter((candidate) => selectedSignatures.has(signatureOf(candidate)));
  }

  /**
   * Returns the signature of the object a mesh selects, reusing signatures
   * already worked out for that object.
   *
   * @param mesh Selectable mesh.
   * @param signatureByTarget Signatures worked out so far, by object.
   * @returns Signature of the mesh's object.
   */
  private meshSignatureRead(mesh: THREE.Mesh, signatureByTarget: Map<THREE.Object3D, string>): string {
    const target = resolveInspectorObjects([mesh])[0] ?? mesh;
    const known = signatureByTarget.get(target);
    if (known !== undefined) {
      return known;
    }
    const signature = selectionQuerySimilarSignatureRead(target);
    signatureByTarget.set(target, signature);
    return signature;
  }
}
