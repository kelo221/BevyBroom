//! Game materials from the catalog: built once per id with the game's resolvers, shared by every
//! mesh that uses the id, and updated in place when the catalog file or a texture changes, so
//! handles held by meshes stay valid.
//!
//! Exported primitives name their catalog id in material extras (`broom_material`) or the
//! material name. Primitives whose id the catalog lacks keep the glTF material. The material
//! type is generic ([`CatalogMaterialKind`]): `DynLitMaterial` with the `dynlight` feature,
//! `StandardMaterial` without, or a game's own.

mod binding;
mod build;
mod kind;
#[cfg(feature = "dynlight")]
mod kind_dynlit;
mod kind_standard;
mod reload;
#[cfg(test)]
mod tests;

use std::collections::{HashMap, HashSet};
use std::marker::PhantomData;
use std::time::SystemTime;

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::prelude::*;

use crate::authoring::BroomSystems;
use crate::protocol::MaterialCatalog;

pub use binding::{CatalogMaterialBinding, CatalogMaterialRequest};
pub use build::{CatalogResolver, CatalogResolvers, load_catalog_texture};
pub use kind::{
    CatalogMaterialKind, DefaultCatalogMaterial, catalog_alpha_mode, catalog_base_color,
    catalog_cull_mode, catalog_emissive, catalog_texture,
};
#[cfg(feature = "dynlight")]
pub use kind_dynlit::dynlit_from_catalog;

/// What a watched file looks like on disk: its modification time and size. The size is part of
/// it because copying a file over another keeps the source's modification time on Windows.
pub(crate) type FileStamp = (SystemTime, u64);

/// A texture the catalog uses, watched for changes on disk.
#[derive(Clone, Debug)]
pub(crate) struct WatchedTexture {
    pub srgb: bool,
    pub stamp: Option<FileStamp>,
}

/// The loaded catalog and what it needs, whatever material type it is built as.
#[derive(Resource, Default)]
pub struct CatalogState {
    pub catalog: MaterialCatalog,
    /// Why the catalog file could not be used; the previous catalog stays in use.
    pub error: Option<String>,
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
    /// Whether meshes using `id` need tangents for a normal map.
    pub fn needs_tangents(&self, id: &str) -> bool {
        self.needs_tangents.contains(id)
    }
}

/// The material of type `M` made for each catalog id.
#[derive(Resource)]
pub struct CatalogMaterials<M: CatalogMaterialKind = DefaultCatalogMaterial> {
    handles: HashMap<String, Handle<M>>,
}

impl<M: CatalogMaterialKind> Default for CatalogMaterials<M> {
    fn default() -> Self {
        Self {
            handles: HashMap::new(),
        }
    }
}

impl<M: CatalogMaterialKind> CatalogMaterials<M> {
    /// The material for catalog id `id`.
    pub fn handle(&self, id: &str) -> Option<&Handle<M>> {
        self.handles.get(id)
    }
}

/// Builds catalog materials as `M` and binds them to exported primitives. The game's renderer
/// must have added `MaterialPlugin::<M>` (DynLight and Bevy's PBR plugin do for their types).
pub struct MaterialsPlugin<M: CatalogMaterialKind = DefaultCatalogMaterial>(PhantomData<fn() -> M>);

impl<M: CatalogMaterialKind> Default for MaterialsPlugin<M> {
    fn default() -> Self {
        Self(PhantomData)
    }
}

impl<M: CatalogMaterialKind> Plugin for MaterialsPlugin<M> {
    fn build(&self, app: &mut App) {
        app.init_resource::<CatalogState>()
            .init_resource::<CatalogMaterials<M>>()
            .init_resource::<CatalogResolvers<M>>()
            .init_resource::<binding::FlippedMeshes>()
            .init_resource::<reload::CatalogPollTimer>()
            .add_systems(
                Update,
                reload::poll_catalog_files::<M>.before(BroomSystems::ApplyState),
            )
            .add_systems(
                SpawnScene,
                (
                    binding::request_catalog_materials,
                    binding::bind_catalog_materials::<M>,
                )
                    .chain()
                    .after(SceneSpawnerSystems::WorldInstanceSpawn)
                    .after(SceneSpawnerSystems::SceneSpawn),
            );
    }
}
