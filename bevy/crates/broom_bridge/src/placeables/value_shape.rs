//! Which editor field kind a reflected type maps to.

use std::any::TypeId;
use std::collections::BTreeMap;

use bevy::prelude::*;
use bevy::reflect::TypeInfo;
use bevy::reflect::enums::VariantInfo;

use super::assets::{PlaceableAssetRegistration, PlaceableAssetTypes};
use super::properties::PropertyValue;
use crate::protocol::PlaceableFieldKind;

/// The color types color fields accept.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ColorType {
    Color,
    Srgba,
    LinearRgba,
}

/// How a reflected type is read, written and shown.
#[derive(Clone, Debug)]
pub(crate) enum ValueShape {
    Float32,
    Float64,
    Integer {
        type_id: TypeId,
        minimum: f64,
        maximum: f64,
    },
    Bool,
    Text,
    Vector(usize),
    Color(ColorType),
    Enum(Vec<String>),
    Asset(PlaceableAssetRegistration),
    PropertyMap,
    Group,
    Unsupported,
}

impl ValueShape {
    /// The editor field kind of this shape.
    pub(crate) fn field_kind(&self) -> PlaceableFieldKind {
        match self {
            Self::Float32 | Self::Float64 => PlaceableFieldKind::Number,
            Self::Integer { .. } => PlaceableFieldKind::Integer,
            Self::Bool => PlaceableFieldKind::Bool,
            Self::Text => PlaceableFieldKind::Text,
            Self::Vector(2) => PlaceableFieldKind::Vector2,
            Self::Vector(3) => PlaceableFieldKind::Vector3,
            Self::Vector(_) => PlaceableFieldKind::Vector4,
            Self::Color(_) => PlaceableFieldKind::Color,
            Self::Enum(_) => PlaceableFieldKind::Enum,
            Self::Asset(_) => PlaceableFieldKind::Asset,
            Self::PropertyMap => PlaceableFieldKind::PropertyMap,
            Self::Group => PlaceableFieldKind::Group,
            Self::Unsupported => PlaceableFieldKind::Unsupported,
        }
    }
}

/// The shape of the type described by `info`.
pub(crate) fn shape_of(info: &TypeInfo, assets: &PlaceableAssetTypes) -> ValueShape {
    let type_id = info.type_id();
    if let Some(shape) = scalar_shape(type_id).or_else(|| compound_shape(type_id)) {
        return shape;
    }
    if let Some(registration) = assets.by_handle_type(type_id) {
        return ValueShape::Asset(registration.clone());
    }
    match info {
        TypeInfo::Enum(enum_info) => unit_enum_shape(enum_info.iter()),
        TypeInfo::Struct(_) => ValueShape::Group,
        _ => ValueShape::Unsupported,
    }
}

/// The shape of numbers, booleans and strings.
fn scalar_shape(type_id: TypeId) -> Option<ValueShape> {
    if type_id == TypeId::of::<f32>() {
        return Some(ValueShape::Float32);
    }
    if type_id == TypeId::of::<f64>() {
        return Some(ValueShape::Float64);
    }
    if type_id == TypeId::of::<bool>() {
        return Some(ValueShape::Bool);
    }
    if type_id == TypeId::of::<String>() {
        return Some(ValueShape::Text);
    }
    integer_bounds(type_id).map(|(minimum, maximum)| ValueShape::Integer {
        type_id,
        minimum,
        maximum,
    })
}

/// The shape of vectors, colors and property maps.
fn compound_shape(type_id: TypeId) -> Option<ValueShape> {
    let vector_sizes = [
        (TypeId::of::<Vec2>(), 2),
        (TypeId::of::<Vec3>(), 3),
        (TypeId::of::<Vec4>(), 4),
    ];
    if let Some((_, size)) = vector_sizes.iter().find(|(id, _)| *id == type_id) {
        return Some(ValueShape::Vector(*size));
    }
    let colors = [
        (TypeId::of::<Color>(), ColorType::Color),
        (TypeId::of::<Srgba>(), ColorType::Srgba),
        (TypeId::of::<LinearRgba>(), ColorType::LinearRgba),
    ];
    if let Some((_, color)) = colors.iter().find(|(id, _)| *id == type_id) {
        return Some(ValueShape::Color(*color));
    }
    (type_id == TypeId::of::<BTreeMap<String, PropertyValue>>()).then_some(ValueShape::PropertyMap)
}

/// The smallest and largest value of an integer type, as `f64`.
pub(crate) fn integer_bounds(type_id: TypeId) -> Option<(f64, f64)> {
    let bounds = [
        (TypeId::of::<i8>(), i8::MIN as f64, i8::MAX as f64),
        (TypeId::of::<i16>(), i16::MIN as f64, i16::MAX as f64),
        (TypeId::of::<i32>(), i32::MIN as f64, i32::MAX as f64),
        (TypeId::of::<i64>(), i64::MIN as f64, i64::MAX as f64),
        (TypeId::of::<isize>(), isize::MIN as f64, isize::MAX as f64),
        (TypeId::of::<u8>(), 0.0, u8::MAX as f64),
        (TypeId::of::<u16>(), 0.0, u16::MAX as f64),
        (TypeId::of::<u32>(), 0.0, u32::MAX as f64),
        (TypeId::of::<u64>(), 0.0, u64::MAX as f64),
        (TypeId::of::<usize>(), 0.0, usize::MAX as f64),
    ];
    bounds
        .iter()
        .find(|(id, _, _)| *id == type_id)
        .map(|(_, minimum, maximum)| (*minimum, *maximum))
}

/// An enum shape when every variant is a unit variant, otherwise unsupported.
fn unit_enum_shape<'a>(variants: impl Iterator<Item = &'a VariantInfo>) -> ValueShape {
    let mut names = Vec::new();
    for variant in variants {
        let VariantInfo::Unit(unit) = variant else {
            return ValueShape::Unsupported;
        };
        names.push(unit.name().to_owned());
    }
    ValueShape::Enum(names)
}
