import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { ClipboardEditCommands } from '@/clipboard/controller/clipboard_edit_commands.js';
import { ClipboardSystemAccess, type ClipboardSystemTextApi } from '@/clipboard/system/clipboard_system_access.js';
import { clipboardTestSelect, clipboardTestWorldCreate, type ClipboardTestWorld } from '../clipboard_test_world.js';

/** System clipboard stand-in that keeps text, or refuses every call. */
class ClipboardTestSystemApi implements ClipboardSystemTextApi {
  text = '';

  /**
   * Creates the stand-in.
   *
   * @param isDenied Whether every call is refused like a webview without
   *   permission.
   */
  constructor(private readonly isDenied: boolean) {}

  /**
   * Returns the kept text.
   *
   * @returns Kept text.
   */
  async readText(): Promise<string> {
    if (this.isDenied) {
      throw new Error('denied');
    }
    return this.text;
  }

  /**
   * Keeps text.
   *
   * @param text Text to keep.
   */
  async writeText(text: string): Promise<void> {
    if (this.isDenied) {
      throw new Error('denied');
    }
    this.text = text;
  }
}

/**
 * Adds a selected light to a test world.
 *
 * @param testWorld Test world.
 * @returns The light.
 */
function selectedLightAdd(testWorld: ClipboardTestWorld): THREE.Object3D {
  const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
  light.position.set(2, 1, 0);
  testWorld.world.add(light);
  clipboardTestSelect(testWorld, [light]);
  return light;
}

/**
 * Edit menu clipboard commands over the system clipboard with an in-app
 * fallback.
 */
describe('ClipboardEditCommands', () => {
  it('copies to the system clipboard and pastes from it', async () => {
    const testWorld = clipboardTestWorldCreate();
    const systemApi = new ClipboardTestSystemApi(false);
    const commands = new ClipboardEditCommands(testWorld.controller, new ClipboardSystemAccess(() => systemApi));
    selectedLightAdd(testWorld);
    expect(commands.selectionHasObjectsIs()).toBe(true);
    await commands.copy();
    expect(systemApi.text).toBe(testWorld.controller.lastCopiedTextRead());
    await commands.pasteAtOriginalPosition();
    expect(testWorld.world.children.filter((child) => LightOwner.settingsRead(child) !== null)).toHaveLength(2);
  });

  it('pastes the text copied last when the system clipboard is denied', async () => {
    const testWorld = clipboardTestWorldCreate();
    const commands = new ClipboardEditCommands(
      testWorld.controller,
      new ClipboardSystemAccess(() => new ClipboardTestSystemApi(true)),
    );
    const light = selectedLightAdd(testWorld);
    await commands.cut();
    expect(light.parent).toBeNull();
    await commands.paste();
    expect(testWorld.world.children.filter((child) => LightOwner.settingsRead(child) !== null)).toHaveLength(1);
  });

  it('pastes the text copied last when there is no system clipboard', async () => {
    const testWorld = clipboardTestWorldCreate();
    const commands = new ClipboardEditCommands(testWorld.controller, new ClipboardSystemAccess(() => null));
    selectedLightAdd(testWorld);
    await commands.copy();
    await commands.paste();
    expect(testWorld.commandStack.canUndo()).toBe(true);
  });

  it('does nothing when there is neither a system clipboard nor copied text', async () => {
    const testWorld = clipboardTestWorldCreate();
    const commands = new ClipboardEditCommands(testWorld.controller, new ClipboardSystemAccess(() => null));
    await commands.paste();
    expect(testWorld.commandStack.canUndo()).toBe(false);
    expect(testWorld.statusMessages).toEqual([]);
  });
});
