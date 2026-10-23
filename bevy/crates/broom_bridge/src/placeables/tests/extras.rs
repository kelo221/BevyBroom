//! Components stored in glTF node extras are composed and inserted when a node spawns, with or
//! without the bridge.

use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use serde_json::json;

use super::*;
use crate::placeables::extras::components_from_extras;
use crate::placeables::{BroomGltfComponentsPlugin, BroomProperties, PropertyValue};
use crate::protocol::EXTRAS_COMPONENTS;

/// The type path of an unregistered component, as a level from another game would name it.
const UNKNOWN_TYPE_PATH: &str = "other_game::placeables::Lever";

/// A headless app with only the glTF components plugin and the test door, and a status when
/// `with_status` is set.
fn extras_app(with_status: bool) -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, BroomGltfComponentsPlugin))
        .register_placeable::<TestDoor>(PlaceableOptions::point());
    if with_status {
        app.insert_resource(BridgeStatus::new("test"));
    }
    app
}

/// Node extras holding `components` next to an unrelated key, as the editor writes them.
fn extras_with(components: serde_json::Value) -> GltfExtras {
    GltfExtras {
        value: json!({ "broom_id": "node-under-test", EXTRAS_COMPONENTS: components }).to_string(),
    }
}

/// Spawns a named node with `extras`, runs one frame and returns the node.
fn node_spawn(app: &mut App, extras: GltfExtras) -> Entity {
    let node = app
        .world_mut()
        .spawn((Name::new("Door Node"), Transform::default(), extras))
        .id();
    app.update();
    node
}

/// The extras parser returns the component map and ignores extras without one or with a
/// malformed one.
#[test]
fn extras_parse_only_well_formed_component_maps() {
    let speed = TestDoor::default().speed + 1.0;
    let door = type_path_of::<TestDoor>();
    let parsed =
        components_from_extras(&extras_with(json!({ door.clone(): { "speed": speed } })).value)
            .expect("the components parse");
    assert_eq!(parsed[&door]["speed"], json!(speed));
    assert!(components_from_extras(r#"{"broom_id":"a"}"#).is_none());
    assert!(components_from_extras(&extras_with(json!({ door: 3 })).value).is_none());
    assert!(components_from_extras(&extras_with(json!({ "": {} })).value).is_none());
    assert!(components_from_extras("not json").is_none());
}

/// A spawned node gets its components with the overrides applied and the defaults kept, in an
/// app without the bridge; the built-in properties component is available there too.
#[test]
fn spawned_nodes_receive_their_components_without_the_bridge() {
    let mut app = extras_app(false);
    let defaults = TestDoor::default();
    let key_name = format!("{}-copy", defaults.key_name);
    let node = node_spawn(
        &mut app,
        extras_with(json!({
            type_path_of::<TestDoor>(): { "key_name": key_name, "locked": !defaults.locked },
            type_path_of::<BroomProperties>(): { "values": { "team": "red", "lives": 3 } },
        })),
    );
    let door = app
        .world()
        .get::<TestDoor>(node)
        .expect("the door is inserted");
    assert_eq!(
        *door,
        TestDoor {
            key_name,
            locked: !defaults.locked,
            ..defaults
        }
    );
    let properties = app
        .world()
        .get::<BroomProperties>(node)
        .expect("properties");
    assert_eq!(properties.text("team"), Some("red"));
    assert_eq!(
        properties.values.get("lives"),
        Some(&PropertyValue::Number(3.0))
    );
}

/// An unknown class is reported with the node's name while the node's other components are
/// still inserted, and a node is handled once rather than every frame.
#[test]
fn unknown_classes_are_reported_and_the_rest_still_applies() {
    let mut app = extras_app(true);
    let node = node_spawn(
        &mut app,
        extras_with(json!({
            UNKNOWN_TYPE_PATH: { "pull": 1 },
            type_path_of::<TestDoor>(): {},
        })),
    );
    assert_eq!(
        app.world().get::<TestDoor>(node),
        Some(&TestDoor::default())
    );
    let errors = app.world().resource::<BridgeStatus>().errors.clone();
    assert_eq!(errors.len(), 1, "one error: {errors:?}");
    let message = &errors[0].message;
    assert!(message.contains("Door Node") && message.contains(UNKNOWN_TYPE_PATH));
    app.update();
    assert_eq!(app.world().resource::<BridgeStatus>().errors.len(), 1);
}

/// Nodes without component extras are left alone.
#[test]
fn nodes_without_component_extras_are_untouched() {
    let mut app = extras_app(true);
    let node = node_spawn(
        &mut app,
        GltfExtras {
            value: json!({ "broom_id": "plain" }).to_string(),
        },
    );
    assert!(app.world().get::<TestDoor>(node).is_none());
    assert!(app.world().resource::<BridgeStatus>().errors.is_empty());
}
