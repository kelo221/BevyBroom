//! BevyBroom bridge: the link between the BevyBroom editor and a Bevy game rendered with DynLight.
//!
//! - [`BroomLevelPlugin`] loads levels the editor generated (geometry GLB + manifest with
//!   lights and transforms) and resolves the game's catalog materials. Games ship with it.
//! - [`BroomBridgePlugin`] adds the level plugin plus the editor connection: a local HTTP
//!   endpoint that receives live authored state and geometry revisions. Development only.
//!
//! Add either after `DefaultPlugins` and `DynamicLightingPlugin`. The game's `AssetPlugin` must
//! use the project's asset root. See `AGENTS.md` and `README.md` at the workspace root.

pub mod authoring;
pub mod bake_link;
pub mod level;
pub mod materials;
pub mod placeables;
pub mod project;
pub mod protocol;
pub mod remote;
pub mod status;

#[cfg(test)]
mod test_support;

use bevy::prelude::*;

use project::ProjectPaths;
use status::BridgeStatus;

/// Common imports.
pub mod prelude {
    pub use crate::authoring::{AuthoredLightEntity, AuthoredNode, BroomSystems};
    pub use crate::level::{LevelGeometryRoot, LevelLoadRequest};
    pub use crate::materials::{CatalogResolver, CatalogResolvers, CatalogState};
    pub use crate::placeables::{
        AppDataAssetExt, AppPlaceableAssetExt, AppPlaceableExt, AuthoredGameEntity,
        BroomGltfComponentsPlugin, BroomProperties, FieldHidden, FieldLabel, FieldRange, FieldStep,
        PlaceableOptions, PropertyValue,
    };
    pub use crate::project::{PROJECT_FILE_NAME, ProjectPaths};
    pub use crate::{BroomBridgePlugin, BroomLevelPlugin};
}

/// Loads generated levels and catalog materials for the project at `paths`.
pub struct BroomLevelPlugin {
    pub paths: ProjectPaths,
}

impl Plugin for BroomLevelPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(self.paths.clone())
            .insert_resource(BridgeStatus::new(&self.paths.project_id))
            .add_plugins((
                authoring::AuthoringPlugin,
                level::LevelPlugin,
                materials::MaterialsPlugin,
                placeables::PlaceablesPlugin,
                bake_link::BakeLinkPlugin,
                status::StatusPlugin,
            ));
    }
}

/// [`BroomLevelPlugin`] plus the editor connection on `port`.
pub struct BroomBridgePlugin {
    pub paths: ProjectPaths,
    pub port: u16,
    /// The protocol range the handshake advertises; leave the default outside of tests.
    pub protocol: protocol::ProtocolRange,
}

impl BroomBridgePlugin {
    /// The bridge for the project at `paths` on the default port.
    pub fn new(paths: ProjectPaths) -> Self {
        Self {
            paths,
            port: remote::DEFAULT_PORT,
            protocol: protocol::ProtocolRange::default(),
        }
    }
}

impl Plugin for BroomBridgePlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(BroomLevelPlugin {
            paths: self.paths.clone(),
        });
        remote::add_remote(app, self.port, self.protocol);
        info!(
            "broom bridge: listening on http://127.0.0.1:{} for project {}",
            self.port, self.paths.project_id
        );
    }
}
