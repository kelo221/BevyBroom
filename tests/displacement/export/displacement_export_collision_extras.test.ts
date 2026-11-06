import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildExportScene } from '@/io/scene/builder_export_scene.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  DISPLACEMENT_COLLISION_FLAG_KEYS,
  type DisplacementCollisionFlags,
} from '@/displacement/model/displacement_types.js';
import { displacementCollisionFlagsMerge } from '@/displacement/model/displacement_collision_flags.js';
import { displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { displacementSurfaceMeshNameBuild } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import {
  DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY,
  DisplacementExportCollisionExtrasBuilder,
  type DisplacementExportCollisionExtras,
} from '@/displacement/export/displacement_export_collision_extras.js';
import { glbJsonRead } from '../../io/glb/glb_json_read.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Rig with one brush whose upward face carries a displacement. */
interface CollisionExtrasTestScene {
  /** Test rig. */
  rig: DisplacementTestRig;
  /** Displaced face. */
  target: SolidFaceTextureTarget;
  /** Scene name of the displacement surface mesh. */
  surfaceName: string;
}

/**
 * Builds a model whose only box has a displaced upward face.
 *
 * @returns Rig, displaced face and surface mesh name.
 */
function collisionExtrasTestSceneCreate(): CollisionExtrasTestScene {
  const rig = displacementTestRigCreate('CollisionExtras');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 1, 3), new THREE.Vector3(0, 0, 0));
  const upward = displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0));
  const target = displacementTestTarget(rig, brush, upward);
  displacementTestCreate(rig, target, 2);
  const surfaceName = displacementSurfaceMeshNameBuild({ brushId: brush.id, surfaceIndex: upward });
  return { rig, target, surfaceName };
}

/**
 * Replaces some collision flags of the displaced face through the undo stack.
 *
 * @param scene Test scene.
 * @param changes Flags to replace.
 */
function collisionExtrasTestFlagsSet(
  scene: CollisionExtrasTestScene,
  changes: Partial<DisplacementCollisionFlags>,
): void {
  const current = scene.target.model.findBrush(scene.target.brushId)?.faceDisplacementRead(scene.target.surfaceIndex);
  if (!current) throw new Error('displaced face missing');
  const displacement = displacementSurfaceClone(current);
  displacement.flags = displacementCollisionFlagsMerge(current.flags, changes);
  scene.rig.commandStack.push(new CommandDisplacementEdit([{ target: scene.target, displacement }]));
}

/**
 * Finds the exported node of the displacement surface.
 *
 * @param scene Test scene.
 * @returns Exported surface node.
 */
function collisionExtrasTestExportedSurfaceRead(scene: CollisionExtrasTestScene): THREE.Object3D {
  const exported = buildExportScene(scene.rig.world).getObjectByName(scene.surfaceName);
  if (!exported) throw new Error('export has no displacement surface');
  return exported;
}

/**
 * Builds the extras expected for some flags: every field present, the named
 * ones on.
 *
 * @param flags Flags that are on.
 * @returns Expected extras.
 */
function collisionExtrasTestExpected(flags: Partial<DisplacementCollisionFlags>): DisplacementExportCollisionExtras {
  return {
    no_physics_collision: flags.noPhysicsCollision === true,
    no_hull_collision: flags.noHullCollision === true,
    no_ray_collision: flags.noRayCollision === true,
    seals: flags.seals === true,
  };
}

/**
 * Collision flags of displacements reach exported nodes as extras the game
 * reads.
 */
describe('DisplacementExportCollisionExtrasBuilder', () => {
  it('writes every flag of a displaced face with some flags set', () => {
    const scene = collisionExtrasTestSceneCreate();
    const changes = { noPhysicsCollision: true, seals: true };
    collisionExtrasTestFlagsSet(scene, changes);
    const extras = collisionExtrasTestExportedSurfaceRead(scene).userData[DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY];
    expect(extras).toEqual(collisionExtrasTestExpected(changes));
  });

  it('writes each flag on its own field', () => {
    for (const key of DISPLACEMENT_COLLISION_FLAG_KEYS) {
      const scene = collisionExtrasTestSceneCreate();
      collisionExtrasTestFlagsSet(scene, { [key]: true });
      const extras = collisionExtrasTestExportedSurfaceRead(scene).userData[DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY];
      expect(extras).toEqual(collisionExtrasTestExpected({ [key]: true }));
    }
  });

  it('writes no extras when every flag is off, also after clearing set flags', () => {
    const scene = collisionExtrasTestSceneCreate();
    expect(collisionExtrasTestExportedSurfaceRead(scene).userData).not.toHaveProperty(
      DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY,
    );
    collisionExtrasTestFlagsSet(scene, { noRayCollision: true });
    collisionExtrasTestFlagsSet(scene, { noRayCollision: false });
    expect(collisionExtrasTestExportedSurfaceRead(scene).userData).not.toHaveProperty(
      DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY,
    );
  });

  it('writes no extras on the solid result or on objects that are no displacement surface', () => {
    const scene = collisionExtrasTestSceneCreate();
    collisionExtrasTestFlagsSet(scene, { noHullCollision: true });
    const resultMesh = scene.rig.model.getResultMesh();
    expect(DisplacementExportCollisionExtrasBuilder.extrasOfSurfaceMesh(resultMesh)).toBeNull();
    expect(DisplacementExportCollisionExtrasBuilder.extrasOfSurfaceMesh(new THREE.Mesh())).toBeNull();
  });

  it('keeps the extras through the GLB file the game loads', async () => {
    const scene = collisionExtrasTestSceneCreate();
    const changes = { noHullCollision: true, noRayCollision: true };
    collisionExtrasTestFlagsSet(scene, changes);
    for (const buffer of [
      await new GlbExporter().exportForFile(scene.rig.world),
      await new GlbExporter().exportForLevelPackage(scene.rig.world),
    ]) {
      const surfaceNode = glbJsonRead(buffer).nodes?.find((node) => node.name === scene.surfaceName);
      expect(surfaceNode?.extras?.[DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY]).toEqual(
        collisionExtrasTestExpected(changes),
      );
    }
  });
});
