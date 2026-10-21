//! The data contract shared with the BevyBroom editor. Pure data and logic only: serde types,
//! validation, hierarchy math and revision ordering. `fixtures/` at the workspace root holds
//! JSON examples that both the editor's and these tests parse.

mod catalog;
mod hierarchy;
mod light;
mod package;
mod portal;
mod revision;
mod state;

#[cfg(test)]
mod tests;

pub use catalog::{
    CATALOG_VERSION, CatalogAlpha, CatalogMaterial, DYNLIT_RESOLVER, MaterialCatalog,
    is_contained_path,
};
pub use hierarchy::{AuthoredHierarchy, local_transform};
pub use light::{AuthoredLight, AuthoredLightType, AuthoredShadowMode};
pub use package::{
    GeometryPublication, LevelManifest, MANIFEST_FILE_NAME, geometry_file_name,
    is_geometry_file_name, sanitize_level_name,
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
