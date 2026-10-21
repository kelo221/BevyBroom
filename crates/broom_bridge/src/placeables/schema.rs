//! Describing placeable components for the editor: every field with its kind, attributes and the
//! value the component's `Default` gives it.

use std::path::Path;

use bevy::prelude::*;
use bevy::reflect::attributes::CustomAttributes;
use bevy::reflect::{GetPath, TypeInfo, TypeRegistry};

use super::assets::PlaceableAssetTypes;
use super::attributes::{FieldHidden, FieldLabel, FieldRange, FieldStep};
use super::registry::{PlaceableClasses, PlaceableOptions};
use super::value_read::value_read;
use super::value_shape::{ValueShape, shape_of};
use crate::protocol::{PlaceableClass, PlaceableClassList, PlaceableField};

/// One field being described: where it is, what it is and how it is tuned.
struct FieldSource<'a> {
    path: String,
    name: String,
    info: Option<&'static TypeInfo>,
    attributes: &'a CustomAttributes,
}

/// The `broom.placeable_classes` reply: every registered class found in `registry`, and the
/// asset types with their files under `asset_root`.
pub(crate) fn class_list(
    registry: &TypeRegistry,
    classes: &PlaceableClasses,
    assets: &PlaceableAssetTypes,
    asset_root: &Path,
) -> PlaceableClassList {
    let (mut asset_types, asset_generation) = assets.describe(asset_root);
    for asset_type in asset_types
        .iter_mut()
        .filter(|asset_type| asset_type.editable)
    {
        asset_type.fields =
            type_fields_describe(registry, &asset_type.type_path, assets).unwrap_or_default();
    }
    PlaceableClassList {
        generation: classes.generation(),
        asset_generation,
        classes: classes
            .iter()
            .filter_map(|(type_path, options)| class_describe(registry, type_path, options, assets))
            .collect(),
        asset_types,
    }
}

/// The description of the class at `type_path`, or `None` when it is not reflected with a
/// `Default`.
pub(crate) fn class_describe(
    registry: &TypeRegistry,
    type_path: &str,
    options: &PlaceableOptions,
    assets: &PlaceableAssetTypes,
) -> Option<PlaceableClass> {
    let info = registry.get_with_type_path(type_path)?.type_info();
    Some(PlaceableClass {
        type_path: type_path.to_owned(),
        label: options
            .label
            .clone()
            .unwrap_or_else(|| info.type_path_table().short_path().to_owned()),
        category: options.category.clone(),
        placement: options.placement,
        marker_color: options.marker_color.to_f32_array_no_alpha(),
        fields: type_fields_describe(registry, type_path, assets)?,
    })
}

/// The fields of the type at `type_path` with its defaults, or `None` when it is not reflected
/// with a `Default`.
pub(crate) fn type_fields_describe(
    registry: &TypeRegistry,
    type_path: &str,
    assets: &PlaceableAssetTypes,
) -> Option<Vec<PlaceableField>> {
    let registration = registry.get_with_type_path(type_path)?;
    let default = registration.data::<ReflectDefault>()?.default();
    Some(fields_describe(
        registration.type_info(),
        "",
        default.as_ref(),
        assets,
    ))
}

/// The fields of a struct or tuple struct whose own path is `prefix`; empty for other types.
pub(crate) fn fields_describe(
    info: &TypeInfo,
    prefix: &str,
    root: &dyn Reflect,
    assets: &PlaceableAssetTypes,
) -> Vec<PlaceableField> {
    let sources: Vec<FieldSource> = match info {
        TypeInfo::Struct(struct_info) => struct_info
            .iter()
            .map(|field| FieldSource {
                path: named_path(prefix, field.name()),
                name: field.name().to_owned(),
                info: field.type_info(),
                attributes: field.custom_attributes(),
            })
            .collect(),
        TypeInfo::TupleStruct(tuple_info) => tuple_info
            .iter()
            .map(|field| FieldSource {
                path: format!("{prefix}.{}", field.index()),
                name: field.index().to_string(),
                info: field.type_info(),
                attributes: field.custom_attributes(),
            })
            .collect(),
        _ => Vec::new(),
    };
    sources
        .iter()
        .map(|source| field_describe(source, root, assets))
        .collect()
}

/// The path of the named field `name` inside the value at `prefix`.
fn named_path(prefix: &str, name: &str) -> String {
    if prefix.is_empty() {
        name.to_owned()
    } else {
        format!("{prefix}.{name}")
    }
}

/// The description of one field, with its default read from `root`.
fn field_describe(
    source: &FieldSource,
    root: &dyn Reflect,
    assets: &PlaceableAssetTypes,
) -> PlaceableField {
    let shape = source
        .info
        .map_or(ValueShape::Unsupported, |info| shape_of(info, assets));
    let value = root.reflect_path(source.path.as_str()).ok();
    let mut field = PlaceableField {
        path: source.path.clone(),
        label: source.name.clone(),
        kind: shape.field_kind(),
        default: value.map_or(serde_json::Value::Null, |value| value_read(value, &shape)),
        minimum: None,
        maximum: None,
        step: None,
        variants: Vec::new(),
        asset_type: None,
        children: Vec::new(),
        hidden: false,
    };
    shape_details_apply(&mut field, &shape, source, root, assets);
    attributes_apply(&mut field, source.attributes);
    field
}

/// Fills the kind-specific parts of `field`: integer bounds, variants, asset type, children.
fn shape_details_apply(
    field: &mut PlaceableField,
    shape: &ValueShape,
    source: &FieldSource,
    root: &dyn Reflect,
    assets: &PlaceableAssetTypes,
) {
    match shape {
        ValueShape::Integer {
            minimum, maximum, ..
        } => {
            field.minimum = Some(*minimum);
            field.maximum = Some(*maximum);
            field.step = Some(1.0);
        }
        ValueShape::Enum(variants) => field.variants = variants.clone(),
        ValueShape::Asset(registration) => {
            field.asset_type = Some(registration.asset_type_path.clone())
        }
        ValueShape::Group => {
            if let Some(info) = source.info {
                field.children = fields_describe(info, &source.path, root, assets);
            }
        }
        _ => {}
    }
}

/// Applies the editor attributes of a field.
fn attributes_apply(field: &mut PlaceableField, attributes: &CustomAttributes) {
    if let Some(range) = attributes.get::<FieldRange>() {
        field.minimum = Some(range.minimum);
        field.maximum = Some(range.maximum);
    }
    if let Some(step) = attributes.get::<FieldStep>() {
        field.step = Some(step.0);
    }
    if let Some(label) = attributes.get::<FieldLabel>() {
        field.label = label.0.to_owned();
    }
    field.hidden = attributes.contains::<FieldHidden>();
}
