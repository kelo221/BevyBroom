//! The parameters of a procedural object reach the game as `BroomProceduralProp`, read from the
//! node extras the editor's export writes, with or without the bridge.

use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use serde::Deserialize;

use crate::placeables::{BroomGltfComponentsPlugin, BroomProceduralProp, PlaceableClasses};
use crate::protocol::EXTRAS_COMPONENTS;

/// The shared sample of a procedural box node's extras, as the editor's export writes them.
const PROCEDURAL_PROP_SAMPLE: &str =
    include_str!("../../../../../fixtures/procedural_prop_sample.json");

/// The box parameters a game reads from the sample.
#[derive(Deserialize, Debug, PartialEq)]
struct BoxParameters {
    corner_a: [f32; 3],
    corner_b: [f32; 3],
}

/// The values the editor derived for the box.
#[derive(Deserialize, Debug, PartialEq)]
struct BoxDerived {
    size: [f32; 3],
}

/// The component fields the sample names, read straight from its JSON.
fn sample_fields() -> serde_json::Value {
    let sample: serde_json::Value =
        serde_json::from_str(PROCEDURAL_PROP_SAMPLE).expect("the sample parses");
    sample[EXTRAS_COMPONENTS][BroomProceduralProp::type_path()].clone()
}

/// Spawns a node carrying the sample extras in an app with only the glTF components plugin,
/// runs one frame and returns the app and the node.
fn sample_node_spawn() -> (App, Entity) {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, BroomGltfComponentsPlugin));
    let extras = GltfExtras {
        value: PROCEDURAL_PROP_SAMPLE.to_owned(),
    };
    let node = app
        .world_mut()
        .spawn((Name::new("Procedural Box"), Transform::default(), extras))
        .id();
    app.update();
    (app, node)
}

/// The built-in component is a placeable class in every placeable app.
#[test]
fn procedural_prop_is_a_builtin_placeable() {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, BroomGltfComponentsPlugin));
    assert!(
        app.world()
            .resource::<PlaceableClasses>()
            .contains(BroomProceduralProp::type_path())
    );
}

/// A spawned node gets the component with every field of the sample.
#[test]
fn sample_node_receives_the_procedural_prop() {
    let (app, node) = sample_node_spawn();
    let fields = sample_fields();
    let prop = app
        .world()
        .get::<BroomProceduralProp>(node)
        .expect("the procedural prop is inserted");
    assert_eq!(prop.generator, fields["generator"].as_str().expect("text"));
    assert_eq!(
        u64::from(prop.version),
        fields["version"].as_u64().expect("a version")
    );
    assert_eq!(
        prop.parameters,
        fields["parameters"].as_str().expect("text")
    );
    assert_eq!(prop.derived, fields["derived"].as_str().expect("text"));
}

/// Game code reads the parameters, the derived values and single points into its own types.
#[test]
fn procedural_prop_reads_into_game_types() {
    let (app, node) = sample_node_spawn();
    let fields = sample_fields();
    let prop = app
        .world()
        .get::<BroomProceduralProp>(node)
        .expect("the procedural prop is inserted");
    let expected: BoxParameters =
        serde_json::from_str(fields["parameters"].as_str().expect("text")).expect("parameters");
    let derived: BoxDerived =
        serde_json::from_str(fields["derived"].as_str().expect("text")).expect("derived");
    assert_eq!(prop.parameters_as::<BoxParameters>(), Some(expected));
    assert_eq!(prop.derived_as::<BoxDerived>(), Some(derived));
    let corner = prop.parameter_point("corner_b").expect("a point");
    let expected_corner = prop
        .parameters_as::<BoxParameters>()
        .expect("parameters")
        .corner_b;
    assert_eq!(corner, Vec3::from_array(expected_corner));
    assert_eq!(prop.parameter_point("missing"), None);
    assert_eq!(prop.parameters_as::<BoxDerived>(), None);
}
