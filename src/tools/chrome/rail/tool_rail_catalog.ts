import { EditorToolId } from '@/types/editor_tool_id.js';
import type { IconHammerName } from '@/ui/icons/hammer/icon_hammer_catalog.js';

/** Metadata for one tool button shown on the tool rail and left palette. */
export interface ToolRailCatalogEntry {
  readonly id: EditorToolId;
  readonly iconName: IconHammerName;
  readonly allowedInEditMode: boolean;
}

/**
 * Primary editor tools in Hammer++ left-palette order (excluding Magnify and
 * Camera).
 */
export const TOOL_RAIL_CATALOG_ORDER: readonly ToolRailCatalogEntry[] = [
  { id: EditorToolId.OBJECT, iconName: 'tool_selection', allowedInEditMode: true },
  { id: EditorToolId.ENTITY, iconName: 'tool_entity', allowedInEditMode: false },
  { id: EditorToolId.BLOCK, iconName: 'tool_block', allowedInEditMode: false },
  { id: EditorToolId.FACE, iconName: 'tool_texture_application', allowedInEditMode: false },
  { id: EditorToolId.STAMP, iconName: 'tool_texture_apply', allowedInEditMode: false },
  { id: EditorToolId.CLIP_PLANE, iconName: 'tool_clip', allowedInEditMode: false },
  { id: EditorToolId.VERTEX, iconName: 'tool_vertex', allowedInEditMode: true },
  { id: EditorToolId.POLYGON, iconName: 'tool_polygon', allowedInEditMode: false },
  { id: EditorToolId.SPRINKLE, iconName: 'tool_sprinkle', allowedInEditMode: false },
  { id: EditorToolId.GRID, iconName: 'tool_grid', allowedInEditMode: false },
];
