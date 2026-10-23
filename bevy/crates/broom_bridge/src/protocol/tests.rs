use bevy::prelude::*;

use super::*;
use crate::test_support::{object_mut, sample_state};

/// A one-object snapshot of a light with `light`.
fn state_with_light(light: AuthoredLight) -> AuthoredState {
    AuthoredState {
        protocol: PROTOCOL_VERSION,
        document_id: "document".into(),
        session_id: "session".into(),
        objects: vec![AuthoredObject {
            id: "light".into(),
            kind: AuthoredObjectKind::Light,
            light: Some(light),
            ..default()
        }],
        ..default()
    }
}

#[test]
fn sample_state_is_valid_and_round_trips() {
    let state = sample_state();
    assert_eq!(state.validate(), Ok(()));
    let json = serde_json::to_string(&state).expect("serializes");
    let again: AuthoredState = serde_json::from_str(&json).expect("parses again");
    assert_eq!(again, state);
}

#[test]
fn rejects_duplicate_ids_wrong_protocol_and_lights_without_settings() {
    let mut state = sample_state();
    state.protocol = PROTOCOL_VERSION + 1;
    assert!(matches!(
        state.validate(),
        Err(StateRejection::WrongProtocol(_))
    ));

    let mut state = sample_state();
    let copy = state.objects[0].clone();
    state.objects.push(copy);
    assert!(matches!(
        state.validate(),
        Err(StateRejection::DuplicateObjectId(_))
    ));

    let mut state = sample_state();
    let light = state
        .objects
        .iter_mut()
        .find(|object| object.kind == AuthoredObjectKind::Light)
        .expect("the sample has a light");
    light.light = None;
    assert!(matches!(
        state.validate(),
        Err(StateRejection::LightWithoutSettings(_))
    ));
}

#[test]
fn rejects_non_finite_transforms() {
    let mut state = sample_state();
    state.objects[0].translation[1] = f32::NAN;
    assert!(matches!(
        state.validate(),
        Err(StateRejection::NonFiniteTransform(_))
    ));
}

#[test]
fn spot_cones_must_be_ordered_and_open() {
    let spot = |inner, outer| AuthoredLight {
        light_type: AuthoredLightType::Spot,
        inner_cutoff: inner,
        outer_cutoff: outer,
        ..default()
    };
    assert!(state_with_light(spot(10.0, 30.0)).validate().is_ok());
    assert!(state_with_light(spot(40.0, 30.0)).validate().is_err());
    assert!(state_with_light(spot(0.0, 0.0)).validate().is_err());
    let point_with_odd_cone = AuthoredLight {
        inner_cutoff: 40.0,
        outer_cutoff: 30.0,
        ..default()
    };
    assert!(state_with_light(point_with_odd_cone).validate().is_ok());
    let no_radius = AuthoredLight {
        radius: 0.0,
        ..default()
    };
    assert!(state_with_light(no_radius).validate().is_err());
}

#[test]
fn authored_lights_become_valid_dynamic_lights() {
    let authored = AuthoredLight {
        light_type: AuthoredLightType::Spot,
        color: [0.5, 0.25, 1.0],
        intensity: 4.0,
        radius: 9.0,
        falloff: 0.5,
        inner_cutoff: 15.0,
        outer_cutoff: 25.0,
        realtime: true,
        shadows: AuthoredShadowMode::Realtime,
        enabled: true,
        ..default()
    };
    let light = authored.to_dynamic_light();
    assert!(light.is_valid());
    assert_eq!(light.light_type, dynlight::light::LightType::Spot);
    assert_eq!(light.shadows, dynlight::light::ShadowMode::Realtime);
    assert!(light.realtime);
    assert_eq!(
        (light.intensity, light.radius, light.falloff),
        (4.0, 9.0, 0.5)
    );
    assert_eq!(light.color, Color::srgb(0.5, 0.25, 1.0));
}

#[test]
fn color_and_intensity_do_not_change_a_bake() {
    let light = AuthoredLight::default();
    let brighter = AuthoredLight {
        intensity: light.intensity * 3.0,
        color: [0.1, 0.2, 0.3],
        ..light.clone()
    };
    assert!(!light.bake_relevant_change(&brighter));
    let wider = AuthoredLight {
        radius: light.radius + 1.0,
        ..light.clone()
    };
    assert!(light.bake_relevant_change(&wider));
}

