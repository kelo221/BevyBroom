import { describe, expect, it } from 'vitest';
import { levelBuildGlbMaterialIdsRead } from '@/level_build/package/level_build_glb_material_reader.js';
import { MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY } from '@/materials/identity/material_identity.js';
import { levelBuildTestGlbFromDocument } from '../level_build_test_glb.js';

/**
 * Creates a glTF material entry carrying a game material id.
 *
 * @param identifier Game material id.
 * @returns GlTF material.
 */
function materialWithIdentity(identifier: string): Record<string, unknown> {
  return { name: identifier, extras: { [MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY]: identifier } };
}

/** Unit tests for reading the game material ids a GLB ships. */
describe('levelBuildGlbMaterialIdsRead', () => {
  it('returns each material id once, sorted', () => {
    const glb = levelBuildTestGlbFromDocument({
      asset: { version: '2.0' },
      materials: [
        materialWithIdentity('walls/stone'),
        materialWithIdentity('floors/oak'),
        materialWithIdentity('walls/stone'),
      ],
    });
    expect(levelBuildGlbMaterialIdsRead(glb)).toEqual(['floors/oak', 'walls/stone']);
  });

  it('skips materials without a game id', () => {
    const glb = levelBuildTestGlbFromDocument({ asset: { version: '2.0' }, materials: [{ name: 'plain' }] });
    expect(levelBuildGlbMaterialIdsRead(glb)).toEqual([]);
  });

  it('returns nothing for bytes that are not a binary glTF file', () => {
    expect(levelBuildGlbMaterialIdsRead(new Uint8Array(4))).toEqual([]);
    expect(levelBuildGlbMaterialIdsRead(new Uint8Array(40))).toEqual([]);
  });
});
