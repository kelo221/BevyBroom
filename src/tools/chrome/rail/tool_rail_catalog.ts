import { EditorToolId } from '@/types/editor_tool_id.js';
import { ToolbarIcons } from '@/ui/toolbar/toolbar_icons.js';
import { ToolbarIconsHammer } from '@/ui/toolbar/toolbar_icons_hammer.js';

/** Metadata for one tool button shown on the tool rail and left palette. */
export interface ToolRailCatalogEntry {
  readonly id: EditorToolId;
  readonly iconSvgRead: () => string;
  readonly allowedInEditMode: boolean;
}

/**
 * Primary editor tools in Hammer++ left-palette order (excluding Magnify and
 * Camera).
 */
export const TOOL_RAIL_CATALOG_ORDER: readonly ToolRailCatalogEntry[] = [
  { id: EditorToolId.OBJECT, iconSvgRead: () => ToolbarIcons.toolObjectSelect(), allowedInEditMode: true },
  { id: EditorToolId.ENTITY, iconSvgRead: () => ToolbarIconsHammer.toolEntity(), allowedInEditMode: false },
  { id: EditorToolId.BLOCK, iconSvgRead: () => ToolbarIconsHammer.toolBlock(), allowedInEditMode: false },
  { id: EditorToolId.FACE, iconSvgRead: () => ToolbarIcons.toolFaceSelect(), allowedInEditMode: false },
  { id: EditorToolId.STAMP, iconSvgRead: () => ToolbarIconsHammer.toolTextureStamp(), allowedInEditMode: false },
  { id: EditorToolId.CLIP_PLANE, iconSvgRead: () => ToolbarIcons.toolClipPlane(), allowedInEditMode: false },
  { id: EditorToolId.VERTEX, iconSvgRead: () => ToolbarIconsHammer.toolVertex(), allowedInEditMode: true },
  { id: EditorToolId.POLYGON, iconSvgRead: () => ToolbarIconsHammer.toolPolygon(), allowedInEditMode: false },
  { id: EditorToolId.SPRINKLE, iconSvgRead: () => ToolbarIconsHammer.toolSprinkle(), allowedInEditMode: false },
  { id: EditorToolId.GRID, iconSvgRead: () => ToolbarIcons.toolGrid(), allowedInEditMode: false },
];
