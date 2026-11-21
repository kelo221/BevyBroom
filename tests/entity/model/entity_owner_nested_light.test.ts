import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { entityOwnerChildOwners } from '@/entity/model/entity_owner_keys.js';
import { GameEntityFixtureLightMark } from '@/game_entity/fixture_light/game_entity_fixture_light_mark.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { buildExportScene, EXPORT_OBJECT_IDENTITY_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import {
  LIGHT_EXPORT_SIZE_EXTRAS_KEY,
  LIGHT_EXPORT_TYPE_EXTRAS_KEY,
} from '@/light/export/light_export_node_builder.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';

/** Variant key the nested test light carries. */
const NESTED_LIGHT_VARIANT_KEY = 'game::store::StoreProp|fixture=fluorescent-light';

/** A fixture entity with a marked tube light nested under it, in a world. */
interface NestedLightScene {
  readonly world: THREE.Group;
  readonly fixture: THREE.Group;
  readonly tube: THREE.Group;
}

/**
 * Builds a world holding a fixture entity that carries a tube light.
 *
 * @returns The world, the fixture and its tube.
 */
function nestedLightSceneCreate(): NestedLightScene {
  const world = new THREE.Group();
  const fixture = GameEntityOwner.createDefault('Fixture');
  fixture.position.set(4, 3, -2);
  const tube = LightOwner.create('Fixture light', { ...lightSettingsCreateDefault('tube'), tubeLength: 1.5 });
  tube.position.set(0, -0.1, 0);
  tube.rotation.set(0, 0, 0.3);
  GameEntityFixtureLightMark.write(tube, NESTED_LIGHT_VARIANT_KEY);
  fixture.add(tube);
  world.add(fixture);
  return { world, fixture, tube };
}

/**
 * Lights nested under another entity, such as a store fixture's tube, are
 * saved, sent to the game, exported and duplicated with their parent.
 */
describe('entity owners nested under entity owners', () => {
  it('saves and loads the nested light under its entity with its settings, transform and mark', () => {
    const { world, fixture, tube } = nestedLightSceneCreate();
    const loaded = new THREE.Group();
    const text = JSON.stringify(new SceneSerializer().serialize(world));
    new SceneDeserializer().deserialize(JSON.parse(text), loaded);
    const restored = loaded.getObjectByProperty('uuid', tube.uuid);
    expect(restored?.parent?.uuid).toBe(fixture.uuid);
    expect(restored === undefined ? null : LightOwner.settingsRead(restored)?.tubeLength).toBe(1.5);
    expect(restored?.quaternion.angleTo(tube.quaternion)).toBeLessThan(1e-6);
    expect(restored === undefined ? null : GameEntityFixtureLightMark.read(restored)).toBe(NESTED_LIGHT_VARIANT_KEY);
  });

  it('sends the nested light to the game as a tube whose parent is the entity', () => {
    const { world, fixture, tube } = nestedLightSceneCreate();
    const objects = PreviewStateObjectCollector.collect(world);
    const light = objects.find((object) => object.id === tube.uuid);
    expect(light?.parent_id).toBe(fixture.uuid);
    expect(light?.light?.light_type).toBe('tube');
    expect(light?.light?.length).toBe(1.5);
    expect(light?.translation).toEqual(tube.position.toArray());
  });

  it('exports the nested light under the entity with its DynLight tube size', () => {
    const { world, fixture } = nestedLightSceneCreate();
    const exported = buildExportScene(world, { includeLightNodes: true });
    const fixtureGroup = exported.children.find(
      (child) => child.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === fixture.uuid,
    );
    const lightNodes: THREE.Object3D[] = [];
    fixtureGroup?.traverse((node) => {
      if (node.userData[LIGHT_EXPORT_TYPE_EXTRAS_KEY] !== undefined) {
        lightNodes.push(node);
      }
    });
    expect(lightNodes).toHaveLength(1);
    expect(lightNodes[0]?.userData[LIGHT_EXPORT_TYPE_EXTRAS_KEY]).toBe('tube');
    expect(lightNodes[0]?.userData[LIGHT_EXPORT_SIZE_EXTRAS_KEY]).toEqual([1.5]);
  });

  it('duplicates the nested light with its entity as a new light with the same mark', () => {
    const { world, fixture, tube } = nestedLightSceneCreate();
    const command = new CommandEntityDuplicate([fixture]);
    command.execute();
    const [copy] = command.getClonedOwners();
    const copiedLights = copy === undefined ? [] : entityOwnerChildOwners(copy);
    expect(copiedLights).toHaveLength(1);
    expect(copiedLights[0]?.uuid).not.toBe(tube.uuid);
    expect(copiedLights[0]?.position.toArray()).toEqual(tube.position.toArray());
    expect(copiedLights[0] === undefined ? null : GameEntityFixtureLightMark.read(copiedLights[0])).toBe(
      NESTED_LIGHT_VARIANT_KEY,
    );
    expect(world.children).toHaveLength(2);
  });
});
