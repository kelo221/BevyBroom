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
