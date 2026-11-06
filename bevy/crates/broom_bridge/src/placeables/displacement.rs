//! Collision flags of displacement surfaces: the editor's GLB export, for the live preview and
//! shipped levels alike, writes the flags of each displacement surface node under
//! `broom_displacement` when any flag is set, and [`BroomGltfDisplacementPlugin`] inserts them as
//! [`BroomDisplacementSurface`] when the glTF scene spawns. The game's physics, movement and
//! visibility code reads the component; the bridge itself does not act on the flags.

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use serde::Deserialize;

use super::extras::extras_entry;
use crate::protocol::EXTRAS_DISPLACEMENT;

/// How the game treats collision with one displacement surface. Missing flags read as `false`.
#[derive(Component, Reflect, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[reflect(Component, Default)]
#[serde(default)]
pub struct BroomDisplacementSurface {
    /// The surface has no physics collision.
    pub no_physics_collision: bool,
    /// The surface does not block hulls (players and NPCs).
    pub no_hull_collision: bool,
    /// The surface does not block rays (traces and line of sight).
    pub no_ray_collision: bool,
    /// The surface seals the level for visibility and leak checks.
    pub seals: bool,
}

/// Inserts [`BroomDisplacementSurface`] on displacement surface nodes from their glTF extras.
/// Added by the bridge's level plugin and by `BroomGltfComponentsPlugin`; a game can also add
/// it on its own.
pub struct BroomGltfDisplacementPlugin;

impl Plugin for BroomGltfDisplacementPlugin {
    fn build(&self, app: &mut App) {
        app.register_type::<BroomDisplacementSurface>().add_systems(
            SpawnScene,
            sync_displacement_surfaces
                .after(SceneSpawnerSystems::WorldInstanceSpawn)
                .after(SceneSpawnerSystems::SceneSpawn),
        );
    }
}

/// Adds [`BroomGltfDisplacementPlugin`] unless the app already has it.
pub(super) fn displacement_plugin_ensure(app: &mut App) {
    if !app.is_plugin_added::<BroomGltfDisplacementPlugin>() {
        app.add_plugins(BroomGltfDisplacementPlugin);
    }
}

/// The collision flags in a node's extras JSON, or `None` when it has none or they are
/// malformed.
pub(crate) fn displacement_from_extras(json: &str) -> Option<BroomDisplacementSurface> {
    extras_entry::<BroomDisplacementSurface>(json, EXTRAS_DISPLACEMENT)
}

/// Inserts the flags of every node whose extras appeared or changed, and removes them from
/// nodes whose extras no longer carry well-formed flags.
fn sync_displacement_surfaces(
    mut commands: Commands,
    nodes: Query<(Entity, &GltfExtras, Has<BroomDisplacementSurface>), Changed<GltfExtras>>,
) {
    for (entity, extras, has_surface) in &nodes {
        match displacement_from_extras(&extras.value) {
            Some(surface) => {
                commands.entity(entity).insert(surface);
            }
            None if has_surface => {
                commands.entity(entity).remove::<BroomDisplacementSurface>();
            }
            None => {}
        }
    }
}
