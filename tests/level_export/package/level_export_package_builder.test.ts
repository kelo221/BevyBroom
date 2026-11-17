import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { COLLISION_FILE_VERSION, type CollisionDocument } from '@/level_export/collision/collision_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { LevelExportPackageBuilder } from '@/level_export/package/level_export_package_builder.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from '../collision/collision_test_models.js';

/**
 * Creates a world with a solid block and a volume zone.
 *
 * @returns World, block root and zone root.
 */
function worldCreate(): { world: THREE.Group; block: THREE.Object3D; zone: THREE.Object3D } {
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
  const block = collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]).root;
  const zone = collisionTestModelCreate([{ box, operation: SolidOperation.Additive }]).root;
  CollisionKindStore.overrideWrite(zone, 'volume');
  const world = new THREE.Group();
  world.add(block, zone);
  return { world, block, zone };
}

/**
 * The level package files come from one builder for Build Level and the command
 * line.
 */
describe('LevelExportPackageBuilder', () => {
  it('leaves out volumes and nodraw faces from the render export and asks for collision extras', () => {
    const { world, block, zone } = worldCreate();
    const options = LevelExportPackageBuilder.exportOptionsOf({
      worldGroup: world,
      levelName: 'hall',
      projectIdentifier: 'p',
      toolTextures: { nodraw: ['tools/nodraw.png'] },
    });
    expect(options.includeCollision).toBe(true);
    expect(options.isObjectOmitted?.(zone)).toBe(true);
    expect(options.isObjectOmitted?.(block)).toBe(false);
    expect(options.isMaterialOmitted?.('tools/nodraw.png')).toBe(true);
    expect(options.isMaterialOmitted?.('walls/brick.png')).toBe(false);
  });

  it('builds the GLB with those options, the manifest and the collision document', async () => {
    const { world } = worldCreate();
    let receivedOptions: ExportSceneOptions | null = null;
    const built = await LevelExportPackageBuilder.build(
      { worldGroup: world, levelName: 'Main Hall', projectIdentifier: 'project-id', toolTextures: { nodraw: [] } },
      async (_world, options) => {
        receivedOptions = options;
        return new ArrayBuffer(0);
      },
    );
    expect(receivedOptions).toMatchObject({ includeCollision: true, includeLightmapUvs: true });
    expect(built.manifest.level_name).toBe('main_hall');
    const collision = JSON.parse(built.collisionJson) as CollisionDocument;
    expect(collision.collision_version).toBe(COLLISION_FILE_VERSION);
    expect(collision.level_name).toBe(built.manifest.level_name);
    expect(new Set(collision.pieces.map((piece) => piece.kind))).toEqual(new Set(['solid', 'volume']));
  });
});
