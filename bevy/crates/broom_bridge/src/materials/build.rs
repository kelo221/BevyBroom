//! The registry of game resolvers that build catalog materials, and loading catalog textures.

use std::collections::HashMap;

use bevy::image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor};
use bevy::prelude::*;

use super::kind::{CatalogMaterialKind, DefaultCatalogMaterial};
use crate::protocol::{CatalogMaterial, DYNLIT_RESOLVER};

/// Builds the material for one catalog entry. Games register their own for entries whose
/// `resolver` names them, e.g. to add game-specific textures or tweak shading.
pub type CatalogResolver<M = DefaultCatalogMaterial> = fn(&CatalogMaterial, &AssetServer) -> M;

/// Game resolvers by name for material type `M`. [`DYNLIT_RESOLVER`] is always present and
/// builds [`CatalogMaterialKind::from_catalog`].
#[derive(Resource, Clone)]
pub struct CatalogResolvers<M: CatalogMaterialKind = DefaultCatalogMaterial>(
    HashMap<String, CatalogResolver<M>>,
);

impl<M: CatalogMaterialKind> Default for CatalogResolvers<M> {
    fn default() -> Self {
        let mut resolvers = HashMap::new();
        resolvers.insert(
            DYNLIT_RESOLVER.to_owned(),
            M::from_catalog as CatalogResolver<M>,
        );
        Self(resolvers)
    }
}

impl<M: CatalogMaterialKind> CatalogResolvers<M> {
    /// Adds or replaces the resolver called `name`.
    pub fn register(&mut self, name: impl Into<String>, resolver: CatalogResolver<M>) {
        self.0.insert(name.into(), resolver);
    }

    /// Builds `material` with its resolver, or an error naming the missing resolver.
    pub fn build(&self, material: &CatalogMaterial, assets: &AssetServer) -> Result<M, String> {
        let resolver = self.0.get(&material.resolver).ok_or_else(|| {
            format!(
                "material {} asks for resolver {:?}, which the game did not register",
                material.id, material.resolver
            )
        })?;
        Ok(resolver(material, assets))
    }
}

/// A repeating, linearly filtered sampler: editor UVs tile.
pub(super) fn repeating_sampler() -> ImageSampler {
    ImageSampler::Descriptor(ImageSamplerDescriptor {
        address_mode_u: ImageAddressMode::Repeat,
        address_mode_v: ImageAddressMode::Repeat,
        address_mode_w: ImageAddressMode::Repeat,
        ..ImageSamplerDescriptor::linear()
    })
}

/// Loads the texture at asset path `path`, sRGB for colors or linear for data maps.
pub fn load_catalog_texture(assets: &AssetServer, path: &str, srgb: bool) -> Handle<Image> {
    assets
        .load_builder()
        .with_settings(move |settings: &mut ImageLoaderSettings| {
            settings.is_srgb = srgb;
            settings.sampler = repeating_sampler();
        })
        .load(path.replace('\\', "/"))
}
