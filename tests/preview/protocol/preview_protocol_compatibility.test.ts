import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PREVIEW_PROTOCOL_VERSION } from '@/preview/protocol/preview_protocol_types.js';

/** Root of this repository. */
const REPOSITORY_ROOT = resolve(__dirname, '../../..');

/** The pinned combination of programs this editor is tested with. */
interface CompatibilityPin {
  preview_protocol: number;
  min_preview_protocol: number;
  bevy: string;
  companion: { checkout: string };
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
 * Reads a text file of a sibling checkout.
 *
 * @param checkout Checkout path relative to this repository.
 * @param filePath File path inside the checkout.
 * @returns File text, or null when the checkout is not present.
 */
function siblingFileRead(checkout: string, filePath: string): string | null {
  const absolutePath = resolve(REPOSITORY_ROOT, checkout, filePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null;
}

/**
 * The compatibility pin agrees with the editor and, when present, the companion
 * checkout.
 */
describe('compatibility.json', () => {
  it('pins the protocol this editor speaks', () => {
    const pin = compatibilityPinRead();
    expect(pin.preview_protocol).toBe(PREVIEW_PROTOCOL_VERSION);
    expect(pin.min_preview_protocol).toBeLessThanOrEqual(pin.preview_protocol);
    expect(pin.renderer.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('matches the protocol and Bevy version of the companion checkout', () => {
    const pin = compatibilityPinRead();
    const stateSource = siblingFileRead(pin.companion.checkout, 'crates/broom_bridge/src/protocol/state.rs');
    const helloSource = siblingFileRead(pin.companion.checkout, 'crates/broom_bridge/src/protocol/hello.rs');
    const cargoManifest = siblingFileRead(pin.companion.checkout, 'Cargo.toml');
    if (stateSource === null || helloSource === null || cargoManifest === null) {
      return;
    }
    expect(stateSource).toContain(`pub const PROTOCOL_VERSION: u32 = ${pin.preview_protocol};`);
    expect(helloSource).toContain(`pub const MIN_PROTOCOL_VERSION: u32 = ${pin.min_preview_protocol};`);
    expect(cargoManifest).toMatch(new RegExp(`bevy = \\{[^}]*version = "${pin.bevy.replace(/\./g, '\\.')}"`));
  });
});
