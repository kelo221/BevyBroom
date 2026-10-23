//! Composing a component from its default and the editor's overrides.

use std::collections::BTreeMap;

use bevy::prelude::*;
use serde_json::{Value, json};

use super::*;
use crate::placeables::BroomProperties;
use crate::placeables::compose::{ComposeContext, Composed, compose};
use crate::placeables::{PlaceableAssetTypes, PropertyValue};

/// `fields` as an override map.
fn overrides(fields: &[(&str, Value)]) -> BTreeMap<String, Value> {
    fields
        .iter()
        .map(|(path, value)| ((*path).to_owned(), value.clone()))
        .collect()
}

/// The component of type `T` composed in `app` from `fields`.
fn composed_of<T: TypePath>(app: &App, fields: &[(&str, Value)]) -> Composed {
    let world = app.world();
    let registry = world.resource::<AppTypeRegistry>().read();
    let context = ComposeContext {
        registry: &registry,
        assets: world.resource::<PlaceableAssetTypes>(),
        asset_server: None,
    };
    compose(&context, &type_path_of::<T>(), &overrides(fields)).expect("the type composes")
}

/// The composed value as `T`.
fn value_of<T: Reflect + Clone>(composed: &Composed) -> T {
    composed
        .value
        .downcast_ref::<T>()
        .expect("the composed value has the component's type")
        .clone()
}

/// Without overrides the composed component equals its `Default`.
#[test]
fn no_overrides_give_the_default() {
    let app = placeables_app();
    let composed = composed_of::<TestDoor>(&app, &[]);
    assert!(composed.errors.is_empty());
    assert_eq!(value_of::<TestDoor>(&composed), TestDoor::default());
}

/// Every overridable kind is applied, nested and tuple fields included, and fields without an
/// override keep their default.
#[test]
fn overrides_of_every_kind_are_applied() {
    let app = placeables_app();
    let default = TestDoor::default();
    let speed = default.speed + 1.5;
    let uses = default.uses + 2;
    let offset = default.offset + Vec3::ONE;
    let tint = Srgba::new(0.0, 0.25, 1.0, 0.5);
    let angle = default.hinge.angle * 0.5;
    let kind = if default.kind == TestDoorKind::Glass {
        TestDoorKind::Wooden
    } else {
        TestDoorKind::Glass
    };
    let composed = composed_of::<TestDoor>(
        &app,
        &[
            ("speed", json!(speed)),
            ("locked", json!(!default.locked)),
            ("key_name", json!("iron key")),
            ("uses", json!(uses)),
            ("kind", json!(format!("{kind:?}"))),
            ("offset", json!(offset.to_array())),
            ("tint", json!(tint.to_f32_array())),
            ("hinge.angle", json!(angle)),
        ],
    );
    assert!(composed.errors.is_empty(), "{:?}", composed.errors);
    let door = value_of::<TestDoor>(&composed);
    assert_eq!(door.speed, speed);
    assert_eq!(door.locked, !default.locked);
    assert_eq!(door.key_name, "iron key");
    assert_eq!(door.uses, uses);
    assert_eq!(door.kind, kind);
    assert_eq!(door.offset, offset);
    assert!(door.tint.to_srgba().to_vec4().distance(tint.to_vec4()) < 1e-5);
    assert_eq!(door.hinge.angle, angle);
    assert_eq!(door.hinge.squeaky, default.hinge.squeaky);
    assert_eq!(door.secret, default.secret);
    let weight = value_of::<TestWeight>(&composed_of::<TestWeight>(&app, &[(".0", json!(3.0))]));
    assert_eq!(weight.0, 3.0);
}

/// Overrides that do not fit are reported per field and those fields keep their default while
/// the others still apply.
#[test]
fn bad_overrides_are_reported_and_keep_the_default() {
    let app = placeables_app();
    let default = TestDoor::default();
    let composed = composed_of::<TestDoor>(
        &app,
        &[
            ("speed", json!(default.speed + 1.0)),
            ("uses", json!(f64::from(u8::MAX) + 1.0)),
            ("kind", json!("Cardboard")),
            ("locked", json!("yes")),
            ("missing", json!(1)),
            ("stats", json!("../outside.stats.ron")),
        ],
    );
    assert_eq!(composed.errors.len(), 5, "{:?}", composed.errors);
    for path in ["uses", "kind", "locked", "missing", "stats"] {
        assert!(
            composed
                .errors
                .iter()
                .any(|error| error.contains(&format!("field {path}:"))),
            "an error names {path}: {:?}",
            composed.errors
        );
    }
    let door = value_of::<TestDoor>(&composed);
    assert_eq!(door.speed, default.speed + 1.0);
    assert_eq!(door.uses, default.uses);
    assert_eq!(door.kind, default.kind);
    assert_eq!(door.locked, default.locked);
}

/// Property maps take text, numbers and booleans and reject other values.
#[test]
fn property_maps_take_scalars_only() {
    let app = placeables_app();
    let composed = composed_of::<BroomProperties>(
        &app,
        &[(
            "values",
            json!({ "name": "gate", "weight": 4.5, "open": true }),
        )],
    );
    assert!(composed.errors.is_empty(), "{:?}", composed.errors);
    let properties = value_of::<BroomProperties>(&composed);
    assert_eq!(properties.text("name"), Some("gate"));
    assert_eq!(properties.number("weight"), Some(4.5));
    assert_eq!(properties.flag("open"), Some(true));
    assert_eq!(properties.values.len(), 3);
    assert!(matches!(
        properties.values.get("name"),
        Some(PropertyValue::Text(_))
    ));
    let rejected = composed_of::<BroomProperties>(&app, &[("values", json!({ "list": [1, 2] }))]);
    assert_eq!(rejected.errors.len(), 1);
    assert!(value_of::<BroomProperties>(&rejected).values.is_empty());
}

/// Composing a type that is not registered fails as a whole.
#[test]
fn unknown_types_do_not_compose() {
    let app = placeables_app();
    let world = app.world();
    let registry = world.resource::<AppTypeRegistry>().read();
    let context = ComposeContext {
        registry: &registry,
        assets: world.resource::<PlaceableAssetTypes>(),
        asset_server: None,
    };
    assert!(compose(&context, "game::NotRegistered", &BTreeMap::new()).is_err());
}
