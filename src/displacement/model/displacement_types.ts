/**
 * Subdivision power of a displacement: the grid has 2^power + 1 vertices per
 * side.
 */
export type DisplacementPower = 2 | 3 | 4;

/** Every subdivision power a displacement may use, smallest first. */
export const DISPLACEMENT_POWERS: readonly DisplacementPower[] = [2, 3, 4];

/** Largest alpha value a displacement vertex stores (texture blend weight). */
export const DISPLACEMENT_ALPHA_MAX = 255;

/** Viewport tool the Displacement tab routes presses to. */
export type DisplacementActiveTool = 'select' | 'paint_geometry' | 'paint_alpha';

/** Every displacement viewport tool, in panel order. */
export const DISPLACEMENT_ACTIVE_TOOLS: readonly DisplacementActiveTool[] = ['select', 'paint_geometry', 'paint_alpha'];

/** Viewport tool that paints onto displaced faces. */
export type DisplacementPaintTool = Exclude<DisplacementActiveTool, 'select'>;

/** Paint Geometry effect deciding how a dab moves offsets. */
export type DisplacementSculptEffect = 'raise_lower' | 'raise_to' | 'smooth' | 'flatten' | 'noise';

/** Every Paint Geometry effect, in panel order. */
export const DISPLACEMENT_SCULPT_EFFECTS: readonly DisplacementSculptEffect[] = [
  'raise_lower',
  'raise_to',
  'smooth',
  'flatten',
  'noise',
];

/** Direction a paint dab moves vertices along: the face normal or a world axis. */
export type DisplacementSculptAxis = 'face_normal' | 'x' | 'y' | 'z';

/** Every paint axis, in panel order. */
export const DISPLACEMENT_SCULPT_AXES: readonly DisplacementSculptAxis[] = ['face_normal', 'x', 'y', 'z'];

/**
 * Falloff of a paint dab: soft eases to the radius, hard is full strength
 * inside it.
 */
export type DisplacementSculptEdge = 'soft' | 'hard';

/** Every paint edge, in panel order. */
export const DISPLACEMENT_SCULPT_EDGES: readonly DisplacementSculptEdge[] = ['soft', 'hard'];

/** Collision behavior the game gives a displacement surface. */
export interface DisplacementCollisionFlags {
  /** The surface has no physics collision. */
  noPhysicsCollision: boolean;
  /** The surface does not block hulls (players and NPCs). */
  noHullCollision: boolean;
  /** The surface does not block ray traces. */
  noRayCollision: boolean;
  /** The surface seals the level against leaks. */
  seals: boolean;
}

/** Every collision flag key, in panel order. */
export const DISPLACEMENT_COLLISION_FLAG_KEYS: readonly (keyof DisplacementCollisionFlags)[] = [
  'noPhysicsCollision',
  'noHullCollision',
  'noRayCollision',
  'seals',
];

/**
 * Sculpted heightfield attached to one four-sided brush face. Vertex lists are
 * row-major: index = row * (2^power + 1) + column, column running from the
 * face's first corner to its second, row from the first corner to its fourth.
 */
export interface DisplacementFaceSurface {
  /** Subdivision power of the grid. */
  power: DisplacementPower;
  /** Distance in meters the whole surface sits above the face along its normal. */
  elevation: number;
  /** Multiplier applied to every vertex offset. */
  scale: number;
  /** Per-vertex distance in meters along the face normal, before scale. */
  offsets: number[];
  /**
   * Per-vertex 3D offset added after the normal offset, so sewn border vertices
   * of faces with different normals can meet exactly. Three numbers per vertex,
   * row-major, in the face frame: the share of the edge from the first corner
   * to the second, the share of the edge from the first corner to the fourth,
   * and meters along the face normal. The frame follows the face through every
   * brush transform. Absent when every seam offset is zero.
   */
  seamOffsets?: number[];
  /** Per-vertex texture blend alpha from 0 to DISPLACEMENT_ALPHA_MAX. */
  alphas: number[];
  /** Collision behavior the game gives the surface. */
  flags: DisplacementCollisionFlags;
}
