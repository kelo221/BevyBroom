import {
  PREVIEW_PLACEABLE_COLLISION_KINDS,
  type PreviewAuthoredComponents,
  type PreviewPlaceableCollisionKind,
} from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Version of the `collision.json` format; raised on breaking changes. */
export const COLLISION_FILE_VERSION = 1;

/** File name of the collision document in a level package. */
export const COLLISION_FILE_NAME = 'collision.json';

/** How the game treats an object's collision pieces. */
export type CollisionKind = PreviewPlaceableCollisionKind;

/** Every collision kind, the default first. */
export const COLLISION_KINDS: readonly CollisionKind[] = PREVIEW_PLACEABLE_COLLISION_KINDS;

/** A point or direction as `[x, y, z]`. */
export type CollisionVector3 = [number, number, number];

/**
 * One bounding plane of a convex piece: `normal · p = distance` on the plane,
 * normal pointing out.
 */
export interface CollisionPlane {
  normal: CollisionVector3;
  distance: number;
  /**
   * Texture of the face on this plane, empty when no face of a brush lies on
   * it.
   */
  texture: string;
}

/** The object a piece or a flagged part came from. */
export interface CollisionSource {
  /**
   * Editor id of the object (the solid model or the plain mesh), stable across
   * saves.
   */
  object_id: string;
  object_name: string;
  /**
   * Id and name of the brush the piece was cut from; empty for an inverted
   * world's bounds and for plain meshes.
   */
  brush_id: string;
  brush_name: string;
  kind: CollisionKind;
  /** The object's game components with every field resolved. */
  components: PreviewAuthoredComponents;
}

/**
 * One convex piece of a solid model's final CSG result or of a convex plain
 * mesh, in world space.
 */
export interface CollisionPieceRecord extends CollisionSource {
  planes: CollisionPlane[];
  vertices: CollisionVector3[];
}

/** Why a part is not given as convex pieces. */
export type CollisionFlaggedReason = 'displacement' | 'non_convex_brush' | 'non_convex_mesh';

/**
 * A part of the level that is not convex, given as triangles so a game can
 * refuse or mesh it.
 */
export interface CollisionFlaggedRecord extends CollisionSource {
  reason: CollisionFlaggedReason;
  vertices: CollisionVector3[];
  /** Vertex index triples. */
  triangles: [number, number, number][];
}

/** Where an object is placed: what it is. */
export type PlacementKind = 'game_entity' | 'procedural' | 'object';

/** The generator data of a placed procedural object. */
export interface PlacementProcedural {
  generator: string;
  version: number;
  parameters: Record<string, unknown>;
  derived: Record<string, unknown>;
  /** Derived values that are points, in world space, by name. */
  derived_points_world: Record<string, CollisionVector3>;
}

/**
 * One object the game places: a game entity, a procedural object or any object
 * carrying game components.
 */
export interface PlacementRecord {
  object_id: string;
  name: string;
  kind: PlacementKind;
  position: CollisionVector3;
  /** World rotation as a quaternion `[x, y, z, w]`. */
  rotation: [number, number, number, number];
  scale: CollisionVector3;
  /** Game components with every field of a known class resolved. */
  components: PreviewAuthoredComponents;
  procedural?: PlacementProcedural;
}

/**
 * The collision document of one level: convex pieces, flagged parts and
 * placements.
 */
export interface CollisionDocument {
  collision_version: number;
  level_name: string;
  pieces: CollisionPieceRecord[];
  flagged: CollisionFlaggedRecord[];
  placements: PlacementRecord[];
}
