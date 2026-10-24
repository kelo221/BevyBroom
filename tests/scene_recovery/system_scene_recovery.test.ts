import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { Theme } from '@/theme.js';
import { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';
import { sceneRecoverySnapshotCreate } from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';
import { sceneRecoveryRestoreMessageBuild } from '@/scene_recovery/scene_recovery_restore_offer.js';
import { SceneRecoveryStoreMemory, sceneRecoveryTestCommandCreate } from './scene_recovery_test_support.js';

const systems: SystemSceneRecovery[] = [];

/**
 * Builds a recovery system over a real scene handler, world, history and status
 * bar, with an in-memory store.
 *
 * @returns System and the parts it works with.
 */
function systemRigCreate() {
  const host = document.createElement('div');
  const worldObject = new THREE.Group();
  const commandStack = new CommandStack(16);
  const sceneIOHandler = new HandlerSceneIo();
  const statusBar = new StatusBar(host, Theme);
  const store = new SceneRecoveryStoreMemory();
  const onSceneLoaded = vi.fn(() => commandStack.clear());
  const deps = {
    host,
    commandStack,
    worldObject,
    sceneIOHandler,
    statusBar,
    onSceneLoaded,
    store,
    windowObject: window,
  };
  const system = new SystemSceneRecovery({ ...deps, autosaveDelayMilliseconds: 60000 });
  systems.push(system);
  return { ...deps, system };
}

/**
 * Serializes a world holding one named mesh, as an earlier session would have
 * autosaved it.
 *
 * @param objectName Name of the mesh.
 * @returns Scene text.
 */
function sceneJsonWithObjectCreate(objectName: string): string {
  const world = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = objectName;
  world.add(mesh);
  return new HandlerSceneIo().sceneJsonBuild(world);
}

/**
 * Scene recovery as a whole: the status bar marks unsaved work, closing the
 * window writes the pending autosave, and kept work is offered back, restored
 * as an unsaved document, or discarded.
 */
describe('SystemSceneRecovery', () => {
  afterEach(() => systems.splice(0).forEach((system) => system.dispose()));

  it('marks unsaved work in the status bar and clears the mark once saved', () => {
    const rig = systemRigCreate();
    expect(rig.statusBar.isUnsavedChangesShown()).toBe(false);
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    expect(rig.statusBar.isUnsavedChangesShown()).toBe(true);
    rig.system.savedStateAdopt();
    expect(rig.statusBar.isUnsavedChangesShown()).toBe(false);
  });

  it('writes the pending autosave when the window is closing', () => {
    const rig = systemRigCreate();
    rig.worldObject.add(new THREE.Group());
    rig.commandStack.push(sceneRecoveryTestCommandCreate());
    window.dispatchEvent(new Event('pagehide'));
    expect(rig.store.snapshot?.sceneJson).toBe(rig.sceneIOHandler.sceneJsonBuild(rig.worldObject));
  });

  it('restores kept work as an unsaved document and keeps protecting it', async () => {
    const rig = systemRigCreate();
    rig.store.snapshot = sceneRecoverySnapshotCreate(sceneJsonWithObjectCreate('KeptCrate'), 'hall.json', Date.now());
    expect(await rig.system.restoreOffer(async () => true)).toBe('restored');
    expect(rig.worldObject.getObjectByName('KeptCrate')).toBeDefined();
    expect(rig.system.tracker.hasUnsavedChanges()).toBe(true);
    expect(rig.statusBar.isUnsavedChangesShown()).toBe(true);
    expect(rig.store.snapshot).not.toBeNull();
  });

  it('deletes kept work when the user discards it', async () => {
    const rig = systemRigCreate();
    rig.store.snapshot = sceneRecoverySnapshotCreate(sceneJsonWithObjectCreate('Dropped'), null, Date.now());
    expect(await rig.system.restoreOffer(async () => false)).toBe('discarded');
    expect(rig.store.snapshot).toBeNull();
    expect(rig.worldObject.getObjectByName('Dropped')).toBeUndefined();
  });

  it('keeps kept work that does not load, and offers nothing when none is kept', async () => {
    const rig = systemRigCreate();
    expect(await rig.system.restoreOffer(async () => true)).toBe('none');
    rig.store.snapshot = sceneRecoverySnapshotCreate('{"broken":', null, Date.now());
    expect(await rig.system.restoreOffer(async () => true)).toBe('failed');
    expect(rig.store.snapshot).not.toBeNull();
  });

  it('names the document and the restore and discard choices in the question', () => {
    const host = document.createElement('div');
    const message = sceneRecoveryRestoreMessageBuild(host, sceneRecoverySnapshotCreate('{}', 'hall.json', Date.now()));
    expect(message.message).toContain('hall.json');
    expect([message.confirmLabel, message.cancelLabel]).toEqual(['Restore', 'Discard']);
  });
});
