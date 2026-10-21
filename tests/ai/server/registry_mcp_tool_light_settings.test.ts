import { describe, it, expect } from 'vitest';
import { MCP_LIGHT_SETTINGS_DESCRIPTION } from '@/ai/server/registry_mcp_tool_light_settings.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { LIGHT_EFFECT_KINDS } from '@/light/model/features/light_settings_effect.js';
import { LIGHT_FOG_SHAPES } from '@/light/model/features/light_settings_fog.js';
import { LIGHT_SHIMMER_KINDS } from '@/light/model/features/light_settings_shimmer.js';
import {
  LIGHT_BOUNCE_COMPRESSIONS,
  LIGHT_ILLUMINATION_MODES,
  LIGHT_TRANSPARENCY_MODES,
} from '@/light/model/features/light_settings_baking.js';

/**
 * Reads the settings description of a tool's input schema.
 *
 * @param toolName Name of the listed tool.
 * @returns The description of its `settings` property.
 */
function toolSettingsDescriptionRead(toolName: string): string {
  const schema = findMcpTool(toolName)?.inputSchema as
    { properties?: { settings?: { description?: string } } } | undefined;
  return schema?.properties?.settings?.description ?? '';
}

/** Unit tests for the light settings description MCP clients read. */
describe('registry_mcp_tool_light_settings', () => {
  it('names every light setting the editor stores', () => {
    const settingKeys = Object.keys(lightSettingsCreateDefault('spot'));
    expect(settingKeys.length).toBeGreaterThan(10);
    const missingKeys = settingKeys.filter((key) => !MCP_LIGHT_SETTINGS_DESCRIPTION.includes(key));
    expect(missingKeys).toEqual([]);
  });

  it('lists every allowed value of each choice setting', () => {
    const choices = [
      ...LIGHT_EFFECT_KINDS,
      ...LIGHT_FOG_SHAPES,
      ...LIGHT_SHIMMER_KINDS,
      ...LIGHT_ILLUMINATION_MODES,
      ...LIGHT_TRANSPARENCY_MODES,
      ...LIGHT_BOUNCE_COMPRESSIONS,
    ];
    const missingChoices = choices.filter((choice) => !MCP_LIGHT_SETTINGS_DESCRIPTION.includes(`"${choice}"`));
    expect(missingChoices).toEqual([]);
  });

  it('is the settings description of the add and set light tools', () => {
    expect(toolSettingsDescriptionRead('add_light')).toBe(MCP_LIGHT_SETTINGS_DESCRIPTION);
    expect(toolSettingsDescriptionRead('set_light_settings')).toContain(MCP_LIGHT_SETTINGS_DESCRIPTION);
  });
});
