import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  LayoutViewportFileActions,
  type LayoutViewportFileActionsContext,
} from '@/layout/viewport/layout_viewport_file_actions.js';
import { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import { CommandStack } from '@/commands/command_stack.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import { formatKeyboardShortcut } from '@/settings/keyboard/keyboard_shortcut_format.js';
import { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';
import {
  SceneRecoveryStoreMemory,
  sceneRecoveryTestCommandCreate,
} from '../../scene_recovery/scene_recovery_test_support.js';

/**
 * Builds a file actions context around a real scene IO handler and world.
 *
 * @param worldObject World root the actions act on.
 * @returns Context without settings or solid tools.
 */
function contextCreate(worldObject: THREE.Group): LayoutViewportFileActionsContext {
  return {
    toolbarContainer: document.createElement('div'),
    sceneIOHandler: new HandlerSceneIo(),
    worldObject,
    commandStack: new CommandStack(16),
    statusBar: null,
    solidModelController: null,
    settingsStore: null,
    ensureSettingsSystem: vi.fn(),
    onSceneLoaded: vi.fn(),
    refreshAfterWorldMutation: vi.fn(),
    sceneRecoveryRead: () => null,
  };
}

/**
 * The layout's File menu actions read the current editor parts every time they
 * run.
 */
describe('LayoutViewportFileActions', () => {
  it('saves and saves as the world that is current when the action runs', async () => {
    const firstContext = contextCreate(new THREE.Group());
    const secondContext = contextCreate(new THREE.Group());
    let currentContext = firstContext;
    const actions = new LayoutViewportFileActions(() => currentContext);
    currentContext = secondContext;
    const saveAs = vi.spyOn(secondContext.sceneIOHandler, 'saveSceneAs').mockResolvedValue('copy.json');
    const save = vi.spyOn(secondContext.sceneIOHandler, 'saveScene').mockResolvedValue('level.json');
    expect(await actions.sceneSaveAs()).toBe('copy.json');
    expect(await actions.sceneSave()).toBe('level.json');
    expect(saveAs).toHaveBeenCalledWith(secondContext.worldObject, null);
    expect(save).toHaveBeenCalledWith(secondContext.worldObject, null, expect.any(Function));
  });

  it('counts the scene as saved only after a save wrote its file', async () => {
    const context = contextCreate(new THREE.Group());
    const recovery = new SystemSceneRecovery({
      host: context.toolbarContainer,
      commandStack: context.commandStack,
      worldObject: context.worldObject,
      sceneIOHandler: context.sceneIOHandler,
      statusBar: null,
      onSceneLoaded: () => undefined,
      store: new SceneRecoveryStoreMemory(),
      windowObject: null,
    });
    const actions = new LayoutViewportFileActions(() => ({ ...context, sceneRecoveryRead: () => recovery }));
    context.commandStack.push(sceneRecoveryTestCommandCreate());
    const save = vi.spyOn(context.sceneIOHandler, 'saveScene').mockResolvedValue(null);
    await actions.sceneSave();
    expect(recovery.tracker.hasUnsavedChanges()).toBe(true);
    save.mockResolvedValue('level.json');
    await actions.sceneSave();
    expect(recovery.tracker.hasUnsavedChanges()).toBe(false);
    recovery.dispose();
  });

  it('labels Save As with its own default shortcut, distinct from Save', () => {
    const actions = new LayoutViewportFileActions(() => contextCreate(new THREE.Group()));
    const defaults = createDefaultKeyboardShortcutSettings();
    expect(actions.shortcutLabelRead('save_as')).toBe(formatKeyboardShortcut(defaults.save_as));
    expect(actions.shortcutLabelRead('save_as')).not.toBe(actions.shortcutLabelRead('save'));
  });

  it('creates the settings system before exporting so the game profile is used', () => {
    const context = contextCreate(new THREE.Group());
    const exportGlb = vi.spyOn(context.sceneIOHandler, 'exportGlb').mockResolvedValue();
    new LayoutViewportFileActions(() => context).exportGlb();
    expect(context.ensureSettingsSystem).toHaveBeenCalledOnce();
    expect(exportGlb).toHaveBeenCalledWith(context.worldObject, null, null);
  });
});
