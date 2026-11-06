//! Collision flags of displacement surfaces are read from glTF node extras and kept on the node
//! as `BroomDisplacementSurface`, with or without the bridge.

use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use serde_json::json;

use super::*;
use crate::placeables::displacement::displacement_from_extras;
use crate::placeables::{
    BroomDisplacementSurface, BroomGltfComponentsPlugin, BroomGltfDisplacementPlugin,
};
use crate::protocol::{EXTRAS_DISPLACEMENT, EXTRAS_OBJECT_ID};

/// The shared sample of a displacement surface node's extras, as the editor's export writes them.
const DISPLACEMENT_EXTRAS_SAMPLE: &str =
    include_str!("../../../../../fixtures/displacement_extras_sample.json");

/// Node extras holding `flags` next to an editor id, as the editor writes them.
fn extras_with(flags: serde_json::Value) -> GltfExtras {
    GltfExtras {
        value: json!({ EXTRAS_OBJECT_ID: "surface-under-test", EXTRAS_DISPLACEMENT: flags })
            .to_string(),
    }
}

/// Spawns a node with `extras`, runs one frame and returns the node.
fn node_spawn(app: &mut App, extras: GltfExtras) -> Entity {
    let node = app
        .world_mut()
        .spawn((Name::new("Displacement Node"), Transform::default(), extras))
        .id();
    app.update();
    node
}

/// A headless app with only the displacement plugin.
fn displacement_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, BroomGltfDisplacementPlugin));
    app
}

/// The shared sample parses into the flags it names.
#[test]
fn sample_extras_parse_into_their_flags() {
    let sample: serde_json::Value =
        serde_json::from_str(DISPLACEMENT_EXTRAS_SAMPLE).expect("the sample parses");
    let flag = |name: &str| sample[EXTRAS_DISPLACEMENT][name].as_bool().expect("a flag");
    let parsed =
        displacement_from_extras(DISPLACEMENT_EXTRAS_SAMPLE).expect("the sample has flags");
    assert_eq!(
        parsed,
        BroomDisplacementSurface {
            no_physics_collision: flag("no_physics_collision"),
            no_hull_collision: flag("no_hull_collision"),
            no_ray_collision: flag("no_ray_collision"),
            seals: flag("seals"),
        }
    );
}

/// Every flag set parses, and missing flags read as off.
#[test]
fn extras_parse_all_and_partial_flags() {
    let all = json!({
        "no_physics_collision": true,
        "no_hull_collision": true,
        "no_ray_collision": true,
        "seals": true,
    });
    let parsed = displacement_from_extras(&extras_with(all).value).expect("all flags parse");
    assert!(
        parsed.no_physics_collision && parsed.no_hull_collision && parsed.no_ray_collision,
        "{parsed:?}"
    );
    assert!(parsed.seals);
    let partial = displacement_from_extras(&extras_with(json!({ "seals": true })).value);
    assert_eq!(
        partial,
        Some(BroomDisplacementSurface {
            seals: true,
            ..default()
        })
    );
}

/// Extras without flags or with malformed flags give no flags.
#[test]
fn malformed_extras_give_no_flags() {
    assert!(displacement_from_extras(r#"{"broom_id":"a"}"#).is_none());
    assert!(displacement_from_extras("not json").is_none());
    assert!(displacement_from_extras(&extras_with(json!(true)).value).is_none());
    assert!(
        displacement_from_extras(&extras_with(json!({ "no_ray_collision": "yes" })).value)
            .is_none()
    );
}

/// A spawned node gets its flags, a node without flags gets none, and the flags follow later
/// changes of the extras.
#[test]
fn spawned_nodes_receive_and_lose_their_flags() {
    let mut app = displacement_app();
    let node = node_spawn(&mut app, extras_with(json!({ "no_hull_collision": true })));
    let expected = BroomDisplacementSurface {
        no_hull_collision: true,
        ..default()
    };
    assert_eq!(
        app.world().get::<BroomDisplacementSurface>(node),
        Some(&expected)
    );
    let plain = node_spawn(
        &mut app,
        GltfExtras {
            value: json!({ EXTRAS_OBJECT_ID: "plain" }).to_string(),
        },
    );
    assert!(app.world().get::<BroomDisplacementSurface>(plain).is_none());
    app.world_mut().entity_mut(node).insert(GltfExtras {
        value: json!({ EXTRAS_OBJECT_ID: "surface-under-test" }).to_string(),
    });
    app.update();
    assert!(app.world().get::<BroomDisplacementSurface>(node).is_none());
}

/// The flags are reflected for the Bevy remote protocol, and both plugins that read glTF extras
/// bring the displacement plugin along once.
#[test]
fn the_component_is_registered_by_every_extras_plugin() {
    let mut both_extras_plugins = placeables_app();
    both_extras_plugins.add_plugins(BroomGltfComponentsPlugin);
    for mut app in [displacement_app(), both_extras_plugins] {
        assert!(app.is_plugin_added::<BroomGltfDisplacementPlugin>());
        let registry = app.world().resource::<AppTypeRegistry>().clone();
        assert!(
            registry
                .read()
                .get(std::any::TypeId::of::<BroomDisplacementSurface>())
                .is_some()
        );
        let node = node_spawn(&mut app, extras_with(json!({ "seals": true })));
        assert!(app.world().get::<BroomDisplacementSurface>(node).is_some());
    }
}
