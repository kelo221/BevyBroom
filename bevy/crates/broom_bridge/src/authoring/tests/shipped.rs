//! Light nodes of shipped levels get the complete settings the editor exported, and are switched
//! off while the shown document has their editor id, so a level loaded both from its exported
//! GLB and from the editor or a manifest lights each light once.

use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use dynlight::effects::LightEffect;
use dynlight::fog::VolumetricLight;
use dynlight::light::DynamicLight;

use super::*;
use crate::authoring::shipped_lights::shipped_light_from_extras;
use crate::authoring::{ShippedLight, ShippedLightReplaced};
use crate::protocol::{AuthoredLight, AuthoredShadowMode, EXTRAS_LIGHT, EXTRAS_LIGHT_OF};
use crate::status::BridgeStatus;
use crate::test_support::next_revision;

/// The shared sample of a light node's extras, as the editor's export writes them.
const LIGHT_EXTRAS_SAMPLE: &str = include_str!("../../../../../fixtures/light_extras_sample.json");

/// The editor id and settings of the shared sample.
fn sample_shipped_light() -> (String, AuthoredLight) {
    shipped_light_from_extras(LIGHT_EXTRAS_SAMPLE)
        .expect("the sample has light extras")
        .expect("the sample light is valid")
}

/// The sample extras with the editor id replaced by `id`.
fn extras_for_id(id: &str) -> GltfExtras {
    let mut value: serde_json::Value =
        serde_json::from_str(LIGHT_EXTRAS_SAMPLE).expect("the sample parses");
    value[EXTRAS_LIGHT_OF] = serde_json::Value::String(id.to_owned());
    GltfExtras {
        value: value.to_string(),
    }
}

/// An authoring app that records errors in a status.
fn app_with_status() -> App {
    let mut app = authoring_app();
    app.insert_resource(BridgeStatus::new("test"));
    app
}

/// Spawns a light node the way DynLight's import leaves it (a default light) with `extras`,
/// runs one frame and returns the node.
fn shipped_node_spawn(app: &mut App, extras: GltfExtras) -> Entity {
    let node = app
        .world_mut()
        .spawn((Transform::default(), DynamicLight::default(), extras))
        .id();
    app.update();
    node
}

/// The id of a light object in `state` that no other object has as its parent.
fn childless_light_id(state: &AuthoredState) -> String {
    state
        .objects
        .iter()
        .filter(|object| object.kind == AuthoredObjectKind::Light)
        .find(|object| {
            let id = Some(object.id.as_str());
            state
                .objects
                .iter()
                .all(|other| other.parent_id.as_deref() != id)
        })
        .map(|object| object.id.clone())
        .expect("the sample has a light without children")
}

/// How many entities in `app` shine a DynLight light for editor id `id`.
fn shining_lights_for(app: &mut App, id: &str) -> usize {
    let authored = spawned_lights(app).contains_key(id);
    let mut query = app
        .world_mut()
        .query_filtered::<&ShippedLight, With<DynamicLight>>();
    let shipped = query
        .iter(app.world())
        .filter(|light| light.0 == id)
        .count();
    shipped + usize::from(authored)
}

/// The shared sample carries settings DynLight's own extras cannot: its shadow mode.
#[test]
fn sample_extras_carry_the_complete_light() {
    let (id, light) = sample_shipped_light();
    assert!(!id.is_empty());
    assert_eq!(light.shadows, AuthoredShadowMode::Realtime);
    assert!(light.effect.is_some() && light.fog.is_some());
}

/// A shipped light node gets the complete light and the companions it was exported with.
#[test]
fn shipped_light_gets_its_complete_settings() {
    let mut app = app_with_status();
    let (id, light) = sample_shipped_light();
    let node = shipped_node_spawn(&mut app, extras_for_id(&id));
    let node = app.world().entity(node);
    assert_eq!(node.get::<DynamicLight>(), Some(&light.to_dynamic_light()));
    assert_eq!(node.get::<ShippedLight>(), Some(&ShippedLight(id)));
    let effect = light.effect.as_ref().map(|effect| effect.to_dynlight());
    assert_eq!(node.get::<LightEffect>(), effect.as_ref());
    let fog = light.fog.as_ref().map(|fog| fog.to_dynlight());
    assert_eq!(node.get::<VolumetricLight>(), fog.as_ref());
}

/// Malformed settings are reported and the node keeps what DynLight imported.
#[test]
fn malformed_shipped_light_is_reported_and_left_alone() {
    let mut app = app_with_status();
    let extras = GltfExtras {
        value: serde_json::json!({ EXTRAS_LIGHT_OF: "broken", EXTRAS_LIGHT: { "radius": "far" } })
            .to_string(),
    };
    let node = shipped_node_spawn(&mut app, extras);
    let node = app.world().entity(node);
    assert_eq!(node.get::<DynamicLight>(), Some(&DynamicLight::default()));
    assert!(node.get::<ShippedLight>().is_none());
    assert_eq!(app.world().resource::<BridgeStatus>().errors.len(), 1);
}

/// A shipped light already in the world goes dark when the shown document has its id, so only
/// the bridge's light shines, and comes back when the document no longer has the id.
#[test]
fn shipped_light_yields_to_the_shown_document_and_returns() {
    let mut app = app_with_status();
    let state = sample_state();
    let id = childless_light_id(&state);
    let node = shipped_node_spawn(&mut app, extras_for_id(&id));
    assert_eq!(shining_lights_for(&mut app, &id), 1);
    state_send(&mut app, state.clone()).expect("the sample is valid");
    app.update();
    assert_eq!(shining_lights_for(&mut app, &id), 1);
    assert!(spawned_lights(&mut app).contains_key(&id));
    assert!(app.world().entity(node).contains::<ShippedLightReplaced>());
    let mut without_light = next_revision(&state);
    without_light.objects.retain(|object| object.id != id);
    state_send(&mut app, without_light).expect("the edited sample is valid");
    app.update();
    assert_eq!(shining_lights_for(&mut app, &id), 1);
    assert!(!app.world().entity(node).contains::<ShippedLightReplaced>());
    assert!(app.world().entity(node).contains::<DynamicLight>());
}

/// A shipped light that spawns while the shown document already has its id stays dark.
#[test]
fn shipped_light_spawning_after_the_document_stays_dark() {
    let mut app = app_with_status();
    let state = sample_state();
    let id = childless_light_id(&state);
    state_send(&mut app, state).expect("the sample is valid");
    let node = shipped_node_spawn(&mut app, extras_for_id(&id));
    assert_eq!(shining_lights_for(&mut app, &id), 1);
    assert!(app.world().entity(node).contains::<ShippedLightReplaced>());
}

/// Shipped lights of other objects keep shining next to the shown document.
#[test]
fn shipped_light_of_another_object_keeps_shining() {
    let mut app = app_with_status();
    state_send(&mut app, sample_state()).expect("the sample is valid");
    let node = shipped_node_spawn(&mut app, extras_for_id("not-in-the-document"));
    app.update();
    assert!(app.world().entity(node).contains::<DynamicLight>());
    assert!(!app.world().entity(node).contains::<ShippedLightReplaced>());
}
