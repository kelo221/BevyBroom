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
  };
}

/**
 * The layout's File menu actions read the current editor parts every time they
 * run.
 */
describe('LayoutViewportFileActions', () => {
  it('saves and saves as the world that is current when the action runs', () => {
    const firstContext = contextCreate(new THREE.Group());
    const secondContext = contextCreate(new THREE.Group());
    let currentContext = firstContext;
    const actions = new LayoutViewportFileActions(() => currentContext);
    currentContext = secondContext;
    const saveAs = vi.spyOn(secondContext.sceneIOHandler, 'saveSceneAs').mockResolvedValue();
    const save = vi.spyOn(secondContext.sceneIOHandler, 'saveScene').mockResolvedValue();
    actions.sceneSaveAs();
    actions.sceneSave();
    expect(saveAs).toHaveBeenCalledWith(secondContext.worldObject, null);
    expect(save).toHaveBeenCalledWith(secondContext.worldObject, null);
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
