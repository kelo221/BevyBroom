//! Materials tests: the shared sample catalog loads from a project's catalog file, its entries
//! become materials of the chosen kind, and exported primitives naming an id get that material.

use std::any::TypeId;

use bevy::gltf::GltfMaterialName;
use bevy::prelude::*;

use super::*;
use crate::project::ProjectPaths;
use crate::protocol::CatalogMaterial;
use crate::status::BridgeStatus;
use crate::test_support::{TemporaryDirectory, sample_project_paths};

/// The shared sample catalog, also parsed by the editor's tests.
const SAMPLE_CATALOG: &str = include_str!("../../../../fixtures/material_catalog_sample.json");

/// The sample catalog's entries.
fn sample_entries() -> Vec<CatalogMaterial> {
    MaterialCatalog::parse(SAMPLE_CATALOG)
        .expect("the sample catalog parses")
        .materials
}

/// Writes the sample catalog to the catalog file of the sample project in `directory`.
fn sample_project_with_catalog(directory: &TemporaryDirectory) -> ProjectPaths {
    let paths = sample_project_paths(directory.path());
    let folder = paths
        .catalog_file
        .parent()
        .expect("the catalog is in a folder");
    std::fs::create_dir_all(folder).expect("the catalog folder can be created");
    std::fs::write(&paths.catalog_file, SAMPLE_CATALOG).expect("the catalog can be written");
    paths
}

/// A headless app that loads the catalog of `paths` as materials of type `M` and has run one
/// frame.
fn catalog_app<M: CatalogMaterialKind>(paths: ProjectPaths) -> App {
    let mut app = App::new();
    app.add_plugins((
        MinimalPlugins,
        AssetPlugin {
            file_path: paths.asset_root.to_string_lossy().into_owned(),
            ..default()
        },
    ))
    .init_asset::<Mesh>()
    .init_asset::<Image>()
    .init_asset::<StandardMaterial>();
    if !app.world().contains_resource::<Assets<M>>() {
        app.init_asset::<M>();
    }
    app.insert_resource(paths)
        .insert_resource(BridgeStatus::new("materials tests"))
        .add_plugins(MaterialsPlugin::<M>::default());
    app.update();
    app
}

/// Spawns a primitive the way glTF loading does: a mesh with UVs, the glTF's own
/// `StandardMaterial` and the material name `id`.
fn primitive_spawn(app: &mut App, id: &str) -> Entity {
    let mesh = app
        .world_mut()
        .resource_mut::<Assets<Mesh>>()
        .add(Mesh::from(Cuboid::default()));
    let gltf_material = app
        .world_mut()
        .resource_mut::<Assets<StandardMaterial>>()
        .add(StandardMaterial::default());
    let entity = app.world_mut().spawn((
        Mesh3d(mesh),
        MeshMaterial3d(gltf_material),
        GltfMaterialName(id.to_owned()),
    ));
    entity.id()
}

/// Loads the sample catalog as `M`, binds a primitive naming the first entry and checks that
/// it holds the catalog's material at the current generation. Returns the app, the primitive
/// and the bound handle.
fn first_entry_bound<M: CatalogMaterialKind>(label: &str) -> (App, Entity, Handle<M>) {
    let directory = TemporaryDirectory::new(label);
    let mut app = catalog_app::<M>(sample_project_with_catalog(&directory));
    let entries = sample_entries();
    let state = app.world().resource::<CatalogState>();
    assert_eq!(state.catalog.materials, entries);
    assert_eq!(state.error, None);
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!(status.catalog_material_count, entries.len());
    let id = entries[0].id.clone();
    let primitive = primitive_spawn(&mut app, &id);
    app.update();
    let handle = app
        .world()
        .resource::<CatalogMaterials<M>>()
        .handle(&id)
        .expect("the entry has a material")
        .clone();
    let entity = app.world().entity(primitive);
    assert_eq!(
        entity.get::<MeshMaterial3d<M>>().map(|bound| bound.0.id()),
        Some(handle.id())
    );
    let generation = app.world().resource::<CatalogState>().generation;
    assert_eq!(
        entity.get::<CatalogMaterialBinding>(),
        Some(&CatalogMaterialBinding { generation })
    );
    (app, primitive, handle)
}

/// Catalog entries bind as `StandardMaterial`s, replacing the glTF's material in place, and the
/// bound material carries the entry's values.
#[test]
fn catalog_entries_bind_as_standard_materials() {
    let (app, _, handle) = first_entry_bound::<StandardMaterial>("catalog_standard");
    let entry = &sample_entries()[0];
    let materials = app.world().resource::<Assets<StandardMaterial>>();
    let material = materials.get(&handle).expect("the material exists");
    assert_eq!(material.base_color, catalog_base_color(entry));
    assert_eq!(material.perceptual_roughness, entry.roughness);
    assert_eq!(
        material.normal_map_texture.is_some(),
        entry.normal_texture.is_some()
    );
}

/// Catalog entries bind as `DynLitMaterial`s, and the glTF's `StandardMaterial` is removed.
#[cfg(feature = "dynlight")]
#[test]
fn catalog_entries_bind_as_dynlit_materials() {
    let (app, primitive, _) =
        first_entry_bound::<dynlight::surface::DynLitMaterial>("catalog_dynlit");
    let entity = app.world().entity(primitive);
    assert!(!entity.contains::<MeshMaterial3d<StandardMaterial>>());
}

/// Every sample entry becomes a `StandardMaterial` with its alpha, sidedness, shading and
/// textures.
#[test]
fn standard_materials_follow_every_sample_entry() {
    let directory = TemporaryDirectory::new("catalog_standard_entries");
    let app = catalog_app::<StandardMaterial>(sample_project_paths(directory.path()));
    let assets = app.world().resource::<AssetServer>();
    for entry in sample_entries() {
        let material = StandardMaterial::from_catalog(&entry, assets);
        assert_eq!(material.alpha_mode, catalog_alpha_mode(&entry));
        assert_eq!(material.cull_mode, catalog_cull_mode(&entry));
        assert_eq!(material.double_sided, entry.double_sided);
        assert_eq!(material.unlit, entry.unlit);
        assert_eq!(material.metallic, entry.metallic);
        assert_eq!(material.emissive, catalog_emissive(&entry));
        assert_eq!(
            material.base_color_texture.is_some(),
            entry.base_color_texture.is_some()
        );
    }
}

/// A bridge built without DynLight binds `StandardMaterial` unless the game chooses another
/// type.
#[cfg(not(feature = "dynlight"))]
#[test]
fn without_dynlight_the_default_catalog_material_is_standard() {
    assert_eq!(
        TypeId::of::<DefaultCatalogMaterial>(),
        TypeId::of::<StandardMaterial>()
    );
}

/// A bridge built with DynLight binds `DynLitMaterial` unless the game chooses another type.
#[cfg(feature = "dynlight")]
#[test]
fn with_dynlight_the_default_catalog_material_is_dynlit() {
    assert_eq!(
        TypeId::of::<DefaultCatalogMaterial>(),
        TypeId::of::<dynlight::surface::DynLitMaterial>()
    );
}