#[test]
fn world_transforms_compose_through_parents() {
    let state = sample_state();
    let hierarchy = AuthoredHierarchy::new(&state);
    let parent = state.object("group-hall").expect("hall");
    let child = state.object("light-lamp").expect("lamp");
    let expected = local_transform(parent).transform_point(Vec3::from_array(child.translation));
    let world = hierarchy
        .world_transform("light-lamp")
        .expect("lamp transform");
    assert!(world.translation.abs_diff_eq(expected, 1e-5));
    let root = hierarchy
        .world_transform("light-spot")
        .expect("spot transform");
    assert!(
        root.translation
            .abs_diff_eq(Vec3::from_array([2.0, 3.0, 1.0]), 1e-6)
    );
    assert!(hierarchy.world_transform("missing").is_none());
}

#[test]
fn hidden_ancestors_hide_children_and_cycles_are_rejected() {
    let mut state = sample_state();
    object_mut(&mut state, "group-hall").visible = false;
    let hierarchy = AuthoredHierarchy::new(&state);
    assert!(!hierarchy.effectively_visible("light-lamp"));
    assert!(hierarchy.effectively_visible("light-spot"));

    let mut looped = sample_state();
    object_mut(&mut looped, "group-hall").parent_id = Some("light-lamp".into());
    let hierarchy = AuthoredHierarchy::new(&looped);
    assert!(hierarchy.world_transform("light-lamp").is_none());
}

#[test]
fn revision_gate_orders_within_a_session_and_resets_across_sessions() {
    let mut gate = RevisionGate::default();
    assert_eq!(gate.admit("doc", "a", 5), RevisionVerdict::NewSession);
    assert_eq!(gate.admit("doc", "a", 6), RevisionVerdict::Newer);
    assert_eq!(gate.admit("doc", "a", 6), RevisionVerdict::Repeat);
    assert_eq!(gate.admit("doc", "a", 4), RevisionVerdict::Stale);
    assert_eq!(gate.revision(), 6);
    assert_eq!(gate.admit("doc", "b", 1), RevisionVerdict::NewSession);
    assert_eq!(gate.revision(), 1);
    assert_eq!(gate.admit("other", "b", 1), RevisionVerdict::NewSession);
    assert_eq!(gate.document_id(), Some("other"));
}

#[test]
fn catalog_sample_parses_and_rejects_escaping_paths() {
    let json = include_str!("../../../../fixtures/material_catalog_sample.json");
    let catalog = MaterialCatalog::parse(json).expect("the sample catalog parses");
    let wall = catalog.get("stone/castle_wall").expect("castle wall");
    assert_eq!(wall.resolver, DYNLIT_RESOLVER);
    assert_eq!(wall.texture_paths().count(), 2);
    let ivy = catalog.get("foliage/ivy").expect("ivy");
    assert_eq!(ivy.alpha, CatalogAlpha::Mask);

    let escaping = json.replace("textures/ivy_base.png", "../secrets.png");
    assert!(MaterialCatalog::parse(&escaping).is_err());
    let duplicated = json.replace("foliage/ivy", "stone/castle_wall");
    assert!(MaterialCatalog::parse(&duplicated).is_err());
    assert!(!is_contained_path("C:/absolute.png"));
    assert!(is_contained_path("textures/a.png"));
}

#[test]
fn level_names_and_geometry_files_are_file_system_safe() {
    assert_eq!(sanitize_level_name("Castle Keep!"), "castle_keep_");
    assert_eq!(sanitize_level_name("  "), "level");
    assert_eq!(sanitize_level_name("../.."), "level");
    let name = geometry_file_name(42);
    assert!(is_geometry_file_name(&name));
    assert!(!is_geometry_file_name("geometry_.glb"));
    assert!(!is_geometry_file_name("level.broom.json"));
}

#[test]
fn manifests_must_name_a_plain_geometry_file() {
    let manifest = LevelManifest {
        protocol: PROTOCOL_VERSION,
        level_name: "level".into(),
        geometry_file: geometry_file_name(1),
        geometry_revision: 3,
        state: sample_state(),
    };
    let json = serde_json::to_string(&manifest).expect("serializes");
    assert_eq!(LevelManifest::parse(&json), Ok(manifest.clone()));
    let escaping = LevelManifest {
        geometry_file: "../elsewhere.glb".into(),
        ..manifest
    };
    let json = serde_json::to_string(&escaping).expect("serializes");
    assert!(LevelManifest::parse(&json).is_err());
}

