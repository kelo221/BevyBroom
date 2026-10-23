//! Placed components follow the applied snapshot on game entities and on exported nodes.

use std::collections::BTreeMap;

use bevy::prelude::*;
use serde_json::{Value, json};

use super::*;
use crate::authoring::AuthoredNode;
use crate::placeables::{AuthoredGameEntity, BroomProperties, PlacedComponents};
use crate::protocol::{AuthoredComponents, AuthoredObjectKind, AuthoredState};
use crate::test_support::{next_revision, object_mut, sample_state, state_send};

/// The id of the first object of `kind` in `state`.
fn first_id_of_kind(state: &AuthoredState, kind: AuthoredObjectKind) -> String {
    state
        .objects
        .iter()
        .find(|object| object.kind == kind)
        .map(|object| object.id.clone())
        .unwrap_or_else(|| panic!("the sample has a {kind:?}"))
}

/// One component's overrides.
fn component(type_path: String, fields: &[(&str, Value)]) -> AuthoredComponents {
    let fields: BTreeMap<String, Value> = fields
        .iter()
        .map(|(path, value)| ((*path).to_owned(), value.clone()))
        .collect();
    BTreeMap::from([(type_path, fields)])
}

/// The entity of the game entity with `id`.
fn game_entity(app: &mut App, id: &str) -> Option<Entity> {
    let mut query = app.world_mut().query::<(Entity, &AuthoredGameEntity)>();
    query
        .iter(app.world())
        .find(|(_, owner)| owner.id == id)
        .map(|(entity, _)| entity)
}

/// The component `T` on `entity`, cloned.
fn component_on<T: Component + Clone>(app: &App, entity: Entity) -> Option<T> {
    app.world().get::<T>(entity).cloned()
}

/// How many errors the status holds.
fn error_count(app: &App) -> usize {
    app.world().resource::<BridgeStatus>().errors.len()
}

/// The sample state with `components` on its game entity, and that entity's id.
fn sample_with_point_components(components: AuthoredComponents) -> (AuthoredState, String) {
    let mut state = sample_state();
    let id = first_id_of_kind(&state, AuthoredObjectKind::GameEntity);
    object_mut(&mut state, &id).components = components;
    (state, id)
}

/// A game entity is spawned with its components: the overridden fields set, the others at
/// their default.
#[test]
fn game_entities_spawn_with_composed_components() {
    let mut app = placeables_app();
    let speed = TestDoor::default().speed + 3.0;
    let (state, id) = sample_with_point_components(component(
        type_path_of::<TestDoor>(),
        &[("speed", json!(speed))],
    ));
    state_send(&mut app, state.clone()).expect("the state is valid");
    let entity = game_entity(&mut app, &id).expect("the game entity is spawned");
    let door = component_on::<TestDoor>(&app, entity).expect("the door is placed");
    assert_eq!(
        door,
        TestDoor {
            speed,
            ..TestDoor::default()
        }
    );
    let placed = component_on::<PlacedComponents>(&app, entity).expect("bookkeeping");
    assert!(placed.contains(&type_path_of::<TestDoor>()));
    assert_eq!(error_count(&app), 0);
}

/// Changing an override updates the component, and dropping the component removes it.
#[test]
fn components_update_and_are_removed() {
    let mut app = placeables_app();
    let door_path = type_path_of::<TestDoor>();
    let (state, id) =
        sample_with_point_components(component(door_path.clone(), &[("uses", json!(1))]));
    state_send(&mut app, state.clone()).expect("valid");
    let entity = game_entity(&mut app, &id).expect("spawned");
    let mut changed = next_revision(&state);
    object_mut(&mut changed, &id).components = component(door_path.clone(), &[("uses", json!(9))]);
    state_send(&mut app, changed.clone()).expect("valid");
    assert_eq!(
        game_entity(&mut app, &id),
        Some(entity),
        "the entity is kept"
    );
    assert_eq!(
        component_on::<TestDoor>(&app, entity).expect("placed").uses,
        9
    );
    let mut removed = next_revision(&changed);
    object_mut(&mut removed, &id).components = AuthoredComponents::new();
    state_send(&mut app, removed).expect("valid");
    assert!(component_on::<TestDoor>(&app, entity).is_none());
    assert!(
        !component_on::<PlacedComponents>(&app, entity)
            .expect("bookkeeping")
            .contains(&door_path)
    );
}

