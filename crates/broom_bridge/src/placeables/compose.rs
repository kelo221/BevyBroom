//! Building a reflected value from its type's `Default` and the editor's field overrides.

use std::collections::BTreeMap;

use bevy::prelude::*;
use bevy::reflect::{GetPath, PartialReflect, TypeRegistry};
use serde_json::Value;

use super::assets::PlaceableAssetTypes;
use super::value_shape::shape_of;
use super::value_write::value_write;

/// What composing needs besides the overrides.
pub(crate) struct ComposeContext<'a> {
    pub registry: &'a TypeRegistry,
    pub assets: &'a PlaceableAssetTypes,
    /// Needed by asset fields only.
    pub asset_server: Option<&'a AssetServer>,
}

/// A composed value and the overrides that could not be applied; those fields keep their
/// default.
pub(crate) struct Composed {
    pub value: Box<dyn Reflect>,
    pub errors: Vec<String>,
}

/// The type at `type_path` built from its default with `fields` applied by reflect path.
pub(crate) fn compose(
    context: &ComposeContext,
    type_path: &str,
    fields: &BTreeMap<String, Value>,
) -> Result<Composed, String> {
    let registration = context
        .registry
        .get_with_type_path(type_path)
        .ok_or_else(|| format!("{type_path} is not a registered type"))?;
    let default = registration
        .data::<ReflectDefault>()
        .ok_or_else(|| format!("{type_path} does not reflect Default"))?;
    let mut value = default.default();
    let errors = fields
        .iter()
        .filter_map(|(path, field)| {
            field_apply(value.as_mut(), path, field, context)
                .err()
                .map(|error| format!("{type_path} field {path}: {error}"))
        })
        .collect();
    Ok(Composed { value, errors })
}

/// Sets the field at `path` inside `root` to the normalized `value`.
pub(crate) fn field_apply(
    root: &mut dyn Reflect,
    path: &str,
    value: &Value,
    context: &ComposeContext,
) -> Result<(), String> {
    let target = root
        .reflect_path_mut(path)
        .map_err(|error| error.to_string())?;
    let info = target
        .get_represented_type_info()
        .ok_or("the field has no type information")?;
    let shape = shape_of(info, context.assets);
    let written = value_write(value, &shape, context.asset_server)?;
    value_assign(target, written)
}

/// Replaces `target` with `written`: concrete values are set whole, dynamic ones (enum
/// variants) are applied.
fn value_assign(
    target: &mut dyn PartialReflect,
    written: Box<dyn PartialReflect>,
) -> Result<(), String> {
    match written.try_into_reflect() {
        Ok(concrete) => match target.try_as_reflect_mut() {
            Some(target) => target
                .set(concrete)
                .map_err(|_| "the value does not have the field's type".to_owned()),
            None => target
                .try_apply(concrete.as_partial_reflect())
                .map_err(|error| error.to_string()),
        },
        Err(dynamic) => target
            .try_apply(dynamic.as_ref())
            .map_err(|error| error.to_string()),
    }
}
