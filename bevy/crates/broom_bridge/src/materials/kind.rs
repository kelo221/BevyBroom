//! Which Bevy material type catalog entries become, and the values every kind reads the same
//! way from an entry.

use bevy::prelude::*;
use bevy::render::render_resource::Face;

use super::build::load_catalog_texture;
use crate::protocol::{CatalogAlpha, CatalogMaterial};

/// A material type the bridge can build from catalog entries and bind to exported primitives.
/// The bridge implements it for `StandardMaterial` and, with the `dynlight` feature, for
/// `DynLitMaterial`; a game implements it for its own material to bind that instead.
pub trait CatalogMaterialKind: Material {
    /// The plain material `material` describes, with its textures loaded through `assets`.
    /// It is what the default resolver ([`crate::protocol::DYNLIT_RESOLVER`]) builds.
    fn from_catalog(material: &CatalogMaterial, assets: &AssetServer) -> Self;
}

/// The material type the bridge binds when the game does not choose one: `DynLitMaterial` with
/// the `dynlight` feature.
#[cfg(feature = "dynlight")]
pub type DefaultCatalogMaterial = dynlight::surface::DynLitMaterial;

/// The material type the bridge binds when the game does not choose one: `StandardMaterial`
/// without the `dynlight` feature.
#[cfg(not(feature = "dynlight"))]
pub type DefaultCatalogMaterial = StandardMaterial;

/// The texture at the optional asset path `path`, loaded sRGB for colors or linear for data.
pub fn catalog_texture(
    assets: &AssetServer,
    path: &Option<String>,
    srgb: bool,
) -> Option<Handle<Image>> {
    path.as_deref()
        .map(|path| load_catalog_texture(assets, path, srgb))
}

/// The entry's base color multiplier.
pub fn catalog_base_color(material: &CatalogMaterial) -> Color {
    let [red, green, blue, alpha] = material.base_color;
    Color::srgba(red, green, blue, alpha)
}

/// The entry's emissive color in linear space.
pub fn catalog_emissive(material: &CatalogMaterial) -> LinearRgba {
    let [red, green, blue] = material.emissive;
    LinearRgba::from(Color::srgb(red, green, blue))
}

/// How the entry treats alpha, as Bevy's alpha mode.
pub fn catalog_alpha_mode(material: &CatalogMaterial) -> AlphaMode {
    match material.alpha {
        CatalogAlpha::Opaque => AlphaMode::Opaque,
        CatalogAlpha::Mask => AlphaMode::Mask(material.alpha_cutoff),
        CatalogAlpha::Blend => AlphaMode::Blend,
    }
}

/// The faces the entry culls: back faces, or none when it is double sided.
pub fn catalog_cull_mode(material: &CatalogMaterial) -> Option<Face> {
    (!material.double_sided).then_some(Face::Back)
}
