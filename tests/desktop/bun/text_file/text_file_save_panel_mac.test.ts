import { describe, expect, it } from 'vitest';
import {
  textFileSavePanelMacExtensionEnsure,
  textFileSavePanelMacScriptBuild,
} from '@/desktop/bun/text_file/text_file_save_panel_mac.js';

describe('macOS save panel', () => {
  it('quotes the suggested name so quotes and backslashes cannot break the script', () => {
    const script = textFileSavePanelMacScriptBuild('my "big" \\ level.json');
    expect(script).toContain('default name "my \\"big\\" \\\\ level.json"');
    expect(script.startsWith('activate')).toBe(true);
  });

  it('adds the default extension only when the chosen name has none', () => {
    expect(textFileSavePanelMacExtensionEnsure('/levels/store', 'json')).toBe('/levels/store.json');
    expect(textFileSavePanelMacExtensionEnsure('/levels/store.scene.json', 'json')).toBe('/levels/store.scene.json');
    expect(textFileSavePanelMacExtensionEnsure('/my.folder/store', 'json')).toBe('/my.folder/store.json');
  });
});
