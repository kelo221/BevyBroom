import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import {
  gameEntityClassListEmpty,
  type GameEntityClass,
  type GameEntityField,
} from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentNormalizeFollower } from '@/game_entity/migration/game_entity_component_normalize_follower.js';
import { gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { IssueProviderGameComponentRewrites } from '@/info_panel/issues/providers/issue_provider_game_component_rewrites.js';
import { IssueProviderLevelClassCopy } from '@/info_panel/issues/providers/issue_provider_level_class_copy.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';

/** Old type path of the shelf class. */
const OLD_SHELF = 'store::Shelf';

/** Type path of the stock fixture class. */
const STOCK_FIXTURE = 'store::StockFixture';

/**
 * Returns an enum fixture field.
 *
 * @param variants Values the field lists.
 * @param defaultValue Default value.
 * @returns Field.
 */
function fixtureFieldCreate(variants: string[], defaultValue: string): GameEntityField {
  return { path: 'fixture', label: 'Fixture', kind: 'enum', default: defaultValue, variants };
}

/**
 * Returns a class with one fixture field.
 *
 * @param typePath Type path.
 * @param field Fixture field.
 * @returns Class.
 */
function classCreate(typePath: string, field: GameEntityField): GameEntityClass {
  return {
    type_path: typePath,
    label: typePath.split('::').pop() ?? typePath,
    category: 'Store',
    placement: 'point',
    marker_color: [1, 1, 1],
    fields: [field],
  };
}

/**
 * Returns the project's stock fixture class, renamed from the shelf with its
 * shop shelf id renamed.
 *
 * @param defaultValue Default fixture.
 * @returns Class.
 */
function stockFixtureCreate(defaultValue = 'shop-shelf-4'): GameEntityClass {
  const field = fixtureFieldCreate(['shop-shelf-4', 'big-fridge'], defaultValue);
  field.renamed_variants = { 'shop-shelf': 'shop-shelf-4' };
  return { ...classCreate(STOCK_FIXTURE, field), renamed_from: [OLD_SHELF] };
}

/**
 * Makes a class list the project's class file.
 *
 * @param classes Classes the file declares.
 */
function projectClassesWrite(classes: GameEntityClass[]): void {
  GameEntityClassProviderProject.shared.listWrite({ ...gameEntityClassListEmpty(), classes });
}

/**
 * Returns an old level: one shelf holding the shop shelf id, carrying its class
 * copy.
 *
 * @returns Scene file content and the shelf's id.
 */
function oldLevelCreate(): { scene: SceneJSON; shelfId: string } {
  const world = new THREE.Group();
  const shelf = gameEntityCreateForClass(classCreate(OLD_SHELF, fixtureFieldCreate(['shop-shelf'], 'shop-shelf')), {
    [OLD_SHELF]: { fixture: 'shop-shelf' },
  });
  world.add(shelf);
  const scene = new SceneSerializer().serialize(world);
  scene.gameClasses = [classCreate(OLD_SHELF, fixtureFieldCreate(['shop-shelf'], 'shop-shelf'))];
  return { scene, shelfId: shelf.uuid };
}

/**
 * Loads a scene file into a fresh world.
 *
 * @param scene Scene file content.
 * @returns Loaded world.
 */
function sceneLoad(scene: SceneJSON): THREE.Group {
  const world = new THREE.Group();
  new SceneDeserializer().deserialize(JSON.parse(JSON.stringify(scene)) as SceneJSON, world);
  return world;
}

/**
 * Levels saved before a class or a value was renamed open with current names,
 * an Issues line per rewrite, and save, preview and export with every enum
 * value written out; the project's class file always wins over a level's copy.
 */
describe('game component migration in levels', () => {
  afterEach(() => {
    GameEntityClassProviderProject.shared.listWrite(gameEntityClassListEmpty());
    GameEntityClassProviderScene.shared.listWrite(gameEntityClassListEmpty());
  });

  it('rewrites a renamed class and value on load and names each rewrite in the Issues list', () => {
    const { scene, shelfId } = oldLevelCreate();
    projectClassesWrite([stockFixtureCreate()]);
    const world = sceneLoad(scene);
    const shelf = world.getObjectByProperty('uuid', shelfId);
    expect(shelf === undefined ? null : GameEntityComponentStore.read(shelf)).toEqual({
      [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' },
    });
    const issues = new IssueProviderGameComponentRewrites().collect(world);
    expect(issues.map((issue) => issue.objectUuid)).toEqual([shelfId, shelfId]);
    expect(issues.some((issue) => issue.description.includes('shop-shelf-4'))).toBe(true);
  });

  it('hides a class another class was renamed from and says the level copy is replaced', () => {
    const { scene } = oldLevelCreate();
    projectClassesWrite([stockFixtureCreate()]);
    sceneLoad(scene);
    expect(GameEntityClassRegistry.classFind(OLD_SHELF)).toBeNull();
    const issues = new IssueProviderLevelClassCopy().collect(new THREE.Group());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.description).toContain('replaced');
  });

  it("uses the project's class over a differing level copy and says the copy is refreshed", () => {
    projectClassesWrite([stockFixtureCreate('big-fridge')]);
    GameEntityClassProviderScene.shared.listWrite({ ...gameEntityClassListEmpty(), classes: [stockFixtureCreate()] });
    expect(GameEntityClassRegistry.classFind(STOCK_FIXTURE)?.fields[0]?.default).toBe('big-fridge');
    const issues = new IssueProviderLevelClassCopy().collect(new THREE.Group());
    expect(issues[0]?.description).toContain('refreshed');
  });

  it('saves and previews every enum value written out, so a later default change keeps the object', () => {
    projectClassesWrite([stockFixtureCreate()]);
    const world = new THREE.Group();
    const fixture = gameEntityCreateForClass(stockFixtureCreate(), { [STOCK_FIXTURE]: {} });
    world.add(fixture);
    const saved = new SceneSerializer().serialize(world);
    expect(saved.objects.find((entry) => entry.uuid === fixture.uuid)?.gameComponents).toEqual({
      [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' },
    });
    const sent = PreviewStateObjectCollector.collect(world).find((object) => object.id === fixture.uuid);
    expect(sent?.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
    projectClassesWrite([stockFixtureCreate('big-fridge')]);
    const reloaded = sceneLoad(saved).getObjectByProperty('uuid', fixture.uuid);
    expect(reloaded === undefined ? null : GameEntityComponentStore.read(reloaded)).toEqual({
      [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' },
    });
  });

  it('writes in values of new objects in the same undo entry and rewrites objects when the classes change', () => {
    projectClassesWrite([stockFixtureCreate()]);
    const world = new THREE.Group();
    const stack = new CommandStack(10);
    const stop = new GameEntityComponentNormalizeFollower(world).follow(stack);
    const fixture = gameEntityCreateForClass(stockFixtureCreate(), { [STOCK_FIXTURE]: {} });
    stack.push(new CommandPrimitiveCreate(fixture, world));
    expect(GameEntityComponentStore.read(fixture)).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
    expect(stack.getUndoCount()).toBe(1);
    const old = gameEntityCreateForClass(stockFixtureCreate(), { [OLD_SHELF]: { fixture: 'shop-shelf' } });
    world.add(old);
    projectClassesWrite([stockFixtureCreate()]);
    expect(GameEntityComponentStore.read(old)).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
    expect(stack.getUndoCount()).toBe(2);
    stop();
  });
});
