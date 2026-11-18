//! The `collision.json` of a level package, written by the editor's level export (Build Level
//! and `bun scripts/level_export.ts`): the convex pieces of every solid model's final CSG result
//! in world space, the parts that are not convex, and the objects the game places itself. A game
//! builds its colliders, trigger volumes and spawns from it without reading the scene file.

use std::collections::BTreeMap;
use std::path::Path;

use bevy::prelude::*;
use serde::Deserialize;

pub use crate::protocol::PlaceableCollisionKind as CollisionKind;

/// File name of the collision document inside a level's directory.
pub const COLLISION_FILE_NAME: &str = "collision.json";

/// The collision format version this crate reads.
pub const COLLISION_FILE_VERSION: u32 = 1;

/// Component fields by type path, as the editor resolved them.
pub type CollisionComponents = BTreeMap<String, serde_json::Map<String, serde_json::Value>>;

/// One bounding plane of a piece: points `p` on it satisfy `normal · p = distance`, and the
/// normal points out of the piece.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct CollisionPlane {
    pub normal: [f32; 3],
    pub distance: f32,
    /// Texture of the face on this plane; empty when no brush face lies on it.
    pub texture: String,
}

/// One convex piece in world space.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct CollisionPiece {
    pub object_id: String,
    pub object_name: String,
    pub brush_id: String,
    pub brush_name: String,
    pub kind: CollisionKind,
    pub components: CollisionComponents,
    pub planes: Vec<CollisionPlane>,
    pub vertices: Vec<[f32; 3]>,
}

impl CollisionPiece {
    /// Whether `point` lies inside the piece or on its surface, within `tolerance` meters.
    pub fn contains(&self, point: Vec3, tolerance: f32) -> bool {
        self.planes
            .iter()
            .all(|plane| Vec3::from_array(plane.normal).dot(point) - plane.distance <= tolerance)
    }
}

/// A part that is not convex (a displaced surface, a non-convex brush or a non-convex mesh), as triangles.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct CollisionFlagged {
    pub object_id: String,
    pub object_name: String,
    pub brush_id: String,
    pub brush_name: String,
    pub kind: CollisionKind,
    pub components: CollisionComponents,
    /// `displacement`, `non_convex_brush` or `non_convex_mesh`.
    pub reason: String,
    pub vertices: Vec<[f32; 3]>,
    pub triangles: Vec<[u32; 3]>,
}

/// The generator data of a placed procedural object.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct CollisionPlacementProcedural {
    pub generator: String,
    pub version: u32,
    pub parameters: serde_json::Map<String, serde_json::Value>,
    pub derived: serde_json::Map<String, serde_json::Value>,
    /// Derived values that are points (such as a people mover's `low_end`), in world space.
    pub derived_points_world: BTreeMap<String, [f32; 3]>,
}

/// One object the game places: a game entity, a procedural object or an object with components.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct CollisionPlacement {
    pub object_id: String,
    pub name: String,
    /// `game_entity`, `procedural` or `object`.
    pub kind: String,
    pub position: [f32; 3],
    /// World rotation `[x, y, z, w]`.
    pub rotation: [f32; 4],
    pub scale: [f32; 3],
    pub components: CollisionComponents,
    #[serde(default)]
    pub procedural: Option<CollisionPlacementProcedural>,
}

impl CollisionPlacement {
    /// The world transform of the placed object.
    pub fn transform(&self) -> Transform {
        Transform {
            translation: Vec3::from_array(self.position),
            rotation: Quat::from_array(self.rotation),
            scale: Vec3::from_array(self.scale),
        }
    }
}

/// The collision document of one level.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct CollisionDocument {
    pub collision_version: u32,
    pub level_name: String,
    pub pieces: Vec<CollisionPiece>,
    pub flagged: Vec<CollisionFlagged>,
    pub placements: Vec<CollisionPlacement>,
}

impl CollisionDocument {
    /// Parses a collision document, refusing versions this crate does not read.
    pub fn parse(json: &str) -> Result<Self, String> {
        let document: Self = serde_json::from_str(json).map_err(|error| error.to_string())?;
        if document.collision_version != COLLISION_FILE_VERSION {
            return Err(format!(
                "collision version {} is not {COLLISION_FILE_VERSION}",
                document.collision_version
            ));
        }
        Ok(document)
    }

    /// Reads and parses the collision document of a level directory.
    pub fn read(level_directory: &Path) -> Result<Self, String> {
        let path = level_directory.join(COLLISION_FILE_NAME);
        let json = std::fs::read_to_string(&path)
            .map_err(|error| format!("{}: {error}", path.display()))?;
        Self::parse(&json)
    }

    /// The pieces of one collision kind.
    pub fn pieces_of_kind(&self, kind: CollisionKind) -> impl Iterator<Item = &CollisionPiece> {
        self.pieces.iter().filter(move |piece| piece.kind == kind)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The shared sample of a collision document, written by the editor's level export.
    const COLLISION_SAMPLE: &str = include_str!("../../../../fixtures/collision_sample.json");

    /// The sample parses with its pieces, kinds and placements.
    #[test]
    fn sample_parses_with_pieces_kinds_and_placements() {
        let document = CollisionDocument::parse(COLLISION_SAMPLE).expect("the sample parses");
        let raw: serde_json::Value = serde_json::from_str(COLLISION_SAMPLE).expect("json");
        assert_eq!(
            document.pieces.len(),
            raw["pieces"].as_array().expect("pieces").len()
        );
        assert!(document.pieces_of_kind(CollisionKind::Solid).count() > 0);
        assert!(document.pieces_of_kind(CollisionKind::Volume).count() > 0);
        assert_eq!(
            document.placements.len(),
            raw["placements"].as_array().expect("placements").len()
        );
    }

    /// Every vertex of every piece lies inside its own planes.
    #[test]
    fn sample_pieces_contain_their_vertices() {
        let document = CollisionDocument::parse(COLLISION_SAMPLE).expect("the sample parses");
        for piece in &document.pieces {
            assert!(piece.planes.len() >= 4);
            for vertex in &piece.vertices {
                assert!(piece.contains(Vec3::from_array(*vertex), 1e-4));
            }
        }
    }

    /// A placement's transform is its world position, rotation and scale.
    #[test]
    fn placement_transform_reads_position_rotation_and_scale() {
        let document = CollisionDocument::parse(COLLISION_SAMPLE).expect("the sample parses");
        let placement = document.placements.first().expect("a placement");
        let transform = placement.transform();
        assert_eq!(transform.translation, Vec3::from_array(placement.position));
        assert!(transform.rotation.is_normalized());
        assert_eq!(transform.scale, Vec3::from_array(placement.scale));
    }

    /// A document of another version is refused.
    #[test]
    fn other_versions_are_refused() {
        let mut raw: serde_json::Value = serde_json::from_str(COLLISION_SAMPLE).expect("json");
        raw["collision_version"] = serde_json::json!(COLLISION_FILE_VERSION + 1);
        assert!(CollisionDocument::parse(&raw.to_string()).is_err());
    }
}
