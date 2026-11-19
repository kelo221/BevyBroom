import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { EditorApiGameEntityModelReport } from '@/ai/client/editor_api_game_entity_model.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import {
  testClassesInstall,
  testClassListCreate,
  testDoorClassCreate,
} from '../../game_entity/game_entity_test_classes.js';
import {
  gameEntityModelTestBase64,
  gameEntityModelTestGlbCreate,
  gameEntityModelTestReaderCreate,
} from '../../game_entity/model/game_entity_model_test_files.js';

/** Model path of iron doors. */
const IRON_MODEL_PATH = 'models/iron_door.glb';

/** Edge lengths of the iron door model. */
const IRON_MODEL_SIZE = new THREE.Vector3(3, 2.5, 0.4);

/**
 * Returns the test door class whose iron kind names a model.
 *
 * @returns Door class.
 */
function doorClassWithModel(): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box_field: 'kind',
    marker_boxes: { Iron: { size: IRON_MODEL_SIZE.toArray(), offset: [0, 1.25, 0], model: IRON_MODEL_PATH } },
  };
}

/**
 * Adds a door through the add_game_entity tool and returns its id.
 *
 * @param api Editor API.
 * @param kind Door kind.
 * @returns Door id.
 */
function doorAdd(api: EditorApi, kind: string): string {
  const added = api.invokeTool('add_game_entity', { class: doorClassWithModel().type_path, fields: { kind } });
  const id = added.createdIds?.[0];
  if (!added.ok || id === undefined) {
    throw new Error(`add failed: ${added.message}`);
  }
  return id;
}

/**
 * The read_game_entity_model tool tells which model a game entity's marker
 * names, starts loading it and reports once it is drawn and how big it is.
 */
describe('read_game_entity_model', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    GameEntityModelLibrary.shared.readerSet(null);
  });

  it('reports the named model as drawn at its own size once it is loaded', async () => {
    const list = testClassListCreate();
    list.classes = [doorClassWithModel()];
    cleanups.push(testClassesInstall(list).uninstall);
    const files = new Map([
      [IRON_MODEL_PATH, gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(IRON_MODEL_SIZE))],
    ]);
    GameEntityModelLibrary.shared.readerSet(gameEntityModelTestReaderCreate(files).reader);
    const api = new EditorApi(editorApiTestHostCreate().host);
    const id = doorAdd(api, 'Iron');
    const first = api.invokeTool('read_game_entity_model', { id }).data as EditorApiGameEntityModelReport;
    expect(first.model).toBe(IRON_MODEL_PATH);
    await GameEntityModelLibrary.shared.idle();
    const drawn = api.invokeTool('read_game_entity_model', { id }).data as EditorApiGameEntityModelReport;
    expect(drawn.isDrawn).toBe(true);
    expect(new THREE.Vector3(...(drawn.size ?? [0, 0, 0])).distanceTo(IRON_MODEL_SIZE)).toBeLessThan(1e-5);
  });

  it('reports no model for a box without one and refuses objects that are no game entity', () => {
    const list = testClassListCreate();
    list.classes = [doorClassWithModel()];
    cleanups.push(testClassesInstall(list).uninstall);
    const api = new EditorApi(editorApiTestHostCreate().host);
    const report = api.invokeTool('read_game_entity_model', { id: doorAdd(api, 'Wooden') });
    expect(report.data).toMatchObject({ model: null, isDrawn: false, size: null });
    expect(api.invokeTool('read_game_entity_model', { id: 'missing' }).ok).toBe(false);
  });
});
