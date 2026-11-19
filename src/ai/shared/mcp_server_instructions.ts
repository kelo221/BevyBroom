import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

/**
 * Rules every AI client must follow when it edits a level, sent as the MCP
 * initialize instructions.
 */
export const MCP_SERVER_INSTRUCTIONS = [
  'BevyBroom level editing rules (hard rules):',
  `1. Stay on the grid. The bounds of every brush and mesh must start and end on the ${GRID_INTERVAL_MINIMUM} m grid; prefer the level's current grid (get_snap_settings). A tool call that leaves new geometry off the grid is undone and fails.`,
  '2. Build level geometry from brushes (add_box_brush, create_shape_brush, place_wall, add_room_shell). Do not create mesh objects for level geometry.',
  '3. Make slopes with create_shape_brush shapeId "ramp" (or clip_brush through grid points), not by rotating brushes to odd angles. Turn brushes in 90 degree steps.',
  '4. Before finishing, call issues_list and fix every "Off-grid geometry" issue you caused.',
].join('\n');
