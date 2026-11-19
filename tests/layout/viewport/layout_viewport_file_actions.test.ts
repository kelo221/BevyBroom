import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  LayoutViewportFileActions,
  type LayoutViewportFileActionsContext,
} from '@/layout/viewport/layout_viewport_file_actions.js';
import { CommandStack } from '@/commands/command_stack.js';
import type { DialogPromptShow } from '@/ui/dialog/dialog_prompt_fields.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import { formatKeyboardShortcut } from '@/settings/keyboard/keyboard_shortcut_format.js';
import { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';
import {
  SceneRecoveryStoreMemory,
  sceneRecoveryTestCommandCreate,
} from '../../scene_recovery/scene_recovery_test_support.js';
import {
  PROJECT_LEVEL_TEST_PROJECT_FILE,
  projectLevelActionsRigCreate,
  projectLevelRigProjectOpen,
} from '../../project/level/project_level_test_support.js';

/**
 * Builds a file actions context around a real scene IO handler and world,
 * sharing the handler and world with a project level rig.
 *
 * @param worldObject World root the actions act on.
 * @returns Context without settings or solid tools, and the level rig.
 */
function contextCreate(worldObject: THREE.Group): LayoutViewportFileActionsContext & {
  levelRig: ReturnType<typeof projectLevelActionsRigCreate>;
} {
  const levelRig = projectLevelActionsRigCreate(worldObject);
  return {
    toolbarContainer: document.createElement('div'),
    sceneIOHandler: levelRig.context.sceneIOHandler,
    worldObject,
    commandStack: new CommandStack(16),
    statusBar: null,
    solidModelController: null,
    settingsStore: null,
    ensureSettingsSystem: vi.fn(),
    onSceneLoaded: vi.fn(),
    refreshAfterWorldMutation: vi.fn(),
    sceneRecoveryRead: () => null,
    projectLevelActionsRead: () => levelRig.actions,
    levelRig,
  };
}

/**
 * Makes the level name prompt of a context answer with a fixed name.
 *
 * @param context File actions context whose level rig shows the prompt.
 * @param name Name the prompt answers with, or null to cancel it.
 * @returns The prompt mock.
 */
function levelNamePromptAnswer(
  context: ReturnType<typeof contextCreate>,
  name: string | null,
): ReturnType<typeof vi.fn<DialogPromptShow>> {
  const prompt = vi.fn<DialogPromptShow>(async () => (name === null ? null : { name }));
  Object.assign(context.levelRig.context, { levelNamePromptShow: prompt });
  return prompt;
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
    expect(saveAs).toHaveBeenCalledWith(secondContext.worldObject, null, null);
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

  it('writes Save back into the open project level once one is open', async () => {
    const context = contextCreate(new THREE.Group());
    const actions = new LayoutViewportFileActions(() => context);
    await projectLevelRigProjectOpen(context.levelRig);
    const saveDialog = vi.spyOn(context.sceneIOHandler, 'saveScene').mockResolvedValue('dialog.json');
    await context.levelRig.actions.levelSaveAsNew('Hall');
    expect(await actions.sceneSave()).toBe('hall.json');
    expect(saveDialog).not.toHaveBeenCalled();
    const documents = context.levelRig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE);
    expect(documents.has('hall.json')).toBe(true);
  });

  it('makes New inside a project a named level that is saved into the project at once', async () => {
    const context = contextCreate(new THREE.Group());
    const prompt = levelNamePromptAnswer(context, 'Rooftop');
    const actions = new LayoutViewportFileActions(() => context);
    await projectLevelRigProjectOpen(context.levelRig);
    const saveDialog = vi.spyOn(context.sceneIOHandler, 'saveScene');
    actions.sceneNew();
    await vi.waitFor(() => expect(context.levelRig.service.openLevelRead()?.name).toBe('rooftop'));
    expect(prompt).toHaveBeenCalledOnce();
    const document = context.levelRig.service.openLevelRead()?.document ?? '';
    const documents = context.levelRig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE);
    expect(documents.has(document)).toBe(true);
    expect(await actions.sceneSave()).toBe(document);
    expect(saveDialog).not.toHaveBeenCalled();
  });

  it('keeps the scene when New inside a project is cancelled at the name prompt', async () => {
    const context = contextCreate(new THREE.Group());
    levelNamePromptAnswer(context, null);
    const actions = new LayoutViewportFileActions(() => context);
    await projectLevelRigProjectOpen(context.levelRig);
    const keptObject = new THREE.Group();
    context.worldObject.add(keptObject);
    actions.sceneNew();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.worldObject.children).toEqual([keptObject]);
    expect(context.levelRig.service.openLevelRead()).toBeNull();
  });

  it('saves an unsaved scene inside a project as a new project level instead of asking for a file', async () => {
    const context = contextCreate(new THREE.Group());
    levelNamePromptAnswer(context, 'Loading Dock');
    const actions = new LayoutViewportFileActions(() => context);
    await projectLevelRigProjectOpen(context.levelRig);
    const saveDialog = vi.spyOn(context.sceneIOHandler, 'saveScene');
    const document = await actions.sceneSave();
    expect(saveDialog).not.toHaveBeenCalled();
    expect(document).not.toBeNull();
    expect(context.levelRig.service.openLevelRead()?.document).toBe(document);
    const documents = context.levelRig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE);
    expect(documents.has(document ?? '')).toBe(true);
  });

  it('asks for a file on Save outside a project and opens Save As in the project level folder', async () => {
    const context = contextCreate(new THREE.Group());
    const actions = new LayoutViewportFileActions(() => context);
    const saveDialog = vi.spyOn(context.sceneIOHandler, 'saveScene').mockResolvedValue('dialog.json');
    expect(await actions.sceneSave()).toBe('dialog.json');
    await projectLevelRigProjectOpen(context.levelRig);
    const saveAs = vi.spyOn(context.sceneIOHandler, 'saveSceneAs').mockResolvedValue('copy.json');
    await actions.sceneSaveAs();
    const documentDirectory = context.levelRig.service.listStateRead().documentDirectory;
    expect(documentDirectory).not.toBeNull();
    expect(saveAs).toHaveBeenCalledWith(context.worldObject, null, documentDirectory);
    expect(saveDialog).toHaveBeenCalledOnce();
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
