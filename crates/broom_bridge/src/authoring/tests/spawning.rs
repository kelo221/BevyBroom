//! Lights follow the applied snapshot: spawned where the hierarchy puts them, updated in place,
//! and despawned when deleted, disabled or hidden.

use bevy::prelude::*;
use dynlight::light::LightType;

use super::*;
use crate::protocol::AuthoredLightType;
use crate::test_support::{next_revision, object_mut};

/// The sample's point light and spot light are both spawned once, as the DynLight light types
/// they were authored as, at the world transforms composed from their parent groups.
#[test]
fn spawns_point_and_spot_lights_at_world_transforms() {
    let (mut app, state) = app_with_sample();
    assert_lights_match(&mut app, &state);
    let lights = spawned_lights(&mut app);
    let authored_types: Vec<AuthoredLightType> = lights
        .keys()
        .filter_map(|id| state.object(id)?.light.as_ref())
        .map(|light| light.light_type)
        .collect();
    assert!(authored_types.contains(&AuthoredLightType::Point));
    assert!(authored_types.contains(&AuthoredLightType::Spot));
    let spawned_types: Vec<LightType> = lights
        .values()
        .map(|light| light.light.light_type)
        .collect();
    assert!(spawned_types.contains(&LightType::Point));
    assert!(spawned_types.contains(&LightType::Spot));
    let (child, parent) = child_light_and_parent(&state);
    let parent_local = local_transform(state.object(&parent).expect("parent"));
    assert_ne!(
        parent_local,
        Transform::IDENTITY,
        "the parent must move its child"
    );
    let child_local = local_transform(state.object(&child).expect("child"));
    assert!(
        !lights[&child]
            .transform
            .translation
            .abs_diff_eq(child_local.translation, TOLERANCE),
        "the child light is placed in world space, not at its local translation"
    );
}

/// Moving a parent group moves its child light by the same offset, on the same entity.
#[test]
fn moving_a_parent_group_moves_its_child_light() {
    let (mut app, state) = app_with_sample();
    let (child, parent) = child_light_and_parent(&state);
    let before = spawned_lights(&mut app)[&child].clone();
    let offset = Vec3::new(3.0, -1.5, 4.25);
    let mut moved = next_revision(&state);
    let group = object_mut(&mut moved, &parent);
    group.translation = (Vec3::from_array(group.translation) + offset).to_array();
    assert_eq!(
        state_send(&mut app, moved.clone()),
        Ok(RevisionVerdict::Newer)
    );
    let after = spawned_lights(&mut app)[&child].clone();
    assert_eq!(after.entity, before.entity);
    assert!(
        (after.transform.translation - before.transform.translation).abs_diff_eq(offset, TOLERANCE)
    );
    assert_lights_match(&mut app, &moved);
}

/// Editing a light's settings and position updates the existing entity instead of respawning it.
#[test]
fn editing_a_light_updates_the_same_entity() {
    let (mut app, state) = app_with_sample();
    let id = first_light_id(&state);
    let entities_before = light_entities(&mut app);
    let mut edited = next_revision(&state);
    let object = object_mut(&mut edited, &id);
    object.translation[1] += 2.0;
    let light = object.light.as_mut().expect("light settings");
    light.color = [0.2, 0.4, 0.9];
    light.intensity *= 2.0;
    light.radius += 1.5;
    state_send(&mut app, edited.clone()).expect("the edit is valid");
    assert_eq!(light_entities(&mut app), entities_before);
    assert_lights_match(&mut app, &edited);
    let spawned = spawned_lights(&mut app);
    assert_ne!(
        spawned[&id].light,
        expected_dynamic_light(&state, &id),
        "the edit reached the component"
    );
}

/// Deleting a light from the snapshot despawns its entity and leaves the other lights alone.
#[test]
fn deleting_a_light_despawns_it() {
    let (mut app, state) = app_with_sample();
    let id = first_light_id(&state);
    let entities_before = light_entities(&mut app);
    let mut deleted = next_revision(&state);
    deleted.objects.retain(|object| object.id != id);
    state_send(&mut app, deleted.clone()).expect("the deletion is valid");
    assert_lights_match(&mut app, &deleted);
    let entities_after = light_entities(&mut app);
    assert!(!entities_after.contains_key(&id));
    assert!(app.world().get_entity(entities_before[&id]).is_err());
    for (other, entity) in &entities_after {
        assert_eq!(Some(entity), entities_before.get(other));
    }
}

/// Disabling a light despawns its entity; enabling it again spawns it back.
#[test]
fn disabling_a_light_despawns_it() {
    let (mut app, state) = app_with_sample();
    let id = first_light_id(&state);
    let entity_before = light_entities(&mut app)[&id];
    let mut disabled = next_revision(&state);
    let light = object_mut(&mut disabled, &id)
        .light
        .as_mut()
        .expect("light");
    light.enabled = false;
    state_send(&mut app, disabled.clone()).expect("disabling is valid");
    assert!(!light_entities(&mut app).contains_key(&id));
    assert!(app.world().get_entity(entity_before).is_err());
    assert_lights_match(&mut app, &disabled);
    let enabled = AuthoredState {
        objects: state.objects.clone(),
        ..next_revision(&disabled)
    };
    state_send(&mut app, enabled.clone()).expect("enabling is valid");
    assert_lights_match(&mut app, &enabled);
}

/// Hiding a light's parent group despawns the light; showing the group spawns it back.
#[test]
fn hiding_a_parent_group_despawns_its_child_light() {
    let (mut app, state) = app_with_sample();
    let (child, parent) = child_light_and_parent(&state);
    let mut hidden = next_revision(&state);
    object_mut(&mut hidden, &parent).visible = false;
    state_send(&mut app, hidden.clone()).expect("hiding is valid");
    assert!(!light_entities(&mut app).contains_key(&child));
    assert_lights_match(&mut app, &hidden);
    let mut shown = next_revision(&hidden);
    object_mut(&mut shown, &parent).visible = true;
    state_send(&mut app, shown.clone()).expect("showing is valid");
    assert!(light_entities(&mut app).contains_key(&child));
    assert_lights_match(&mut app, &shown);
}
