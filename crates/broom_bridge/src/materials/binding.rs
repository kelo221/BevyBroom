//! Giving exported primitives their catalog material.

use std::collections::HashSet;

use bevy::gltf::{GltfMaterialExtras, GltfMaterialName};
use bevy::mesh::VertexAttributeValues;
use bevy::prelude::*;
use dynlight::surface::DynLitMaterial;

use super::CatalogState;
use crate::protocol::EXTRAS_MATERIAL_ID;

/// The catalog id a primitive's exported material names.
#[derive(Component, Clone, Debug, PartialEq, Eq)]
pub struct CatalogMaterialRequest(pub String);

/// The catalog generation a primitive's material was last bound at.
#[derive(Component, Clone, Copy, Debug, PartialEq, Eq)]
pub struct CatalogMaterialBinding {
    pub generation: u64,
}

/// Meshes whose V coordinate was already flipped.
#[derive(Resource, Default)]
pub(super) struct FlippedMeshes(HashSet<AssetId<Mesh>>);

/// The catalog id in material extras JSON, if any.
pub(crate) fn material_id_from_extras(json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    let id = value.get(EXTRAS_MATERIAL_ID)?.as_str()?;
    (!id.is_empty()).then(|| id.to_owned())
}

/// New primitives with the material extras and name glTF loading gave them.
type NewPrimitives<'w, 's> = Query<
    'w,
    's,
    (
        Entity,
        Option<&'static GltfMaterialExtras>,
        Option<&'static GltfMaterialName>,
    ),
    Added<Mesh3d>,
>;

/// Tags new primitives with the catalog id their material names: the extras key first, then the
/// material name.
pub(super) fn request_catalog_materials(mut commands: Commands, primitives: NewPrimitives) {
    for (entity, extras, name) in &primitives {
        let id = extras
            .and_then(|extras| material_id_from_extras(&extras.value))
            .or_else(|| name.map(|name| name.0.clone()));
        if let Some(id) = id {
            commands.entity(entity).insert(CatalogMaterialRequest(id));
        }
    }
}

/// Binds tagged primitives to their catalog material when they are new or the catalog was
/// rebuilt since they were bound.
pub(super) fn bind_catalog_materials(
    mut commands: Commands,
    catalog: Res<CatalogState>,
    mut flipped: ResMut<FlippedMeshes>,
    mut meshes: ResMut<Assets<Mesh>>,
    primitives: Query<(
        Entity,
        &CatalogMaterialRequest,
        &Mesh3d,
        Option<&CatalogMaterialBinding>,
    )>,
) {
    for (entity, request, mesh, binding) in &primitives {
        if binding.is_some_and(|binding| binding.generation == catalog.generation) {
            continue;
        }
        let Some(handle) = catalog.handle(&request.0) else {
            continue;
        };
        if flipped.0.insert(mesh.id()) {
            prepare_mesh(&mut meshes, &mesh.0, catalog.needs_tangents(&request.0));
        }
        commands
            .entity(entity)
            .remove::<MeshMaterial3d<StandardMaterial>>()
            .insert((
                MeshMaterial3d::<DynLitMaterial>(handle.clone()),
                CatalogMaterialBinding {
                    generation: catalog.generation,
                },
            ));
    }
}

/// Flips V so the editor's bottom-left texture origin matches the catalog's image files, then
/// adds tangents when a normal map needs them.
fn prepare_mesh(meshes: &mut Assets<Mesh>, handle: &Handle<Mesh>, tangents: bool) {
    let Some(mut mesh) = meshes.get_mut(handle) else {
        return;
    };
    if let Some(VertexAttributeValues::Float32x2(uvs)) = mesh.attribute_mut(Mesh::ATTRIBUTE_UV_0) {
        flip_v(uvs);
    }
    if tangents && let Err(error) = mesh.generate_tangents() {
        warn!("broom bridge: cannot generate tangents for a normal-mapped mesh: {error}");
    }
}

/// Turns each `[u, v]` into `[u, 1 - v]`.
pub(crate) fn flip_v(uvs: &mut [[f32; 2]]) {
    for uv in uvs {
        uv[1] = 1.0 - uv[1];
    }
}
