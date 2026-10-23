//! Turning normalized JSON values into reflected values of a field's type.

use std::any::TypeId;
use std::collections::BTreeMap;

use bevy::prelude::*;
use bevy::reflect::PartialReflect;
use bevy::reflect::enums::{DynamicEnum, DynamicVariant};
use serde_json::Value;

use super::assets::PlaceableAssetRegistration;
use super::properties::PropertyValue;
use super::value_shape::{ColorType, ValueShape};

/// A reflected value, or why the JSON value does not fit the field.
pub(crate) type WrittenValue = Result<Box<dyn PartialReflect>, String>;

/// The reflected value of `value` for a field of `shape`. Asset fields need `asset_server`.
pub(crate) fn value_write(
    value: &Value,
    shape: &ValueShape,
    asset_server: Option<&AssetServer>,
) -> WrittenValue {
    match shape {
        ValueShape::Float32 => number_of(value).map(|number| boxed(number as f32)),
        ValueShape::Float64 => number_of(value).map(boxed),
        ValueShape::Integer {
            type_id,
            minimum,
            maximum,
        } => integer_write(value, *type_id, *minimum, *maximum),
        ValueShape::Bool => value
            .as_bool()
            .map(boxed)
            .ok_or_else(|| expected("a boolean", value)),
        ValueShape::Text => value
            .as_str()
            .map(|text| boxed(text.to_owned()))
            .ok_or_else(|| expected("text", value)),
        ValueShape::Vector(size) => vector_write(value, *size),
        ValueShape::Color(color) => color_write(value, *color),
        ValueShape::Enum(variants) => enum_write(value, variants),
        ValueShape::Asset(registration) => asset_write(value, registration, asset_server),
        ValueShape::PropertyMap => property_map_write(value),
        ValueShape::Group | ValueShape::Unsupported => {
            Err("this field cannot be set from the editor".into())
        }
    }
}

/// Boxes a concrete reflected value.
fn boxed<T: PartialReflect>(value: T) -> Box<dyn PartialReflect> {
    Box::new(value)
}

/// The error for a value of the wrong JSON type.
fn expected(what: &str, value: &Value) -> String {
    format!("expected {what}, found {value}")
}

/// A finite JSON number.
fn number_of(value: &Value) -> Result<f64, String> {
    value
        .as_f64()
        .filter(|number| number.is_finite())
        .ok_or_else(|| expected("a number", value))
}

/// A whole number in `minimum..=maximum` as the integer type with `type_id`.
fn integer_write(value: &Value, type_id: TypeId, minimum: f64, maximum: f64) -> WrittenValue {
    let number = number_of(value)?;
    if number.fract() != 0.0 || number < minimum || number > maximum {
        return Err(format!(
            "{number} is not a whole number from {minimum} to {maximum}"
        ));
    }
    macro_rules! integer_of_type {
        ($($integer:ty),*) => {
            $(if type_id == TypeId::of::<$integer>() {
                return Ok(boxed(number as $integer));
            })*
        };
    }
    integer_of_type!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize);
    Err("the field is not an integer".into())
}

/// `size` finite numbers from a JSON array.
fn numbers_of(value: &Value, size: usize) -> Result<Vec<f32>, String> {
    let items = value.as_array().filter(|items| items.len() == size);
    let items = items.ok_or_else(|| expected(&format!("an array of {size} numbers"), value))?;
    items
        .iter()
        .map(|item| number_of(item).map(|number| number as f32))
        .collect()
}

/// A `Vec2`, `Vec3` or `Vec4` from an array.
fn vector_write(value: &Value, size: usize) -> WrittenValue {
    let numbers = numbers_of(value, size)?;
    Ok(match size {
        2 => boxed(Vec2::from_slice(&numbers)),
        3 => boxed(Vec3::from_slice(&numbers)),
        _ => boxed(Vec4::from_slice(&numbers)),
    })
}

/// A color of type `color` from sRGB `[r, g, b, a]`.
fn color_write(value: &Value, color: ColorType) -> WrittenValue {
    let numbers = numbers_of(value, 4)?;
    let srgba = Srgba::new(numbers[0], numbers[1], numbers[2], numbers[3]);
    Ok(match color {
        ColorType::Color => boxed(Color::Srgba(srgba)),
        ColorType::Srgba => boxed(srgba),
        ColorType::LinearRgba => boxed(LinearRgba::from(srgba)),
    })
}

/// A unit variant named by a string.
fn enum_write(value: &Value, variants: &[String]) -> WrittenValue {
    let name = value
        .as_str()
        .ok_or_else(|| expected("a variant name", value))?;
    if !variants.iter().any(|variant| variant == name) {
        return Err(format!("{name} is not one of {}", variants.join(", ")));
    }
    Ok(boxed(DynamicEnum::new(name, DynamicVariant::Unit)))
}

/// A handle loaded from an asset path, or an empty handle for null.
fn asset_write(
    value: &Value,
    registration: &PlaceableAssetRegistration,
    asset_server: Option<&AssetServer>,
) -> WrittenValue {
    if value.is_null() {
        return Ok((registration.empty)());
    }
    let path = value
        .as_str()
        .ok_or_else(|| expected("an asset path", value))?;
    if !crate::protocol::is_contained_path(path) {
        return Err(format!("{path:?} is not inside the asset root"));
    }
    let server = asset_server.ok_or("asset fields need an asset server")?;
    Ok((registration.load)(server, path))
}

/// A property map from an object of text, number and boolean values.
fn property_map_write(value: &Value) -> WrittenValue {
    let object = value
        .as_object()
        .ok_or_else(|| expected("an object", value))?;
    let mut map = BTreeMap::new();
    for (name, item) in object {
        let property = match item {
            Value::String(text) => PropertyValue::Text(text.clone()),
            Value::Bool(flag) => PropertyValue::Bool(*flag),
            Value::Number(_) => PropertyValue::Number(number_of(item)?),
            _ => {
                return Err(format!(
                    "property {name}: {}",
                    expected("text, a number or a boolean", item)
                ));
            }
        };
        map.insert(name.clone(), property);
    }
    Ok(boxed(map))
}
