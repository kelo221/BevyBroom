import { afterEach, describe, expect, it } from 'vitest';
import { SceneRecoveryStoreWebStorage } from '@/scene_recovery/store/scene_recovery_store_web_storage.js';
import {
  SCENE_RECOVERY_SNAPSHOT_VERSION,
  sceneRecoverySnapshotCreate,
  sceneRecoverySnapshotParse,
} from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';

const TEST_STORAGE_KEY = 'bevybroom.scene_recovery.test';

/**
 * The web storage recovery store keeps one snapshot, refuses unreadable data,
 * and reports a storage that refuses the write instead of throwing.
 */
describe('SceneRecoveryStoreWebStorage', () => {
  afterEach(() => window.localStorage.removeItem(TEST_STORAGE_KEY));

  it('keeps, replaces and clears one snapshot', () => {
    const store = new SceneRecoveryStoreWebStorage(window.localStorage, TEST_STORAGE_KEY);
    const first = sceneRecoverySnapshotCreate('{"objects":[]}', null, Date.now());
    const second = sceneRecoverySnapshotCreate('{"objects":[1]}', 'hall.json', first.savedAtMilliseconds + 1);
    expect(store.snapshotWrite(first)).toEqual({ ok: true });
    expect(store.snapshotWrite(second)).toEqual({ ok: true });
    expect(store.snapshotRead()).toEqual(second);
    store.snapshotClear();
    expect(store.snapshotRead()).toBeNull();
  });

  it('ignores stored text that is not a snapshot of the current format', () => {
    const store = new SceneRecoveryStoreWebStorage(window.localStorage, TEST_STORAGE_KEY);
    window.localStorage.setItem(TEST_STORAGE_KEY, 'not json');
    expect(store.snapshotRead()).toBeNull();
    const future = {
      ...sceneRecoverySnapshotCreate('{}', null, Date.now()),
      version: SCENE_RECOVERY_SNAPSHOT_VERSION + 1,
    };
    window.localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(future));
    expect(store.snapshotRead()).toBeNull();
    expect(sceneRecoverySnapshotParse(JSON.stringify({ version: SCENE_RECOVERY_SNAPSHOT_VERSION }))).toBeNull();
  });

  it('reports a refused write and keeps the previous snapshot', () => {
    const refusingStorage = Object.create(window.localStorage) as Storage;
    const store = new SceneRecoveryStoreWebStorage(window.localStorage, TEST_STORAGE_KEY);
    const kept = sceneRecoverySnapshotCreate('{"objects":[]}', null, Date.now());
    store.snapshotWrite(kept);
    refusingStorage.setItem = () => {
      throw new Error('quota exceeded');
    };
    const refusing = new SceneRecoveryStoreWebStorage(refusingStorage, TEST_STORAGE_KEY);
    const result = refusing.snapshotWrite(sceneRecoverySnapshotCreate('{"big":true}', null, Date.now()));
    expect(result).toEqual({ ok: false, message: 'quota exceeded' });
    expect(store.snapshotRead()).toEqual(kept);
  });

  it('reports that nothing is protected without storage', () => {
    const store = new SceneRecoveryStoreWebStorage(null, TEST_STORAGE_KEY);
    expect(store.snapshotWrite(sceneRecoverySnapshotCreate('{}', null, Date.now())).ok).toBe(false);
    expect(store.snapshotRead()).toBeNull();
  });
});
