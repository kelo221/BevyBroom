//! Class descriptions: every field with its kind, attributes and the component's own default.

use bevy::prelude::*;
use serde_json::{Value, json};

use super::*;
use crate::placeables::class_list;
use crate::placeables::{BroomProperties, PlaceableAssetTypes, PlaceableClasses};
use crate::protocol::{
    PlaceableClass, PlaceableClassList, PlaceableCollisionKind, PlaceableField, PlaceableFieldKind,
    PlaceableMarkerBox, PlaceablePlacement, PlaceableVariantLight, PlaceableVariantLightKind,
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
    assert_eq!(door.icon.as_deref(), Some("door-closed"));
    let weight = class_of::<TestWeight>(&list);
    assert_eq!(weight.placement, PlaceablePlacement::Any);
    assert_eq!(weight.icon, None);
    let properties = class_of::<BroomProperties>(&list);
    assert_eq!(
        field_at(&properties.fields, "values").kind,
        PlaceableFieldKind::PropertyMap
    );
    assert!(list.generation > 0);
}

/// The marker boxes a class is registered with reach the editor, the picked ones keyed by the
/// field value, and a class registered without them reports none.
#[test]
fn marker_boxes_are_described_with_their_options() {
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_marker_boxes");
    let list = classes_of(&app, directory.path());
    let door = class_of::<TestDoor>(&list);
    assert_eq!(
        door.marker_box,
        Some(PlaceableMarkerBox {
            size: [1.0, 2.0, 0.2],
            offset: [0.0, 1.0, 0.0],
            model: None
        })
    );
    assert_eq!(door.marker_box_field.as_deref(), Some("kind"));
    let iron = door
        .marker_boxes
        .get("Iron")
        .expect("the iron box is described");
    assert_eq!(iron.size, [3.0, 2.5, 0.4]);
    assert_eq!(iron.offset, [1.5, 1.25, 0.0]);
    assert_eq!(iron.model.as_deref(), Some("models/iron_door.glb"));
    assert!(
        !door.marker_boxes.contains_key("Glass"),
        "a model for a value without a box adds no box"
    );
    let weight = class_of::<TestWeight>(&list);
    assert_eq!(weight.marker_box, None);
    assert!(weight.marker_boxes.is_empty());
    let wire = serde_json::to_value(weight).expect("serializes");
    assert!(wire.get("marker_boxes").is_none());
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

/// Images are a built-in asset type under the type path the editor's light cookie picker asks
/// for, listing the image files and nothing else.
#[test]
fn images_are_a_built_in_asset_type() {
    assert_eq!(Image::type_path(), "bevy_image::image::Image");
    let app = placeables_app();
    let directory = TemporaryDirectory::new("placeable_images");
    let nested = directory.path().join("textures");
    std::fs::create_dir_all(&nested).expect("the textures directory");
    for name in ["gobo.png", "window.jpg", "notes.txt"] {
        std::fs::write(nested.join(name), "").expect("a texture file");
    }
    let list = classes_of(&app, directory.path());
    let images = list
        .asset_types
        .iter()
        .find(|asset_type| asset_type.type_path == Image::type_path())
        .expect("images are described");
    assert_eq!(
        images.paths,
        vec![
            "textures/gobo.png".to_owned(),
            "textures/window.jpg".to_owned()
        ]
    );
    assert!(!images.editable);
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

/// Enum fields may name and group their variants for the editor's Place browser; the shared
/// fixture's door kind does, and the names survive a round trip.
#[test]
fn class_list_fixture_reads_variant_details() {
    let json = include_str!("../../../../../fixtures/placeable_classes_sample.json");
    let list: PlaceableClassList = serde_json::from_str(json).expect("the fixture parses");
    let detailed = list
        .classes
        .iter()
        .flat_map(|class| class.fields.iter())
        .find(|field| !field.variant_details.is_empty())
        .expect("a field with variant details");
    let iron = detailed
        .variant_details
        .get("Iron")
        .expect("the Iron variant");
    assert_eq!(iron.label.as_deref(), Some("Iron door"));
    assert_eq!(iron.group.as_deref(), Some("Metal doors"));
    assert!(
        detailed
            .variant_details
            .keys()
            .all(|variant| detailed.variants.contains(variant))
    );
}

/// A variant may carry the light the editor adds to entities holding it; the shared fixture's
/// glass door carries a fogged tube, and the light survives a round trip.
#[test]
fn class_list_fixture_reads_variant_lights() {
    let json = include_str!("../../../../../fixtures/placeable_classes_sample.json");
    let list: PlaceableClassList = serde_json::from_str(json).expect("the fixture parses");
    let light = list
        .classes
        .iter()
        .flat_map(|class| class.fields.iter())
        .flat_map(|field| field.variant_details.values())
        .find_map(|detail| detail.light.clone())
        .expect("a variant with a light");
    assert_eq!(light.kind, PlaceableVariantLightKind::Tube);
    assert!(light.from.is_some() && light.to.is_some() && light.at.is_none());
    assert_eq!(light.effect.as_deref(), Some("fluorescent_starter"));
    let fog = light.fog.expect("the tube has fog");
    assert!(fog.below_floor_m >= 0.0);
    let round_trip: PlaceableVariantLight =
        serde_json::from_value(serde_json::to_value(&light).expect("serializes")).expect("parses");
    assert_eq!(round_trip, light);
}

/// A class may name the editor icon of its markers; the shared fixture's door does, and the
/// name survives a round trip while classes without one serialize without the key.
#[test]
fn class_list_fixture_reads_icon() {
    let json = include_str!("../../../../../fixtures/placeable_classes_sample.json");
    let list: PlaceableClassList = serde_json::from_str(json).expect("the fixture parses");
    let with_icon = list
        .classes
        .iter()
        .find(|class| class.icon.is_some())
        .expect("a class with an icon");
    assert_eq!(with_icon.icon.as_deref(), Some("door-closed"));
    let without_icon = list
        .classes
        .iter()
        .find(|class| class.icon.is_none())
        .expect("a class without an icon");
    let serialized = serde_json::to_value(without_icon).expect("serializes");
    assert!(serialized.get("icon").is_none());
}

/// A brush entity class that marks an area, such as a finish zone.
#[derive(Component, Reflect, Default)]
#[reflect(Component, Default)]
struct TestZone {
    lap: u32,
}

/// A class registered with a collision kind reports it to the editor as snake case, and a
/// class registered without one leaves the key out.
#[test]
fn collision_kind_is_described_with_its_options() {
    let mut app = placeables_app();
    app.register_placeable::<TestZone>(
        PlaceableOptions::any().collision(PlaceableCollisionKind::Volume),
    );
    let directory = TemporaryDirectory::new("placeable_collision");
    let list = classes_of(&app, directory.path());
    let zone = class_of::<TestZone>(&list);
    assert_eq!(zone.collision, Some(PlaceableCollisionKind::Volume));
    let zone_json = serde_json::to_value(zone).expect("serializes");
    assert_eq!(zone_json["collision"], json!("volume"));
    let properties = serde_json::to_value(class_of::<BroomProperties>(&list)).expect("serializes");
    assert!(properties.get("collision").is_none());
    let _ = TestZone::default().lap;
}
