import { describe, expect, it } from 'vitest';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { TOOL_RAIL_CATALOG_ORDER } from '@/tools/chrome/rail/tool_rail_catalog.js';
import { toolInstructionForEditorTool } from '@/tools/chrome/instruction/tool_instruction_catalog.js';
import { IconHammerCatalog } from '@/ui/icons/hammer/icon_hammer_catalog.js';

describe('TOOL_RAIL_CATALOG_ORDER', () => {
  it('lists every Hammer++ and BevyBroom rail tool in order without Magnify or Camera', () => {
    const ids = TOOL_RAIL_CATALOG_ORDER.map((entry) => entry.id);
    expect(ids).toEqual([
      EditorToolId.OBJECT,
      EditorToolId.ENTITY,
      EditorToolId.BLOCK,
      EditorToolId.FACE,
      EditorToolId.STAMP,
      EditorToolId.CLIP_PLANE,
      EditorToolId.VERTEX,
      EditorToolId.POLYGON,
      EditorToolId.SPRINKLE,
      EditorToolId.GRID,
    ]);
  });

  it('gives every tool its own catalog icon and a tooltip instruction', () => {
    const iconNames = TOOL_RAIL_CATALOG_ORDER.map((entry) => entry.iconName);
    expect(new Set(iconNames).size).toBe(iconNames.length);
    for (const entry of TOOL_RAIL_CATALOG_ORDER) {
      expect(IconHammerCatalog.namesRead()).toContain(entry.iconName);
      const instruction = toolInstructionForEditorTool(entry.id);
      expect(instruction.title.length).toBeGreaterThan(0);
      expect(instruction.description.length).toBeGreaterThan(0);
    }
  });
});
