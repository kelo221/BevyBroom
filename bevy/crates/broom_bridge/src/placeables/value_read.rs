//! Reading reflected field values as normalized JSON values.

use std::collections::BTreeMap;

use bevy::prelude::*;
use bevy::reflect::{PartialReflect, ReflectRef};
use serde_json::{Map, Value, json};

use super::properties::PropertyValue;
use super::value_shape::{ColorType, ValueShape};

/// The normalized value of `value`, which has `shape`; null when it cannot be read.
pub(crate) fn value_read(value: &dyn PartialReflect, shape: &ValueShape) -> Value {
    match shape {
        ValueShape::Float32 => downcast_json::<f32>(value, |number| json!(number)),
        ValueShape::Float64 => downcast_json::<f64>(value, |number| json!(number)),
        ValueShape::Integer { .. } => integer_read(value),
        ValueShape::Bool => downcast_json::<bool>(value, |flag| json!(flag)),
        ValueShape::Text => downcast_json::<String>(value, |text| json!(text)),
        ValueShape::Vector(_) => vector_read(value),
        ValueShape::Color(color) => color_read(value, *color),
        ValueShape::Enum(_) => enum_read(value),
        ValueShape::Asset(registration) => {
            (registration.path_read)(value).map_or(Value::Null, Value::String)
        }
        ValueShape::PropertyMap => property_map_read(value),
        ValueShape::Group | ValueShape::Unsupported => Value::Null,
    }
}

/// The JSON of `value` downcast to `T`, or null.
fn downcast_json<T: 'static>(value: &dyn PartialReflect, convert: impl Fn(&T) -> Value) -> Value {
    value.try_downcast_ref::<T>().map_or(Value::Null, convert)
}

/// The JSON number of any integer type.
fn integer_read(value: &dyn PartialReflect) -> Value {
    macro_rules! try_integer {
        ($($integer:ty),*) => {
            $(if let Some(number) = value.try_downcast_ref::<$integer>() {
                return json!(number);
            })*
        };
    }
    try_integer!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize);
    Value::Null
}

/// The components of a `Vec2`, `Vec3` or `Vec4` as an array.
fn vector_read(value: &dyn PartialReflect) -> Value {
    if let Some(vector) = value.try_downcast_ref::<Vec2>() {
        return json!(vector.to_array());
    }
    if let Some(vector) = value.try_downcast_ref::<Vec3>() {
        return json!(vector.to_array());
    }
    value
        .try_downcast_ref::<Vec4>()
        .map_or(Value::Null, |vector| json!(vector.to_array()))
}

/// The sRGB `[r, g, b, a]` of a color value.
fn color_read(value: &dyn PartialReflect, color: ColorType) -> Value {
    let srgba = match color {
        ColorType::Color => value
            .try_downcast_ref::<Color>()
            .map(|color| color.to_srgba()),
        ColorType::Srgba => value.try_downcast_ref::<Srgba>().copied(),
        ColorType::LinearRgba => value
            .try_downcast_ref::<LinearRgba>()
            .map(|linear| Srgba::from(*linear)),
    };
    srgba.map_or(Value::Null, |srgba| json!(srgba.to_f32_array()))
}

/// The variant name of an enum value.
fn enum_read(value: &dyn PartialReflect) -> Value {
    match value.reflect_ref() {
        ReflectRef::Enum(enum_value) => json!(enum_value.variant_name()),
        _ => Value::Null,
    }
}

/// The values of a property map as a JSON object.
fn property_map_read(value: &dyn PartialReflect) -> Value {
    let Some(map) = value.try_downcast_ref::<BTreeMap<String, PropertyValue>>() else {
        return Value::Null;
    };
    let object: Map<String, Value> = map
        .iter()
        .map(|(name, property)| (name.clone(), property_value_json(property)))
        .collect();
    Value::Object(object)
}

/// One property value as a JSON scalar.
fn property_value_json(property: &PropertyValue) -> Value {
    match property {
        PropertyValue::Text(text) => json!(text),
        PropertyValue::Number(number) => json!(number),
        PropertyValue::Bool(flag) => json!(flag),
    }
}
