//! ECS tests of the authoring slice: authored lights, rooms and portals spawned, updated and
//! despawned in a headless app as snapshots arrive.

mod cells;
mod revisions;
mod spawning;

use std::collections::HashMap;

use bevy::prelude::*;
use dynlight::light::DynamicLight;

use super::AuthoredLightEntity;
use crate::protocol::{AuthoredObjectKind, AuthoredState, RevisionVerdict, local_transform};
use crate::test_support::{authoring_app, sample_state, state_send};

/// How close two transforms' parts must be to count as equal.
const TOLERANCE: f32 = 1e-5;

/// One spawned authored light as the tests see it.
#[derive(Clone, Debug)]
struct SpawnedLight {
    entity: Entity,
    document_id: String,
    light: DynamicLight,
    transform: Transform,
}

/// Every authored light entity in `app` by id. Fails the test when an id is spawned twice.
fn spawned_lights(app: &mut App) -> HashMap<String, SpawnedLight> {
    let mut query = app
        .world_mut()
        .query::<(Entity, &AuthoredLightEntity, &DynamicLight, &Transform)>();
    let mut lights = HashMap::new();
    for (entity, owner, light, transform) in query.iter(app.world()) {
        let spawned = SpawnedLight {
            entity,
            document_id: owner.document_id.clone(),
            light: light.clone(),
            transform: *transform,
        };
        let previous = lights.insert(owner.id.clone(), spawned);
        assert!(previous.is_none(), "light {} is spawned twice", owner.id);
    }
    lights
}

/// The entity of every spawned authored light, by id.
fn light_entities(app: &mut App) -> HashMap<String, Entity> {
    spawned_lights(app)
        .into_iter()
        .map(|(id, spawned)| (id, spawned.entity))
        .collect()
}

/// The ids of the light objects in `state` that should be spawned: enabled and with every
/// object up their parent chain visible.
fn expected_light_ids(state: &AuthoredState) -> Vec<String> {
    let mut ids: Vec<String> = state
        .objects
        .iter()
        .filter(|object| object.kind == AuthoredObjectKind::Light)
        .filter(|object| object.light.as_ref().is_some_and(|light| light.enabled))
        .filter(|object| ancestry_visible(state, &object.id))
        .map(|object| object.id.clone())
        .collect();
    ids.sort();
    ids
}

/// Whether `id` and all of its parents in `state` are visible, walking parent ids directly.
fn ancestry_visible(state: &AuthoredState, id: &str) -> bool {
    let mut current = state.object(id);
    while let Some(object) = current {
        if !object.visible {
            return false;
        }
        current = object
            .parent_id
            .as_deref()
            .and_then(|parent| state.object(parent));
    }
    true
}

/// The world transform of `id` with its scale: each parent's local transform applied over the
/// child's, walking parent ids directly.
fn expected_scaled_world_transform(state: &AuthoredState, id: &str) -> Transform {
    let object = state.object(id).expect("the object exists");
    let mut world = local_transform(object);
    let mut parent_id = object.parent_id.clone();
    while let Some(parent) = parent_id.as_deref().and_then(|parent| state.object(parent)) {
        world = local_transform(parent).mul_transform(world);
        parent_id = parent.parent_id.clone();
    }
    world
}

/// The world transform light `id` should have, with the scale dropped as lights carry none.
fn expected_world_transform(state: &AuthoredState, id: &str) -> Transform {
    Transform {
        scale: Vec3::ONE,
        ..expected_scaled_world_transform(state, id)
    }
}

/// The DynLight component `state` asks for on light `id`.
fn expected_dynamic_light(state: &AuthoredState, id: &str) -> DynamicLight {
    state
        .object(id)
        .and_then(|object| object.light.as_ref())
        .expect("the object is a light")
        .to_dynamic_light()
}

/// Asserts that `actual` and `expected` place and orient a light the same way.
fn assert_transform_close(actual: &Transform, expected: &Transform) {
    assert!(
        actual
            .translation
            .abs_diff_eq(expected.translation, TOLERANCE),
        "translation {} != {}",
        actual.translation,
        expected.translation
    );
    assert!(
        actual.rotation.abs_diff_eq(expected.rotation, TOLERANCE)
            || actual.rotation.abs_diff_eq(-expected.rotation, TOLERANCE),
        "rotation {} != {}",
        actual.rotation,
        expected.rotation
    );
    assert!(actual.scale.abs_diff_eq(expected.scale, TOLERANCE));
}

/// Asserts that the app's lights are exactly the ones `state` asks for, with its settings and
/// world transforms, all owned by its document.
fn assert_lights_match(app: &mut App, state: &AuthoredState) {
    let lights = spawned_lights(app);
    let mut spawned_ids: Vec<String> = lights.keys().cloned().collect();
    spawned_ids.sort();
    assert_eq!(spawned_ids, expected_light_ids(state));
    for (id, spawned) in &lights {
        assert_eq!(spawned.document_id, state.document_id);
        assert_eq!(spawned.light, expected_dynamic_light(state, id));
        assert_transform_close(&spawned.transform, &expected_world_transform(state, id));
    }
}

/// The id of a light in `state` that has a parent, and that parent's id.
fn child_light_and_parent(state: &AuthoredState) -> (String, String) {
    state
        .objects
        .iter()
        .filter(|object| object.kind == AuthoredObjectKind::Light)
        .find_map(|object| Some((object.id.clone(), object.parent_id.clone()?)))
        .expect("the sample has a light inside a group")
}

/// The id of the first light object in `state`.
fn first_light_id(state: &AuthoredState) -> String {
    state
        .objects
        .iter()
        .find(|object| object.kind == AuthoredObjectKind::Light)
        .map(|object| object.id.clone())
        .expect("the sample has a light")
}

/// A headless app that has applied the sample snapshot, and that snapshot.
fn app_with_sample() -> (App, AuthoredState) {
    let mut app = authoring_app();
    let state = sample_state();
    assert_eq!(
        state_send(&mut app, state.clone()),
        Ok(RevisionVerdict::NewSession)
    );
    (app, state)
}
