import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import {
  gameEntityModelTestBase64,
  gameEntityModelTestGlbCreate,
  gameEntityModelTestReaderCreate,
  gameEntityModelTestSizeOf,
} from './game_entity_model_test_files.js';

/** Path of the model the tests serve. */
const MODEL_PATH = 'models/crate.glb';

/**
 * Creates a library reading one served box model.
 *
 * @param size Edge lengths of the served box.
 * @returns Library and the paths its reader was asked for.
 */
async function libraryWithModelCreate(
  size: THREE.Vector3,
): Promise<{ library: GameEntityModelLibrary; reads: string[] }> {
  const files = new Map([[MODEL_PATH, gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(size))]]);
  const { reader, reads } = gameEntityModelTestReaderCreate(files);
  const library = new GameEntityModelLibrary();
  library.readerSet(reader);
  return { library, reads };
}

/**
 * The model library loads every model a marker asks for once, through the
 * reader of the open project, and tells by its generation when one is ready.
 */
describe('GameEntityModelLibrary', () => {
  it('returns nothing until a model is loaded, then the model, reading it once', async () => {
    const size = new THREE.Vector3(1.5, 0.75, 0.5);
    const { library, reads } = await libraryWithModelCreate(size);
    const generationBefore = library.generation();
    expect(library.templateRead(MODEL_PATH)).toBeNull();
    await library.idle();
    const template = library.templateRead(MODEL_PATH);
    const meshes: THREE.Mesh[] = [];
    template?.traverse((part) => part instanceof THREE.Mesh && meshes.push(part));
    expect(meshes).toHaveLength(1);
    expect(gameEntityModelTestSizeOf(template ?? new THREE.Group()).distanceTo(size)).toBeLessThan(1e-5);
    expect(library.generation()).not.toBe(generationBefore);
    library.templateRead(MODEL_PATH);
    expect(reads).toEqual([MODEL_PATH]);
  });

  it('tells its listeners when a model becomes ready and when the reader changes', async () => {
    const { library } = await libraryWithModelCreate(new THREE.Vector3(1, 1, 1));
    let changeCount = 0;
    const listenerRemove = library.changeListenerAdd(() => (changeCount += 1));
    library.templateRead(MODEL_PATH);
    await library.idle();
    expect(changeCount).toBe(1);
    library.readerSet(null);
    expect(changeCount).toBe(2);
    listenerRemove();
    library.readerSet(null);
    expect(changeCount).toBe(2);
  });

  it('remembers and reports a model that cannot be read without asking again', async () => {
    const { reader, reads } = gameEntityModelTestReaderCreate(new Map());
    const reported: string[] = [];
    const library = new GameEntityModelLibrary();
    library.readerSet(reader, (message) => reported.push(message));
    library.templateRead(MODEL_PATH);
    await library.idle();
    expect(library.templateRead(MODEL_PATH)).toBeNull();
    expect(library.failureRead(MODEL_PATH)).toContain(MODEL_PATH);
    expect(reported).toHaveLength(1);
    expect(reads).toEqual([MODEL_PATH]);
  });

  it('reads nothing without a reader', async () => {
    const library = new GameEntityModelLibrary();
    expect(library.templateRead(MODEL_PATH)).toBeNull();
    await library.idle();
    expect(library.templateRead(MODEL_PATH)).toBeNull();
  });

  it('drops a load that a new reader overtook and reads the model again through the new one', async () => {
    const files = new Map([
      [MODEL_PATH, gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(new THREE.Vector3(1, 1, 1)))],
    ]);
    const served = gameEntityModelTestReaderCreate(files);
    let gateRelease: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (gateRelease = resolve));
    const library = new GameEntityModelLibrary();
    const overtakenLoad = (async () => {
      library.readerSet(async (path) => (await gate, served.reader(path)));
      library.templateRead(MODEL_PATH);
      return library.idle();
    })();
    const epochBefore = library.readerEpoch();
    const empty = gameEntityModelTestReaderCreate(new Map());
    library.readerSet(empty.reader);
    gateRelease();
    await overtakenLoad;
    expect(library.readerEpoch()).not.toBe(epochBefore);
    expect(library.templateRead(MODEL_PATH)).toBeNull();
    await library.idle();
    expect(empty.reads).toEqual([MODEL_PATH]);
    expect(library.failureRead(MODEL_PATH)).not.toBeNull();
  });
});