/// A class the game does not have is reported once and does not stop the object's other
/// components.
#[test]
fn unknown_classes_are_reported_and_others_still_apply() {
    let mut app = placeables_app();
    let mut components = component(type_path_of::<TestWeight>(), &[(".0", json!(4.0))]);
    components.insert("game::Missing".into(), BTreeMap::new());
    let (state, id) = sample_with_point_components(components);
    state_send(&mut app, state.clone()).expect("valid");
    let entity = game_entity(&mut app, &id).expect("spawned");
    assert_eq!(
        component_on::<TestWeight>(&app, entity),
        Some(TestWeight(4.0))
    );
    let errors = &app.world().resource::<BridgeStatus>().errors;
    assert_eq!(errors.len(), 1);
    assert!(errors[0].message.contains("game::Missing"));
    state_send(&mut app, next_revision(&state)).expect("valid");
    assert_eq!(
        error_count(&app),
        1,
        "an unchanged failure is not reported again"
    );
}

/// Components on an exported node are placed when the node appears, as after a geometry swap.
#[test]
fn nodes_that_appear_later_get_their_components() {
    let mut app = placeables_app();
    let state = sample_state();
    let (node_id, expected) = state
        .objects
        .iter()
        .filter(|object| object.kind != AuthoredObjectKind::GameEntity)
        .find_map(|object| {
            let fields = object.components.get(&type_path_of::<BroomProperties>())?;
            Some((object.id.clone(), fields.get("values")?.clone()))
        })
        .expect("the sample puts properties on a node");
    state_send(&mut app, state).expect("valid");
    let first = app.world_mut().spawn(AuthoredNode(node_id.clone())).id();
    app.update();
    let properties = component_on::<BroomProperties>(&app, first).expect("placed on the node");
    assert_eq!(
        properties.values.len(),
        expected.as_object().map_or(0, |values| values.len())
    );
    app.world_mut().despawn(first);
    let swapped = app.world_mut().spawn(AuthoredNode(node_id)).id();
    app.update();
    assert_eq!(
        component_on::<BroomProperties>(&app, swapped),
        Some(properties)
    );
}

/// Switching documents despawns the old document's game entities and spawns the new ones with
/// their components.
#[test]
fn document_switches_replace_game_entities() {
    let mut app = placeables_app();
    let (state, id) = sample_with_point_components(component(
        type_path_of::<TestWeight>(),
        &[(".0", json!(2.0))],
    ));
    state_send(&mut app, state.clone()).expect("valid");
    let old = game_entity(&mut app, &id).expect("spawned");
    let other = AuthoredState {
        document_id: format!("{}-other", state.document_id),
        session_id: format!("{}-other", state.session_id),
        ..state
    };
    state_send(&mut app, other.clone()).expect("valid");
    let new = game_entity(&mut app, &id).expect("respawned");
    assert_ne!(new, old);
    assert!(app.world().get_entity(old).is_err());
    let owner = component_on::<AuthoredGameEntity>(&app, new).expect("owner");
    assert_eq!(owner.document_id, other.document_id);
    assert_eq!(component_on::<TestWeight>(&app, new), Some(TestWeight(2.0)));
}

/// Hidden game entities are despawned like hidden lights, and the status counts classes and
/// placed components.
#[test]
fn hidden_points_despawn_and_the_status_counts() {
    let mut app = placeables_app();
    let (state, id) = sample_with_point_components(component(type_path_of::<TestDoor>(), &[]));
    state_send(&mut app, state.clone()).expect("valid");
    let status = app.world().resource::<BridgeStatus>();
    let classes = app
        .world()
        .resource::<crate::placeables::PlaceableClasses>()
        .len();
    assert_eq!(status.placeable_class_count, classes);
    let placed_objects = state
        .objects
        .iter()
        .filter(|object| !object.components.is_empty());
    let expected_on_points: usize = placed_objects
        .filter(|object| object.kind == AuthoredObjectKind::GameEntity)
        .map(|object| object.components.len())
        .sum();
    assert_eq!(status.placed_component_count, expected_on_points);
    let mut hidden = next_revision(&state);
    object_mut(&mut hidden, &id).visible = false;
    state_send(&mut app, hidden).expect("valid");
    assert!(game_entity(&mut app, &id).is_none());
}
