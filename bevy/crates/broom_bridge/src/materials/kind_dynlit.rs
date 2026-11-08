//! Catalog entries as DynLight's `DynLitMaterial`. Only built with the `dynlight` feature.

use bevy::prelude::*;
use dynlight::surface::{DynLitMaterial, ShadingModel};

use super::kind::{
    CatalogMaterialKind, catalog_alpha_mode, catalog_base_color, catalog_cull_mode,
    catalog_emissive, catalog_texture,
};
use crate::protocol::CatalogMaterial;

impl CatalogMaterialKind for DynLitMaterial {
    fn from_catalog(material: &CatalogMaterial, assets: &AssetServer) -> Self {
        dynlit_from_catalog(material, assets)
    }
}

/// The plain DynLit material an entry describes.
pub fn dynlit_from_catalog(material: &CatalogMaterial, assets: &AssetServer) -> DynLitMaterial {
    let metallic = material.metallic > 0.0
        || material.normal_texture.is_some()
        || material.metallic_roughness_texture.is_some();
    DynLitMaterial {
        base_color: catalog_base_color(material),
        base_color_texture: catalog_texture(assets, &material.base_color_texture, true),
        emissive: catalog_emissive(material),
        emissive_texture: catalog_texture(assets, &material.emissive_texture, true),
        shading: if metallic {
            ShadingModel::Metallic
        } else {
            ShadingModel::Diffuse
        },
        metallic: material.metallic,
        perceptual_roughness: material.roughness,
        metallic_roughness_texture: catalog_texture(
            assets,
            &material.metallic_roughness_texture,
            false,
        ),
        normal_map_texture: catalog_texture(assets, &material.normal_texture, false),
        alpha_mode: catalog_alpha_mode(material),
        cull_mode: catalog_cull_mode(material),
        unlit: material.unlit,
        ..default()
    }
}
