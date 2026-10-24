//! Game materials from the catalog: built once per id with the game's resolvers, shared by every
//! mesh that uses the id, and updated in place when the catalog file or a texture changes, so
//! handles held by meshes stay valid.
//!
//! Exported primitives name their catalog id in material extras (`broom_material`) or the
//! material name. Primitives whose id the catalog lacks keep the glTF material, which DynLight
//! converts.

mod binding;
mod build;
mod reload;

use std::collections::{HashMap, HashSet};
use std::time::SystemTime;

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::prelude::*;
use dynlight::surface::DynLitMaterial;

use crate::authoring::BroomSystems;
use crate::protocol::MaterialCatalog;

pub use binding::{CatalogMaterialBinding, CatalogMaterialRequest};
pub use build::{CatalogResolver, CatalogResolvers, dynlit_from_catalog, load_catalog_texture};

/// What a watched file looks like on disk: its modification time and size. The size is part of
/// it because copying a file over another keeps the source's modification time on Windows.
pub(crate) type FileStamp = (SystemTime, u64);

/// A texture the catalog uses, watched for changes on disk.
#[derive(Clone, Debug)]
pub(crate) struct WatchedTexture {
    pub srgb: bool,
    pub stamp: Option<FileStamp>,
}

/// The loaded catalog and the material made for each id.
#[derive(Resource, Default)]
pub struct CatalogState {
    pub catalog: MaterialCatalog,
    /// Why the catalog file could not be used; the previous catalog stays in use.
    pub error: Option<String>,
    handles: HashMap<String, Handle<DynLitMaterial>>,
    /// Ids whose entry needs a normal map: their meshes get tangents.
    needs_tangents: HashSet<String>,
    catalog_stamp: Option<FileStamp>,
    textures: HashMap<String, WatchedTexture>,
    /// Bumped whenever materials are rebuilt, so bindings are re-checked.
    pub generation: u64,
    /// Bumped whenever a catalog texture file is reloaded, so the editor refreshes its previews.
    pub texture_generation: u64,
}

impl CatalogState {
    /// The material for catalog id `id`.
    pub fn handle(&self, id: &str) -> Option<&Handle<DynLitMaterial>> {
        self.handles.get(id)
    }

    /// Whether meshes using `id` need tangents for a normal map.
    pub fn needs_tangents(&self, id: &str) -> bool {
        self.needs_tangents.contains(id)
    }
}

pub struct MaterialsPlugin;

impl Plugin for MaterialsPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<CatalogState>()
            .init_resource::<CatalogResolvers>()
            .init_resource::<binding::FlippedMeshes>()
            .init_resource::<reload::CatalogPollTimer>()
            .add_systems(
                Update,
                reload::poll_catalog_files.before(BroomSystems::ApplyState),
            )
            .add_systems(
                SpawnScene,
                (
                    binding::request_catalog_materials,
                    binding::bind_catalog_materials,
                )
                    .chain()
                    .after(SceneSpawnerSystems::WorldInstanceSpawn)
                    .after(SceneSpawnerSystems::SceneSpawn),
            );
    }
}
