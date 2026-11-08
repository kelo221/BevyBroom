use super::*;

/// The shared handshake fixture, also parsed by the editor's tests.
fn sample_hello() -> HelloReply {
    let json = include_str!("../../../../fixtures/hello_sample.json");
    serde_json::from_str(json).expect("the sample hello parses")
}

/// The shared fixture as this build of the bridge would send it: a bridge without the
/// `dynlight` feature leaves out the [`DYNLIGHT_CAPABILITIES`].
fn sample_hello_of_this_build() -> HelloReply {
    let mut sample = sample_hello();
    if !cfg!(feature = "dynlight") {
        sample
            .capabilities
            .retain(|name| !DYNLIGHT_CAPABILITIES.contains(&name.as_str()));
    }
    sample
}

#[test]
fn sample_hello_matches_the_default_range_and_capabilities() {
    let sample = sample_hello_of_this_build();
    let built = ProtocolRange::default().hello(
        &sample.bridge_version,
        &sample.project_id,
        &sample.instance_id,
    );
    assert_eq!(built, sample);
}

#[test]
fn the_shared_sample_names_every_dynlight_capability() {
    let sample = sample_hello();
    for name in DYNLIGHT_CAPABILITIES {
        assert!(sample.capabilities.iter().any(|served| served == name));
    }
}

#[cfg(feature = "dynlight")]
#[test]
fn a_dynlight_bridge_serves_lights_and_preview_bakes() {
    let hello = ProtocolRange::default().hello("1", "project", "instance");
    for name in DYNLIGHT_CAPABILITIES {
        assert!(hello.capabilities.iter().any(|served| served == name));
    }
}

#[cfg(not(feature = "dynlight"))]
#[test]
fn a_bridge_without_dynlight_serves_neither_lights_nor_preview_bakes() {
    let hello = ProtocolRange::default().hello("1", "project", "instance");
    assert!(hello.capabilities.iter().any(|served| served == "state"));
    for name in DYNLIGHT_CAPABILITIES {
        assert!(!hello.capabilities.iter().any(|served| served == name));
    }
}

#[test]
fn default_range_accepts_the_previous_and_current_protocol_only() {
    let range = ProtocolRange::default();
    assert!(range.accepts(PROTOCOL_VERSION));
    assert!(range.accepts(MIN_PROTOCOL_VERSION));
    assert!(!range.accepts(MIN_PROTOCOL_VERSION - 1));
    assert!(!range.accepts(PROTOCOL_VERSION + 1));
}

#[test]
fn a_single_version_range_advertises_only_that_version() {
    let hello = ProtocolRange::only(PROTOCOL_VERSION + 7).hello("1", "project", "instance");
    assert_eq!(hello.protocol, PROTOCOL_VERSION + 7);
    assert_eq!(hello.min_protocol, PROTOCOL_VERSION + 7);
    assert_eq!(hello.project_id, "project");
}

#[test]
fn snapshots_and_publications_of_the_oldest_supported_protocol_still_validate() {
    let mut state = crate::test_support::sample_state();
    state.protocol = MIN_PROTOCOL_VERSION;
    assert_eq!(state.validate(), Ok(()));
    state.protocol = PROTOCOL_VERSION;
    assert_eq!(state.validate(), Ok(()));
    let mut publication = crate::test_support::glb_publication(&state, 1, b"");
    publication.protocol = MIN_PROTOCOL_VERSION;
    assert_eq!(publication.validate(), Ok(()));
    publication.protocol = MIN_PROTOCOL_VERSION - 1;
    assert!(publication.validate().is_err());
}
