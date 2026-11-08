//! Catalog entries as Bevy's `StandardMaterial`, for games rendered without DynLight.
//!
//! `tile_meters` is only an editor hint: the exported UVs already carry the tiling, so it is not
//! applied again.

use bevy::prelude::*;

use super::kind::{
    CatalogMaterialKind, catalog_alpha_mode, catalog_base_color, catalog_cull_mode,
    catalog_emissive, catalog_texture,
};
use crate::protocol::CatalogMaterial;

impl CatalogMaterialKind for StandardMaterial {
    fn from_catalog(material: &CatalogMaterial, assets: &AssetServer) -> Self {
        StandardMaterial {
            base_color: catalog_base_color(material),
            base_color_texture: catalog_texture(assets, &material.base_color_texture, true),
            emissive: catalog_emissive(material),
            emissive_texture: catalog_texture(assets, &material.emissive_texture, true),
            metallic: material.metallic,
            perceptual_roughness: material.roughness,
            metallic_roughness_texture: catalog_texture(
                assets,
                &material.metallic_roughness_texture,
                false,
            ),
            normal_map_texture: catalog_texture(assets, &material.normal_texture, false),
            alpha_mode: catalog_alpha_mode(material),
            double_sided: material.double_sided,
            cull_mode: catalog_cull_mode(material),
            unlit: material.unlit,
            ..default()
        }
    }
}
