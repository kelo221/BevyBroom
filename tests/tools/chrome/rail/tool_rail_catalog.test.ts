import { describe, expect, it } from 'vitest';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { TOOL_RAIL_CATALOG_ORDER } from '@/tools/chrome/rail/tool_rail_catalog.js';
import { toolInstructionForEditorTool } from '@/tools/chrome/instruction/tool_instruction_catalog.js';

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

  it('provides non-empty SVG icons and tooltip instructions for every tool id', () => {
    for (const entry of TOOL_RAIL_CATALOG_ORDER) {
      expect(entry.iconSvgRead()).toContain('<svg');
      const instruction = toolInstructionForEditorTool(entry.id);
      expect(instruction.title.length).toBeGreaterThan(0);
      expect(instruction.description.length).toBeGreaterThan(0);
    }
  });
});
