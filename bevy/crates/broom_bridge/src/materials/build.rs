//! Building DynLit materials from catalog entries, and the registry of game resolvers.

use std::collections::HashMap;

use bevy::image::{ImageAddressMode, ImageLoaderSettings, ImageSampler, ImageSamplerDescriptor};
use bevy::prelude::*;
use bevy::render::render_resource::Face;
use dynlight::surface::{DynLitMaterial, ShadingModel};

use crate::protocol::{CatalogAlpha, CatalogMaterial, DYNLIT_RESOLVER};

/// Builds the material for one catalog entry. Games register their own for entries whose
/// `resolver` names them, e.g. to add game-specific textures or tweak shading.
pub type CatalogResolver = fn(&CatalogMaterial, &AssetServer) -> DynLitMaterial;

/// Game resolvers by name. [`DYNLIT_RESOLVER`] is always present.
#[derive(Resource, Clone)]
pub struct CatalogResolvers(HashMap<String, CatalogResolver>);

impl Default for CatalogResolvers {
    fn default() -> Self {
        let mut resolvers = HashMap::new();
        resolvers.insert(
            DYNLIT_RESOLVER.to_owned(),
            dynlit_from_catalog as CatalogResolver,
        );
        Self(resolvers)
    }
}

impl CatalogResolvers {
    /// Adds or replaces the resolver called `name`.
    pub fn register(&mut self, name: impl Into<String>, resolver: CatalogResolver) {
        self.0.insert(name.into(), resolver);
    }

    /// Builds `material` with its resolver, or an error naming the missing resolver.
    pub fn build(
        &self,
        material: &CatalogMaterial,
        assets: &AssetServer,
    ) -> Result<DynLitMaterial, String> {
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

/// The plain DynLit material an entry describes.
pub fn dynlit_from_catalog(material: &CatalogMaterial, assets: &AssetServer) -> DynLitMaterial {
    let texture = |path: &Option<String>, srgb: bool| {
        path.as_deref()
            .map(|path| load_catalog_texture(assets, path, srgb))
    };
    let metallic = material.metallic > 0.0
        || material.normal_texture.is_some()
        || material.metallic_roughness_texture.is_some();
    let [r, g, b, a] = material.base_color;
    let [er, eg, eb] = material.emissive;
    DynLitMaterial {
        base_color: Color::srgba(r, g, b, a),
        base_color_texture: texture(&material.base_color_texture, true),
        emissive: LinearRgba::from(Color::srgb(er, eg, eb)),
        emissive_texture: texture(&material.emissive_texture, true),
        shading: if metallic {
            ShadingModel::Metallic
        } else {
            ShadingModel::Diffuse
        },
        metallic: material.metallic,
        perceptual_roughness: material.roughness,
        metallic_roughness_texture: texture(&material.metallic_roughness_texture, false),
        normal_map_texture: texture(&material.normal_texture, false),
        alpha_mode: match material.alpha {
            CatalogAlpha::Opaque => AlphaMode::Opaque,
            CatalogAlpha::Mask => AlphaMode::Mask(material.alpha_cutoff),
            CatalogAlpha::Blend => AlphaMode::Blend,
        },
        cull_mode: (!material.double_sided).then_some(Face::Back),
        unlit: material.unlit,
        ..default()
    }
}
