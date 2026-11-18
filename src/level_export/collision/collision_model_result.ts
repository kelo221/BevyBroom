import type {
  CollisionFlaggedReason,
  CollisionPlane,
  CollisionVector3,
} from '@/level_export/collision/collision_types.js';

/** One convex piece of an object, before the object's own data is added. */
export interface CollisionModelPiece {
  brush_id: string;
  brush_name: string;
  planes: CollisionPlane[];
  vertices: CollisionVector3[];
}

/** One part of an object that is not given as convex pieces. */
export interface CollisionModelFlagged {
  brush_id: string;
  brush_name: string;
  reason: CollisionFlaggedReason;
  vertices: CollisionVector3[];
  triangles: [number, number, number][];
}

/** Collision of one object: a solid model or a plain content mesh. */
export interface CollisionModelResult {
  pieces: CollisionModelPiece[];
  flagged: CollisionModelFlagged[];
}
