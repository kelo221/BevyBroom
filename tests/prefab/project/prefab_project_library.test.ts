import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { PrefabFileCodec } from '@/prefab/payload/prefab_file_codec.js';
import { PrefabProjectLibrary } from '@/prefab/project/prefab_project_library.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';
import { workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';

/**
 * Captures a box mesh as a prefab of a store, failing the test when nothing was
 * captured.
 *
 * @param store Catalog store.
 * @param name Prefab name.
 * @returns Captured prefab.
 */
function boxPrefabCapture(store: PrefabCatalogStore, name: string): PrefabTemplate {
  const world = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial());
  box.name = `${name} box`;
  world.add(box);
  const template = store.templateCapture(name, 'Store', [box]);
  if (template === null) throw new Error('the box can be captured');
  return template;
}

/**
 * Creates a project whose prefab directory holds the given files, a catalog and
 * a library over them.
 *
 * @param files Prefab file texts by file name; null names no prefab directory.
 * @returns The parts.
 */
function prefabLibraryRigCreate(files: Map<string, string> | null) {
  const rig = workbenchRigCreate();
  if (files !== null) {
    rig.control.projectDataFiles.set('prefabs', files);
  }
  const store = new PrefabCatalogStore();
  const consoleLog = new ConsoleLog();
  const focusTarget = new EventTarget();
  const library = new PrefabProjectLibrary({
    workbench: rig.workbench,
    control: rig.control,
    store,
    focusTarget,
    consoleLog: () => consoleLog,
  });
  return { rig, store, consoleLog, focusTarget, library };
}

/** Prefabs are files of the project, listed and placeable in every level. */
describe('PrefabProjectLibrary', () => {
  it('saves a created prefab as a JSON file that a new session lists again', async () => {
    const files = new Map<string, string>();
    const first = prefabLibraryRigCreate(files);
    await first.rig.workbench.projectOpen('/games/store/broom.project.json');
    await first.library.idle();
    const created = boxPrefabCapture(first.store, 'Shelf Row');
    first.store.templateAdd(created);
    await first.library.idle();
    const fileName = PrefabFileCodec.fileNameFromId(created.id);
    expect(JSON.parse(files.get(fileName) ?? 'null')).toMatchObject({ name: 'Shelf Row', category: 'Store' });
    first.library.dispose();
    const second = prefabLibraryRigCreate(files);
    await second.rig.workbench.projectOpen('/games/store/broom.project.json');
    await second.library.idle();
    const reloaded = second.store.templateFind(created.id);
    expect(reloaded?.name).toBe('Shelf Row');
    expect(reloaded?.payload).toEqual(JSON.parse(JSON.stringify(created.payload)));
    expect(second.store.placementPayloadRead(created.id)?.objects.length).toBe(created.payload.objects.length);
  });

  it('deletes the file of a deleted prefab', async () => {
    const files = new Map<string, string>();
    const { rig, store, library } = prefabLibraryRigCreate(files);
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    const created = boxPrefabCapture(store, 'Crate');
    store.templateAdd(created);
    await library.idle();
    store.templateRemove(created.id);
    await library.idle();
    expect(files.has(PrefabFileCodec.fileNameFromId(created.id))).toBe(false);
  });

  it('shows prefab files written by other programs when the window gains focus and reports broken ones', async () => {
    const files = new Map<string, string>();
    const { rig, store, consoleLog, focusTarget, library } = prefabLibraryRigCreate(files);
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    const external = boxPrefabCapture(new PrefabCatalogStore(), 'Checkout');
    files.set('checkout.json', PrefabFileCodec.textWrite(external));
    files.set('broken.json', '{ "format": "something else" }');
    focusTarget.dispatchEvent(new Event('focus'));
    await library.idle();
    expect(store.templatesRead().map((template) => template.id)).toEqual(['checkout']);
    expect(consoleLog.entriesRead().some((entry) => entry.text.includes('broken.json'))).toBe(true);
  });

  it('keeps prefabs in memory only when the project names no prefab directory', async () => {
    const { rig, store, library } = prefabLibraryRigCreate(null);
    await rig.workbench.projectOpen('/games/plain/broom.project.json');
    await library.idle();
    const created = boxPrefabCapture(store, 'Loose');
    store.templateAdd(created);
    await library.idle();
    expect(store.isPersisted(created.id)).toBe(false);
    expect(rig.control.projectDataFiles.size).toBe(0);
  });
});
