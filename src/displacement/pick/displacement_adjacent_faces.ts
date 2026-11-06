import type * as THREE from 'three';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSew } from '@/displacement/sculpt/displacement_sew.js';

/**
 * Finds the displaced faces next to a set of displaced faces: faces of any
 * brush in any solid model of the same scene whose border vertices share a flat
 * world position with a border vertex of the given faces.
 */
export class DisplacementAdjacentFaces {
  /**
   * Lists the displaced faces adjacent to the given faces.
   *
   * @param selectedTargets Displaced brush faces to start from; flat faces are
   *   ignored.
   * @returns Adjacent displaced faces that are not among the given faces, in
   *   scene order.
   */
  static adjacentTargetsFind(selectedTargets: readonly SolidFaceTextureTarget[]): SolidFaceTextureTarget[] {
    const selectedFaces = DisplacementSculptFace.listFromTargets(selectedTargets);
    if (selectedFaces.length === 0) {
      return [];
    }
    const selectedKeys = new Set(selectedTargets.map((target) => DisplacementAdjacentFaces.targetKeyBuild(target)));
    const candidateFaces = DisplacementSculptFace.listFromTargets(
      DisplacementAdjacentFaces.sceneDisplacedTargetsRead(selectedTargets).filter(
        (target) => !selectedKeys.has(DisplacementAdjacentFaces.targetKeyBuild(target)),
      ),
    );
    const adjacentFaces = DisplacementAdjacentFaces.touchingFacesCollect(new Set(selectedFaces), candidateFaces);
    return candidateFaces.filter((face) => adjacentFaces.has(face)).map((face) => face.target);
  }

  /**
   * Collects the candidate faces whose border shares a point with a selected
   * face's border.
   *
   * @param selectedFaces Faces to start from.
   * @param candidateFaces Faces that may touch them.
   * @returns Candidate faces that touch a selected face.
   */
  private static touchingFacesCollect(
    selectedFaces: ReadonlySet<DisplacementSculptFace>,
    candidateFaces: readonly DisplacementSculptFace[],
  ): Set<DisplacementSculptFace> {
    const touching = new Set<DisplacementSculptFace>();
    const groups = DisplacementSew.borderGroupsCollect([...selectedFaces, ...candidateFaces]);
    for (const group of groups) {
      if (!group.some((entry) => selectedFaces.has(entry.face))) {
        continue;
      }
      group.filter((entry) => !selectedFaces.has(entry.face)).forEach((entry) => touching.add(entry.face));
    }
    return touching;
  }

  /**
   * Lists every displaced face of every solid model in the scenes the given
   * faces belong to.
   *
   * @param selectedTargets Brush faces whose scenes are searched.
   * @returns Displaced brush faces.
   */
  private static sceneDisplacedTargetsRead(
    selectedTargets: readonly SolidFaceTextureTarget[],
  ): SolidFaceTextureTarget[] {
    const sceneRoots = new Set(
      selectedTargets.map((target) => DisplacementAdjacentFaces.sceneRootRead(target.model.root)),
    );
    const models = new Set([...sceneRoots].flatMap((root) => [...SolidModelRegistry.collectUnder(root)]));
    return [...models].flatMap((model) =>
      model
        .getBrushes()
        .flatMap((brush) =>
          brush.faceDisplacementIndices().map((surfaceIndex) => ({ model, brushId: brush.id, surfaceIndex })),
        ),
    );
  }

  /**
   * Returns the topmost ancestor of an object.
   *
   * @param object Scene object.
   * @returns Root of the object's scene graph.
   */
  private static sceneRootRead(object: THREE.Object3D): THREE.Object3D {
    let root = object;
    while (root.parent) {
      root = root.parent;
    }
    return root;
  }

  /**
   * Builds an identity key of one brush face.
   *
   * @param target Brush face.
   * @returns Key unique per model, brush and face.
   */
  private static targetKeyBuild(target: SolidFaceTextureTarget): string {
    return `${target.model.root.uuid}|${target.brushId}|${target.surfaceIndex}`;
  }
}
