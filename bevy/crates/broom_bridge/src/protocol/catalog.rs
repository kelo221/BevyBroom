//! The game-owned material catalog: stable material ids the editor assigns to faces, and how
//! the game builds each material.

use serde::{Deserialize, Serialize};

/// The catalog format version.
pub const CATALOG_VERSION: u32 = 1;

/// The resolver for plain DynLit materials described entirely by the catalog entry.
pub const DYNLIT_RESOLVER: &str = "dynlit";

/// A catalog file.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct MaterialCatalog {
    pub catalog_version: u32,
    pub materials: Vec<CatalogMaterial>,
}

/// How a material treats alpha.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CatalogAlpha {
    #[default]
    Opaque,
    /// Alpha-tested at [`CatalogMaterial::alpha_cutoff`].
    Mask,
    Blend,
}

/// One material. Texture paths are relative to the game's asset root.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct CatalogMaterial {
    /// Stable id, e.g. `stone/castle_wall`. Never reuse an id for a different material.
    pub id: String,
    /// Display name in the editor.
    #[serde(default)]
    pub label: String,
    /// Which game resolver builds the material; [`DYNLIT_RESOLVER`] by default.
    #[serde(default = "default_resolver")]
    pub resolver: String,
    /// Linear multiplier of the base color texture, sRGB `[r, g, b, a]`.
    #[serde(default = "default_base_color")]
    pub base_color: [f32; 4],
    #[serde(default)]
    pub base_color_texture: Option<String>,
    /// Tangent-space normal map, OpenGL convention (+Y up), linear.
    #[serde(default)]
    pub normal_texture: Option<String>,
    /// glTF layout: roughness in G, metallic in B, linear.
    #[serde(default)]
    pub metallic_roughness_texture: Option<String>,
    #[serde(default)]
    pub emissive: [f32; 3],
    #[serde(default)]
    pub emissive_texture: Option<String>,
    #[serde(default = "default_roughness")]
    pub roughness: f32,
    #[serde(default)]
    pub metallic: f32,
    #[serde(default)]
    pub alpha: CatalogAlpha,
    #[serde(default = "default_alpha_cutoff")]
    pub alpha_cutoff: f32,
    #[serde(default)]
    pub double_sided: bool,
    #[serde(default)]
    pub unlit: bool,
    /// Editor hint: meters covered by one texture tile.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile_meters: Option<[f32; 2]>,
}

/// Serde default for [`CatalogMaterial::resolver`].
fn default_resolver() -> String {
    DYNLIT_RESOLVER.into()
}

/// Serde default for [`CatalogMaterial::base_color`].
fn default_base_color() -> [f32; 4] {
    [1.0; 4]
}

/// Serde default for [`CatalogMaterial::roughness`].
fn default_roughness() -> f32 {
    0.85
}

/// Serde default for [`CatalogMaterial::alpha_cutoff`].
fn default_alpha_cutoff() -> f32 {
    0.5
}

impl CatalogMaterial {
    /// Every texture path the material refers to.
    pub fn texture_paths(&self) -> impl Iterator<Item = &str> {
        [
            &self.base_color_texture,
            &self.normal_texture,
            &self.metallic_roughness_texture,
            &self.emissive_texture,
        ]
        .into_iter()
        .filter_map(|path| path.as_deref())
    }
}

impl MaterialCatalog {
    /// Parses a catalog and checks ids and texture paths.
    pub fn parse(json: &str) -> Result<Self, String> {
        let catalog: Self = serde_json::from_str(json).map_err(|error| error.to_string())?;
        if catalog.catalog_version != CATALOG_VERSION {
            return Err(format!(
                "catalog version {} is not supported (expected {CATALOG_VERSION})",
                catalog.catalog_version
            ));
        }
        catalog.validate()?;
        Ok(catalog)
    }

    /// Ids must be unique and non-empty; texture paths must stay inside the asset root.
    fn validate(&self) -> Result<(), String> {
        let mut seen = std::collections::HashSet::new();
        for material in &self.materials {
            if material.id.trim().is_empty() {
                return Err("a material has an empty id".into());
            }
            if !seen.insert(material.id.as_str()) {
                return Err(format!("material id {} appears twice", material.id));
            }
            if let Some(path) = material
                .texture_paths()
                .find(|path| !is_contained_path(path))
            {
                return Err(format!(
                    "material {}: texture path {path:?} leaves the asset root",
                    material.id
                ));
            }
        }
        Ok(())
    }

    /// The material with `id`.
    pub fn get(&self, id: &str) -> Option<&CatalogMaterial> {
        self.materials.iter().find(|material| material.id == id)
    }
}

/// Whether `path` is relative and has no `..` component, so joining it to a root stays inside.
pub fn is_contained_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    !normalized.is_empty()
        && !normalized.starts_with('/')
        && !normalized.contains(':')
        && normalized.split('/').all(|part| part != "..")
}
