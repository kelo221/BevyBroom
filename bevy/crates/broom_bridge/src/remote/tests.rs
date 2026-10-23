use bevy::prelude::*;

use super::*;
use crate::protocol::{CAPABILITIES, HelloReply, PROTOCOL_VERSION};
use crate::status::BridgeStatus;

/// Runs `broom.hello` in a world advertising `range` for project `project_id`.
fn hello_in_world(range: ProtocolRange, project_id: &str) -> (HelloReply, BridgeStatus) {
    let mut world = World::new();
    let status = BridgeStatus::new(project_id);
    world.insert_resource(status.clone());
    world.insert_resource(AdvertisedProtocol(range));
    let reply = world
        .run_system_cached_with(handlers::hello, None)
        .expect("the handler runs")
        .expect("the handler answers");
    let hello = serde_json::from_value(reply).expect("the reply is a hello");
    (hello, status)
}

#[test]
fn hello_reports_the_advertised_range_project_instance_and_capabilities() {
    let (hello, status) = hello_in_world(ProtocolRange::default(), "game-under-test");
    assert_eq!(hello.protocol, PROTOCOL_VERSION);
    assert_eq!(hello.project_id, "game-under-test");
    assert_eq!(hello.instance_id, status.instance_id);
    assert_eq!(hello.capabilities.len(), CAPABILITIES.len());
    assert!(hello.capabilities.iter().any(|name| name == "state"));
}

#[test]
fn hello_reports_an_overridden_range() {
    let (hello, _) = hello_in_world(ProtocolRange::only(PROTOCOL_VERSION + 5), "p");
    assert_eq!(hello.protocol, PROTOCOL_VERSION + 5);
    assert_eq!(hello.min_protocol, PROTOCOL_VERSION + 5);
}

#[test]
fn every_method_name_is_unique_and_namespaced() {
    let mut names: Vec<&str> = METHODS.to_vec();
    names.sort_unstable();
    names.dedup();
    assert_eq!(names.len(), METHODS.len());
    assert!(METHODS.iter().all(|name| name.starts_with("broom.")));
}

/// Runs `broom.apply_state` with a sample state naming `sent_project` in a game running
/// `running_project`, returning whether it was accepted and the errors the game reported.
fn apply_state_in_world(sent_project: &str, running_project: &str) -> (bool, usize) {
    let mut world = World::new();
    world.insert_resource(BridgeStatus::new(running_project));
    world.init_resource::<crate::authoring::AuthoringInbox>();
    let mut state = crate::test_support::sample_state();
    state.project_id = sent_project.to_owned();
    let params = serde_json::to_value(&state).expect("the state serializes");
    let accepted = world
        .run_system_cached_with(handlers::apply_state, Some(params))
        .expect("the handler runs")
        .is_ok();
    (accepted, world.resource::<BridgeStatus>().errors.len())
}

#[test]
fn apply_state_accepts_its_own_project_or_none_and_refuses_another() {
    assert_eq!(apply_state_in_world("game-a", "game-a"), (true, 0));
    assert_eq!(apply_state_in_world("", "game-a"), (true, 0));
    assert_eq!(apply_state_in_world("game-b", "game-a"), (false, 1));
}
