//! Class descriptions: every field with its kind, attributes and the component's own default.

use bevy::prelude::*;
use serde_json::{Value, json};

use super::*;
use crate::placeables::class_list;
use crate::placeables::{BroomProperties, PlaceableAssetTypes, PlaceableClasses};
use crate::protocol::{
    PlaceableClass, PlaceableClassList, PlaceableField, PlaceableFieldKind, PlaceablePlacement,
};
use crate::test_support::TemporaryDirectory;

/// The class list of `app` with asset files looked up under `asset_root`.
fn classes_of(app: &App, asset_root: &std::path::Path) -> PlaceableClassList {
    let world = app.world();
    class_list(
        &world.resource::<AppTypeRegistry>().read(),
        world.resource::<PlaceableClasses>(),
        world.resource::<PlaceableAssetTypes>(),
        asset_root,
    )
}

/// The class of `T` in `list`.
fn class_of<T: TypePath>(list: &PlaceableClassList) -> &PlaceableClass {
    let type_path = type_path_of::<T>();
    list.classes
        .iter()
        .find(|class| class.type_path == type_path)
        .unwrap_or_else(|| panic!("{type_path} is described"))
}

/// The field at `path` among `fields`, searching groups too.
fn field_at<'a>(fields: &'a [PlaceableField], path: &str) -> &'a PlaceableField {
    fields
        .iter()
        .find(|field| field.path == path)
        .or_else(|| {
            fields
                .iter()
                .filter(|field| !field.children.is_empty())
                .find_map(|group| group.children.iter().find(|field| field.path == path))
        })
        .unwrap_or_else(|| panic!("field {path} is described"))
}

/// Every registered class is described with its options, and the built-in properties
/// component is always among them.
#[test]
fn registered_classes_are_described_with_their_options() {
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_options");
    let list = classes_of(&app, directory.path());
    let door = class_of::<TestDoor>(&list);
    assert_eq!(door.category, "Doors");
    assert_eq!(door.placement, PlaceablePlacement::Point);
    assert_eq!(door.label, TestDoor::short_type_path());
    let weight = class_of::<TestWeight>(&list);
    assert_eq!(weight.placement, PlaceablePlacement::Any);
    let properties = class_of::<BroomProperties>(&list);
    assert_eq!(
        field_at(&properties.fields, "values").kind,
        PlaceableFieldKind::PropertyMap
    );
    assert!(list.generation > 0);
}

/// Each field's kind follows its Rust type and its default is the component's `Default`
/// value in the normalized form.
#[test]
fn fields_carry_kinds_and_the_component_defaults() {
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_fields");
    let list = classes_of(&app, directory.path());
    let fields = &class_of::<TestDoor>(&list).fields;
    let door = TestDoor::default();
    let expected: [(&str, PlaceableFieldKind, Value); 9] = [
        ("speed", PlaceableFieldKind::Number, json!(door.speed)),
        ("locked", PlaceableFieldKind::Bool, json!(door.locked)),
        ("key_name", PlaceableFieldKind::Text, json!(door.key_name)),
        ("uses", PlaceableFieldKind::Integer, json!(door.uses)),
        (
            "kind",
            PlaceableFieldKind::Enum,
            json!(format!("{:?}", door.kind)),
        ),
        (
            "offset",
            PlaceableFieldKind::Vector3,
            json!(door.offset.to_array()),
        ),
        (
            "tint",
            PlaceableFieldKind::Color,
            json!(door.tint.to_srgba().to_f32_array()),
        ),
        (
            "hinge.angle",
            PlaceableFieldKind::Number,
            json!(door.hinge.angle),
        ),
        (
            "hinge.squeaky",
            PlaceableFieldKind::Bool,
            json!(door.hinge.squeaky),
        ),
    ];
    for (path, kind, default) in expected {
        let field = field_at(fields, path);
        assert_eq!(field.kind, kind, "kind of {path}");
        assert_eq!(field.default, default, "default of {path}");
    }
    assert_eq!(field_at(fields, "hinge").kind, PlaceableFieldKind::Group);
    let variants: Vec<String> = [
        TestDoorKind::Wooden,
        TestDoorKind::Iron,
        TestDoorKind::Glass,
    ]
    .iter()
    .map(|variant| format!("{variant:?}"))
    .collect();
    assert_eq!(field_at(fields, "kind").variants, variants);
}

/// Range, step, label and hidden attributes reach the field, and integer fields are bounded
/// by their type.
#[test]
fn attributes_and_integer_bounds_are_described() {
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_attributes");
    let list = classes_of(&app, directory.path());
    let fields = &class_of::<TestDoor>(&list).fields;
    let speed = field_at(fields, "speed");
    assert_eq!(
        (speed.minimum, speed.maximum, speed.step),
        (Some(0.0), Some(10.0), Some(0.5))
    );
    assert_eq!(field_at(fields, "key_name").label, "Key");
    assert_eq!(field_at(fields, "locked").label, "locked");
    assert!(field_at(fields, "secret").hidden);
    assert!(!field_at(fields, "speed").hidden);
    let uses = field_at(fields, "uses");
    assert_eq!(
        (uses.minimum, uses.maximum),
        (Some(0.0), Some(f64::from(u8::MAX)))
    );
}

/// Tuple struct fields are addressed by index with a leading dot.
#[test]
fn tuple_struct_fields_use_index_paths() {
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_tuple");
    let list = classes_of(&app, directory.path());
    let fields = &class_of::<TestWeight>(&list).fields;
    assert_eq!(fields.len(), 1);
    assert_eq!(fields[0].path, ".0");
    assert_eq!(fields[0].default, json!(TestWeight::default().0));
}

/// Handle fields of registered asset types are asset fields, and the asset type lists the
/// matching files under the asset root.
#[test]
fn asset_fields_name_their_type_and_list_matching_files() {
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_assets");
    let nested = directory.path().join("doors");
    std::fs::create_dir_all(&nested).expect("the doors directory");
    std::fs::write(nested.join("heavy.stats.ron"), "()").expect("a stats file");
    std::fs::write(nested.join("heavy.png"), "").expect("an unrelated file");
    let list = classes_of(&app, directory.path());
    let stats = field_at(&class_of::<TestDoor>(&list).fields, "stats");
    let asset_type_path = type_path_of::<TestDoorStats>();
    assert_eq!(stats.kind, PlaceableFieldKind::Asset);
    assert_eq!(stats.asset_type.as_deref(), Some(asset_type_path.as_str()));
    assert_eq!(stats.default, Value::Null);
    let asset_type = list
        .asset_types
        .iter()
        .find(|asset_type| asset_type.type_path == asset_type_path)
        .expect("the stats asset type is described");
    assert_eq!(asset_type.paths, vec!["doors/heavy.stats.ron".to_owned()]);
    let before = list.asset_generation;
    std::fs::write(nested.join("light.stats.ron"), "()").expect("a second stats file");
    assert_ne!(classes_of(&app, directory.path()).asset_generation, before);
}

/// The shared class list fixture, also parsed by the editor's tests, matches the wire types.
#[test]
fn class_list_fixture_parses() {
    let json = include_str!("../../../../../fixtures/placeable_classes_sample.json");
    let list: PlaceableClassList = serde_json::from_str(json).expect("the fixture parses");
    assert!(!list.classes.is_empty());
    let round_trip: PlaceableClassList =
        serde_json::from_value(serde_json::to_value(&list).expect("serializes")).expect("parses");
    assert_eq!(round_trip, list);
}
