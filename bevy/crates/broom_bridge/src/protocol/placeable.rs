//! Game components placed from the editor: the per-object component overrides the editor sends
//! and the class list the game reports so the editor can show fields and defaults.
//!
//! Field values travel in a normalized form that does not depend on Bevy's serde layout:
//! numbers, booleans and strings as JSON scalars, vectors as arrays, colors as sRGB
//! `[r, g, b, a]`, unit enum variants as their name, asset handles as asset paths and property
//! maps as objects of scalars.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Component overrides of one object: component type path → field path → normalized value.
/// Fields that are not listed keep the component's `Default` value.
pub type AuthoredComponents = BTreeMap<String, BTreeMap<String, Value>>;

/// How the editor shows and edits one field.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlaceableFieldKind {
    Number,
    Integer,
    Bool,
    Text,
    Vector2,
    Vector3,
    Vector4,
    Color,
    /// An enum whose variants carry no data; the value is the variant name.
    Enum,
    /// A `Handle` to an asset; the value is the asset path or null.
    Asset,
    /// A map of names to text, number or boolean values.
    PropertyMap,
    /// A nested struct; its fields are listed as children.
    Group,
    /// A field the editor cannot edit; it keeps its default.
    Unsupported,
}

/// One field of a placeable class.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PlaceableField {
    /// The reflect path of the field inside the component, e.g. `speed` or `settings.radius`.
    pub path: String,
    pub label: String,
    pub kind: PlaceableFieldKind,
    /// The normalized value the component's `Default` has; null for groups.
    #[serde(default)]
    pub default: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step: Option<f64>,
    /// Variant names of enum fields.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variants: Vec<String>,
    /// The asset type path of asset fields.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_type: Option<String>,
    /// Fields of group fields.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<PlaceableField>,
    /// Hidden fields keep their default and are not shown.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub hidden: bool,
}

/// Where a placeable class may be attached.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum PlaceablePlacement {
    /// Only on game entities: empty points without geometry.
    Point,
    /// On any object: brushes, meshes, groups, lights, rooms, portals and game entities.
    #[default]
    Any,
}

/// A component type the game lets the editor place.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PlaceableClass {
    /// The component's full type path, the key of [`AuthoredComponents`].
    pub type_path: String,
    pub label: String,
    /// Menu category in the editor's Add menu.
    pub category: String,
    pub placement: PlaceablePlacement,
    /// sRGB color of the editor marker.
    pub marker_color: [f32; 3],
    pub fields: Vec<PlaceableField>,
}

/// An asset type that asset fields can reference.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PlaceableAssetType {
    pub type_path: String,
    pub label: String,
    /// File extensions without the dot.
    pub extensions: Vec<String>,
    /// Whether the editor may read and write files of this type as data assets.
    pub editable: bool,
    /// Asset paths of matching files under the asset root, sorted.
    pub paths: Vec<String>,
    /// The fields of editable data asset types, with the type's defaults.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<PlaceableField>,
}

/// The `broom.placeable_classes` reply.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct PlaceableClassList {
    /// Changes when the registered classes change.
    pub generation: u64,
    /// Changes when the asset files of any asset type change.
    pub asset_generation: u64,
    pub classes: Vec<PlaceableClass>,
    pub asset_types: Vec<PlaceableAssetType>,
}

/// Checks that every component and field path is named.
pub(crate) fn validate_components(components: &AuthoredComponents) -> Result<(), String> {
    for (type_path, fields) in components {
        if type_path.trim().is_empty() {
            return Err("a component has an empty type path".into());
        }
        if fields.keys().any(|path| path.trim().is_empty()) {
            return Err(format!(
                "component {type_path} has a field with an empty path"
            ));
        }
    }
    Ok(())
}
