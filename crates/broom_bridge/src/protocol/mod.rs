//! The data contract shared with the BevyBroom editor. Pure data and logic only: serde types,
//! validation, hierarchy math and revision ordering. `fixtures/` at the workspace root holds
//! JSON examples that both the editor's and these tests parse.

mod catalog;
mod data_asset;
mod hierarchy;
mod light;
mod light_features;
mod package;
mod placeable;
mod portal;
mod revision;
mod state;

#[cfg(test)]
mod light_feature_tests;
#[cfg(test)]
mod tests;

pub use catalog::{
    CATALOG_VERSION, CatalogAlpha, CatalogMaterial, DYNLIT_RESOLVER, MaterialCatalog,
    is_contained_path,
};
pub use data_asset::{
    DataAssetReadReply, DataAssetReadRequest, DataAssetValues, DataAssetWriteReply,
    DataAssetWriteRequest, validate_data_asset_values,
};
pub use hierarchy::{AuthoredHierarchy, local_transform};
pub use light::{AuthoredLight, AuthoredLightType, AuthoredShadowMode};
pub use light_features::{
    AuthoredBounce, AuthoredBounceCompression, AuthoredEffectKind, AuthoredFog, AuthoredFogShape,
    AuthoredIllumination, AuthoredLightEffect, AuthoredShimmer, AuthoredShimmerKind,
    AuthoredTransparency,
};
pub use package::{
    GeometryPublication, LevelManifest, MANIFEST_FILE_NAME, geometry_file_name,
    is_geometry_file_name, sanitize_level_name,
};
pub(crate) use placeable::validate_components;
pub use placeable::{
    AuthoredComponents, PlaceableAssetType, PlaceableClass, PlaceableClassList, PlaceableField,
    PlaceableFieldKind, PlaceablePlacement,
};
pub use portal::{AuthoredPortal, AuthoredRoom};
pub use revision::{RevisionGate, RevisionVerdict};
pub use state::{
    AuthoredObject, AuthoredObjectKind, AuthoredState, PROTOCOL_VERSION, StateRejection,
};

/// The glTF extras key carrying an object's stable editor id on exported nodes.
pub const EXTRAS_OBJECT_ID: &str = "broom_id";
/// The glTF material extras key carrying the catalog material id.
pub const EXTRAS_MATERIAL_ID: &str = "broom_material";
/// The glTF node extras key carrying an object's placed game components as
/// [`AuthoredComponents`].
pub const EXTRAS_COMPONENTS: &str = "broom_components";
