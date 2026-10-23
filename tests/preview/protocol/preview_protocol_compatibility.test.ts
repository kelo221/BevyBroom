import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PREVIEW_PROTOCOL_VERSION } from '@/preview/protocol/preview_protocol_types.js';

/** Root of this repository. */
const REPOSITORY_ROOT = resolve(__dirname, '../../..');

/** The pinned combination of programs this editor is tested with. */
interface CompatibilityPin {
  preview_protocol: number;
  min_preview_protocol: number;
  bevy: string;
  companion: { path: string };
  renderer: { checkout: string; commit: string };
}

/**
 * Reads the pinned combination.
 *
 * @returns Parsed compatibility.json.
 */
function compatibilityPinRead(): CompatibilityPin {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, 'compatibility.json'), 'utf8')) as CompatibilityPin;
}

/**
 * Reads a text file of the game bridge workspace.
 *
 * @param workspacePath Workspace path relative to this repository.
 * @param filePath File path inside the workspace.
 * @returns File text.
 */
function companionFileRead(workspacePath: string, filePath: string): string {
  return readFileSync(resolve(REPOSITORY_ROOT, workspacePath, filePath), 'utf8');
}

/** The compatibility pin agrees with the editor and the game bridge workspace. */
describe('compatibility.json', () => {
  it('pins the protocol this editor speaks', () => {
    const pin = compatibilityPinRead();
    expect(pin.preview_protocol).toBe(PREVIEW_PROTOCOL_VERSION);
    expect(pin.min_preview_protocol).toBeLessThanOrEqual(pin.preview_protocol);
    expect(pin.renderer.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('matches the protocol and Bevy version of the game bridge workspace', () => {
    const pin = compatibilityPinRead();
    const stateSource = companionFileRead(pin.companion.path, 'crates/broom_bridge/src/protocol/state.rs');
    const helloSource = companionFileRead(pin.companion.path, 'crates/broom_bridge/src/protocol/hello.rs');
    const cargoManifest = companionFileRead(pin.companion.path, 'Cargo.toml');
    expect(stateSource).toContain(`pub const PROTOCOL_VERSION: u32 = ${pin.preview_protocol};`);
    expect(helloSource).toContain(`pub const MIN_PROTOCOL_VERSION: u32 = ${pin.min_preview_protocol};`);
    expect(cargoManifest).toMatch(new RegExp(`bevy = \\{[^}]*version = "${pin.bevy.replace(/\./g, '\\.')}"`));
  });
});
