//! BevyBroom bridge: the link between the BevyBroom editor and a Bevy game.
//!
//! - [`BroomLevelPlugin`] loads levels the editor generated (geometry GLB + manifest with
//!   lights and transforms) and resolves the game's catalog materials. Games ship with it.
//! - [`BroomBridgePlugin`] adds the level plugin plus the editor connection: a local HTTP
//!   endpoint that receives live authored state and geometry revisions. Development only.
//!
//! The `dynlight` cargo feature (on by default) renders authored lights, rooms and portals with
//! DynLight, runs preview bakes and binds catalog materials as `DynLitMaterial`; add either
//! plugin after `DefaultPlugins` and `DynamicLightingPlugin`. Without the feature the bridge
//! needs only `DefaultPlugins`: lights, rooms and portals are accepted but not shown, the
//! handshake leaves out the `lights` and `bake_preview` capabilities, and catalog materials bind
//! as `StandardMaterial`. Either way a game can bind its own material type with
//! [`BroomBridgePlugin::with_catalog_material`] or [`BroomLevelPlugin::with_catalog_material`].
//!
//! The game's `AssetPlugin` must use the project's asset root. See `AGENTS.md` and `README.md`
//! in the `bevy/` workspace.

pub mod authoring;
#[cfg(feature = "dynlight")]
pub mod bake_link;
pub mod level;
pub mod logic;
pub mod materials;
pub mod placeables;
pub mod project;
pub mod protocol;
pub mod remote;
pub mod status;

#[cfg(test)]
mod test_support;

use std::marker::PhantomData;

use bevy::prelude::*;

use materials::{CatalogMaterialKind, DefaultCatalogMaterial};
use project::ProjectPaths;
use status::BridgeStatus;

/// Common imports.
pub mod prelude {
    pub use crate::authoring::{AuthoredLightEntity, AuthoredNode, BroomSystems};
    #[cfg(feature = "dynlight")]
    pub use crate::authoring::{ShippedLight, ShippedLightReplaced};
    pub use crate::level::{LevelGeometryRoot, LevelLoadRequest};
    pub use crate::logic::{
        BroomLogicEnabled, BroomLogicOutputs, LogicFireOutput, LogicInputReceived, LogicPlugin,
    };
    pub use crate::materials::{
        CatalogMaterialKind, CatalogMaterials, CatalogResolver, CatalogResolvers, CatalogState,
        DefaultCatalogMaterial,
    };
    pub use crate::placeables::{
        AppDataAssetExt, AppPlaceableAssetExt, AppPlaceableExt, AuthoredGameEntity,
        BroomDisplacementSurface, BroomGltfComponentsPlugin, BroomGltfDisplacementPlugin,
        BroomProperties, FieldHidden, FieldLabel, FieldRange, FieldStep, PlaceableOptions,
        PropertyValue,
    };
    pub use crate::project::{PROJECT_FILE_NAME, ProjectPaths};
    pub use crate::{BroomBridgePlugin, BroomLevelPlugin};
}

/// Loads generated levels and catalog materials of type `M` for the project at `paths`.
pub struct BroomLevelPlugin<M: CatalogMaterialKind = DefaultCatalogMaterial> {
    pub paths: ProjectPaths,
    /// The catalog material type; choose it with [`BroomLevelPlugin::with_catalog_material`].
    pub material: PhantomData<fn() -> M>,
}

impl BroomLevelPlugin {
    /// The level plugin for the project at `paths`, binding [`DefaultCatalogMaterial`].
    pub fn new(paths: ProjectPaths) -> Self {
        Self {
            paths,
            material: PhantomData,
        }
    }
}

impl<M: CatalogMaterialKind> BroomLevelPlugin<M> {
    /// The same plugin binding catalog materials as `N` instead.
    pub fn with_catalog_material<N: CatalogMaterialKind>(self) -> BroomLevelPlugin<N> {
        BroomLevelPlugin {
            paths: self.paths,
            material: PhantomData,
        }
    }
}

impl<M: CatalogMaterialKind> Plugin for BroomLevelPlugin<M> {
    fn build(&self, app: &mut App) {
        app.insert_resource(self.paths.clone())
            .insert_resource(BridgeStatus::new(&self.paths.project_id))
            .add_plugins((
                authoring::AuthoringPlugin,
                level::LevelPlugin,
                materials::MaterialsPlugin::<M>::default(),
                placeables::PlaceablesPlugin,
                logic::LogicPlugin,
                status::StatusPlugin,
            ));
        #[cfg(feature = "dynlight")]
        app.add_plugins(bake_link::BakeLinkPlugin);
    }
}

/// [`BroomLevelPlugin`] plus the editor connection on `port`.
pub struct BroomBridgePlugin<M: CatalogMaterialKind = DefaultCatalogMaterial> {
    pub paths: ProjectPaths,
    pub port: u16,
    /// The protocol range the handshake advertises; leave the default outside of tests.
    pub protocol: protocol::ProtocolRange,
    /// The catalog material type; choose it with [`BroomBridgePlugin::with_catalog_material`].
    pub material: PhantomData<fn() -> M>,
}

impl BroomBridgePlugin {
    /// The bridge for the project at `paths` on the default port, binding
    /// [`DefaultCatalogMaterial`].
    pub fn new(paths: ProjectPaths) -> Self {
        Self {
            paths,
            port: remote::DEFAULT_PORT,
            protocol: protocol::ProtocolRange::default(),
            material: PhantomData,
        }
    }
}

impl<M: CatalogMaterialKind> BroomBridgePlugin<M> {
    /// The same bridge binding catalog materials as `N` instead.
    pub fn with_catalog_material<N: CatalogMaterialKind>(self) -> BroomBridgePlugin<N> {
        BroomBridgePlugin {
            paths: self.paths,
            port: self.port,
            protocol: self.protocol,
            material: PhantomData,
        }
    }
}

impl<M: CatalogMaterialKind> Plugin for BroomBridgePlugin<M> {
    fn build(&self, app: &mut App) {
        app.add_plugins(BroomLevelPlugin::<M> {
            paths: self.paths.clone(),
            material: PhantomData,
        });
        remote::add_remote(app, self.port, self.protocol);
        info!(
            "broom bridge: listening on http://127.0.0.1:{} for project {}",
            self.port, self.paths.project_id
        );
    }
}
