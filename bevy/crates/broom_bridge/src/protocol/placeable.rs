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
    /// How the editor names and groups each variant of an enum field, by variant name.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub variant_details: BTreeMap<String, PlaceableVariantDetail>,
    /// Enum values the field used to hold, by old value: the value each means now. The editor
    /// rewrites old values in levels, so the game never sees them.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub renamed_variants: BTreeMap<String, String>,
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

/// A type path a class had before: the bare path, or the path with the values the old class
/// gave fields a component left out, so an old `{}` keeps the meaning it had.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(untagged)]
pub enum PlaceableClassRename {
    /// Only the old type path.
    TypePath(String),
    /// The old type path with its old defaults.
    WithDefaults {
        type_path: String,
        #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
        defaults: BTreeMap<String, serde_json::Value>,
    },
}

/// Components of the class `from` whose enum field `field` holds one of `variants` move into
/// the absorbing class, keeping their values. `default` is the value an old component without
/// the field held.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PlaceableClassAbsorb {
    pub from: String,
    pub field: String,
    pub variants: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
}

/// The display name and group of one enum variant, such as "Big fridge" in "Fridges & freezers",
/// and the light an entity holding the variant carries, such as a fluorescent fixture's tube.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct PlaceableVariantDetail {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    /// The light the editor adds as a child of an entity holding this variant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub light: Option<PlaceableVariantLight>,
}

/// The shape of a variant's light.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlaceableVariantLightKind {
    /// A line of light from `from` to `to`.
    Tube,
    /// A point of light at `at`.
    Point,
}

/// The light an entity holding an enum variant carries. Positions are metres in the entity's
/// own space; the color is linear, 0 to 1 per channel.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PlaceableVariantLight {
    pub kind: PlaceableVariantLightKind,
    /// Tube only: one end.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<[f32; 3]>,
    /// Tube only: the other end.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<[f32; 3]>,
    /// Point only: where the light sits.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<[f32; 3]>,
    pub color: [f32; 3],
    pub intensity: f32,
    /// Metres from the light where its light ends.
    pub radius: f32,
    /// A DynLight effect kind in snake case, such as `fluorescent_starter`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fog: Option<PlaceableVariantLightFog>,
}

/// Volumetric fog hanging from a variant's light down to the floor and `below_floor_m` more.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct PlaceableVariantLightFog {
    pub intensity: f32,
    pub thickness: f32,
    /// Distance in metres within which objects inside the fog stay clearly visible.
    pub visibility_m: f32,
    /// How far below the floor the fog reaches, in metres.
    pub below_floor_m: f32,
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

/// How a game treats the collision of brush entities carrying a class.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum PlaceableCollisionKind {
    /// Blocks movement.
    #[default]
    Solid,
    /// An area the game reads, such as a finish zone; nothing collides and it is not drawn.
    Volume,
    /// Drawn only.
    None,
}

/// Parameter kind accepted by an entity I/O input or emitted by an output.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum PlaceableIoParameterKind {
    #[default]
    None,
    String,
    Number,
    Integer,
    Bool,
}

/// Metadata for one declared entity I/O input or output pin on a placeable class.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct PlaceableIoPin {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parameter_kind: Option<PlaceableIoParameterKind>,
}

/// One authored entity I/O output connection row on an object.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AuthoredLogicOutput {
    pub output: String,
    pub target: String,
    pub input: String,
    #[serde(default)]
    pub parameter: String,
    #[serde(default)]
    pub delay: f32,
    #[serde(default = "default_times_to_fire")]
    pub times_to_fire: i32,
}

fn default_times_to_fire() -> i32 {
    -1
}

/// The box the editor draws as the marker of a game entity carrying a class, in metres in the
/// entity's own space.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PlaceableMarkerBox {
    /// Edge lengths along x, y and z.
    pub size: [f32; 3],
    /// Where the box's centre sits relative to the entity's origin.
    #[serde(default)]
    pub offset: [f32; 3],
    /// A binary glTF model, relative to the project's asset root, that the editor draws at the
    /// entity's origin inside the box.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
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
    /// The name of the editor icon drawn on markers and listed in menus, such as
    /// `lightbulb`; the editor shows its default game entity icon for unknown names.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// The marker box of entities whose box is not picked by a field value.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub marker_box: Option<PlaceableMarkerBox>,
    /// The field path whose value, as text, picks the marker box from `marker_boxes`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub marker_box_field: Option<String>,
    /// Marker boxes by the text value of `marker_box_field`.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub marker_boxes: BTreeMap<String, PlaceableMarkerBox>,
    /// Type paths this class had before, with what an old component left out meant. The
    /// editor rewrites components of these type paths into this class.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub renamed_from: Vec<PlaceableClassRename>,
    /// Components of other classes this class takes over by the value of one of their enum
    /// fields, such as a store prop holding a freezer becoming a stock fixture.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub absorbs: Vec<PlaceableClassAbsorb>,
    /// The collision kind brush entities carrying this class take unless they override it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collision: Option<PlaceableCollisionKind>,
    pub fields: Vec<PlaceableField>,
    /// Declared entity I/O inputs on this class.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub inputs: Vec<PlaceableIoPin>,
    /// Declared entity I/O outputs on this class.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub outputs: Vec<PlaceableIoPin>,
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
