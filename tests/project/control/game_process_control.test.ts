import { describe, expect, it } from 'vitest';
import {
  GAME_PROCESS_DESKTOP_ONLY_MESSAGE,
  GameProcessControlUnavailable,
} from '@/project/control/game_process_control.js';

/** Unit tests for the control of an editor that cannot manage games. */
describe('GameProcessControlUnavailable', () => {
  it('explains that project textures need the desktop app', async () => {
    const control = new GameProcessControlUnavailable();
    expect(await control.projectTextureList()).toEqual({ ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE });
    expect(await control.projectTextureRead()).toEqual({ ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE });
  });

  it('explains that project sprinkle definitions need the desktop app', async () => {
    const control = new GameProcessControlUnavailable();
    const desktopOnly = { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
    expect(await control.projectSprinkleDefinitionFilesRead()).toEqual(desktopOnly);
    expect(await control.projectSprinkleDefinitionOpen()).toEqual(desktopOnly);
  });
});
