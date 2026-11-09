import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SprinkleDialogMount } from '@/tools/sprinkle/ui/mount/sprinkle_dialog_mount.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import {
  sprinkleUiTestDefinitionCreate,
  sprinkleUiTestLibraryInstall,
  type SprinkleUiTestLoader,
  sprinkleUiTestReset,
  sprinkleUiTestServicesCreate,
} from '../sprinkle_ui_test_support.js';

/** Mount built by the running test. */
let sprinkleDialogMountTest: SprinkleDialogMount | null = null;

/** Recording loader of the library the running test installed. */
let sprinkleDialogMountTestLoader: SprinkleUiTestLoader;

beforeEach(() => {
  sprinkleUiTestReset();
  sprinkleDialogMountTestLoader = sprinkleUiTestLibraryInstall();
});

afterEach(() => {
  sprinkleDialogMountTest?.dispose();
  sprinkleDialogMountTest = null;
  sprinkleUiTestReset();
});

/** Entity Sprinkle window following the Sprinkle tool. */
describe('SprinkleDialogMount', () => {
  it('opens the window in its host while the Sprinkle tool is active and closes it otherwise', () => {
    const recorded = sprinkleUiTestServicesCreate(1);
    sprinkleDialogMountTest = new SprinkleDialogMount(document.body, recorded.services);
    const dialog = sprinkleDialogMountTest.dialog;
    expect(dialog.isOpen()).toBe(false);
    getStateSprinkleTool().toolActiveWrite(true);
    expect(dialog.isOpen()).toBe(true);
    expect(document.body.contains(dialog.getRootElement())).toBe(true);
    getStateSprinkleTool().configPatch({ densityPercent: 50 });
    expect(dialog.isOpen()).toBe(true);
    getStateSprinkleTool().toolActiveWrite(false);
    expect(dialog.isOpen()).toBe(false);
    expect(recorded.toolSelectExit).not.toHaveBeenCalled();
  });

  it('opens at once when the Sprinkle tool is already active', () => {
    getStateSprinkleTool().toolActiveWrite(true);
    sprinkleDialogMountTest = new SprinkleDialogMount(document.body, sprinkleUiTestServicesCreate(1).services);
    expect(sprinkleDialogMountTest.dialog.isOpen()).toBe(true);
  });

  it('requests the Select tool when the user closes the window and stays closed afterwards', () => {
    const recorded = sprinkleUiTestServicesCreate(1);
    sprinkleDialogMountTest = new SprinkleDialogMount(document.body, recorded.services);
    getStateSprinkleTool().toolActiveWrite(true);
    sprinkleDialogMountTest.dialog.getRootElement().querySelector<HTMLButtonElement>('button[title="Close"]')?.click();
    expect(recorded.toolSelectExit).toHaveBeenCalledOnce();
    expect(getStateSprinkleTool().toolActiveRead()).toBe(false);
    expect(sprinkleDialogMountTest.dialog.isOpen()).toBe(false);
  });

  it('reloads the sprinkle definitions each time the window opens and not on other tool changes', async () => {
    const reloaded = sprinkleUiTestDefinitionCreate('Reloaded', null);
    sprinkleDialogMountTestLoader.loadResult = { definitions: [reloaded], problems: [] };
    sprinkleDialogMountTest = new SprinkleDialogMount(document.body, sprinkleUiTestServicesCreate(1).services);
    expect(sprinkleDialogMountTestLoader.load).not.toHaveBeenCalled();
    getStateSprinkleTool().toolActiveWrite(true);
    getStateSprinkleTool().configPatch({ densityPercent: 50 });
    expect(sprinkleDialogMountTestLoader.load).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(getStateSprinkleDefinitionLibrary().definitionsRead()).toEqual([reloaded]));
    getStateSprinkleTool().toolActiveWrite(false);
    getStateSprinkleTool().toolActiveWrite(true);
    expect(sprinkleDialogMountTestLoader.load).toHaveBeenCalledTimes(2);
  });

  it('reloads the sprinkle definitions when it mounts with the tool already active', () => {
    getStateSprinkleTool().toolActiveWrite(true);
    sprinkleDialogMountTest = new SprinkleDialogMount(document.body, sprinkleUiTestServicesCreate(1).services);
    expect(sprinkleDialogMountTestLoader.load).toHaveBeenCalledOnce();
  });

  it('stops following the tool after dispose', () => {
    sprinkleDialogMountTest = new SprinkleDialogMount(document.body, sprinkleUiTestServicesCreate(1).services);
    const dialog = sprinkleDialogMountTest.dialog;
    sprinkleDialogMountTest.dispose();
    sprinkleDialogMountTest = null;
    getStateSprinkleTool().toolActiveWrite(true);
    expect(dialog.isOpen()).toBe(false);
  });
});