/// The id of the first object of `kind` in the sample state.
fn sample_id_of_kind(kind: AuthoredObjectKind) -> String {
    let state = sample_state();
    let object = state.objects.iter().find(|object| object.kind == kind);
    object.expect("the sample has this kind").id.clone()
}

#[test]
fn rooms_and_portals_need_finite_sizes_above_zero() {
    let room_id = sample_id_of_kind(AuthoredObjectKind::Room);
    let portal_id = sample_id_of_kind(AuthoredObjectKind::Portal);
    let mut state = sample_state();
    object_mut(&mut state, &room_id).room = None;
    let rejection = state.validate();
    assert!(matches!(
        rejection,
        Err(StateRejection::RoomWithoutSettings(_))
    ));
    let mut state = sample_state();
    object_mut(&mut state, &portal_id).portal = None;
    let rejection = state.validate();
    assert!(matches!(
        rejection,
        Err(StateRejection::PortalWithoutSettings(_))
    ));
    for broken in [0.0, -1.0, f32::NAN, f32::INFINITY] {
        let mut state = sample_state();
        let room = object_mut(&mut state, &room_id)
            .room
            .as_mut()
            .expect("room");
        room.half_size[1] = broken;
        let rejection = state.validate();
        assert!(matches!(rejection, Err(StateRejection::InvalidRoom { .. })));
        let mut state = sample_state();
        let portal = object_mut(&mut state, &portal_id)
            .portal
            .as_mut()
            .expect("portal");
        portal.size[0] = broken;
        let rejection = state.validate();
        assert!(matches!(
            rejection,
            Err(StateRejection::InvalidPortal { .. })
        ));
    }
}

#[test]
fn authored_rooms_and_portals_become_dynlight_components() {
    let room = AuthoredRoom {
        half_size: [1.0, 2.0, 3.0],
    };
    assert_eq!(room.to_room().half_size, Vec3::new(1.0, 2.0, 3.0));
    let portal = AuthoredPortal {
        size: [1.5, 2.5],
        closed: false,
    };
    assert_eq!(
        portal.to_portal(),
        dynlight::portals::Portal::new(Vec2::new(1.5, 2.5))
    );
    let json = r#"{ "size": [1.0, 2.0] }"#;
    let parsed: AuthoredPortal = serde_json::from_str(json).expect("closed is optional");
    assert!(!parsed.closed);
}

#[test]
fn forgotten_revisions_are_accepted_again_but_newer_ones_stay() {
    let mut gate = RevisionGate::default();
    gate.admit("doc", "a", 3);
    gate.admit("doc", "a", 4);
    gate.forget(4, 3);
    assert_eq!(gate.revision(), 3);
    assert_eq!(gate.admit("doc", "a", 4), RevisionVerdict::Newer);
    gate.admit("doc", "a", 5);
    gate.forget(4, 3);
    assert_eq!(gate.revision(), 5);
    assert_eq!(gate.judge("doc", "a", 4), RevisionVerdict::Stale);
}

/// Components travel on any object kind, and empty component or field names are rejected
/// with the object's id.
#[test]
fn components_need_named_types_and_fields() {
    let state = sample_state();
    let carrying: Vec<AuthoredObjectKind> = state
        .objects
        .iter()
        .filter(|object| !object.components.is_empty())
        .map(|object| object.kind)
        .collect();
    assert!(carrying.contains(&AuthoredObjectKind::GameEntity));
    assert!(
        carrying
            .iter()
            .any(|kind| *kind != AuthoredObjectKind::GameEntity)
    );

    let mut state = sample_state();
    let id = state.objects[0].id.clone();
    object_mut(&mut state, &id)
        .components
        .insert(" ".into(), Default::default());
    assert!(matches!(
        state.validate(),
        Err(StateRejection::InvalidComponents { id: rejected, .. }) if rejected == id
    ));

    let mut state = sample_state();
    let fields = std::collections::BTreeMap::from([(String::new(), serde_json::Value::Null)]);
    object_mut(&mut state, &id)
        .components
        .insert("game::Door".into(), fields);
    assert!(matches!(
        state.validate(),
        Err(StateRejection::InvalidComponents { .. })
    ));
}
