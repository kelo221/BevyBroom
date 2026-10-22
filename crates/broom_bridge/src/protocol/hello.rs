//! The handshake the editor makes before it publishes anything: which protocol versions the
//! bridge speaks, which features it serves and which project it belongs to. The editor refuses
//! to publish a scene into a game that fails this check.

use serde::{Deserialize, Serialize};

use super::state::PROTOCOL_VERSION;

/// The oldest protocol version whose messages the bridge still accepts. Version 4 only added
/// the handshake, so version 3 snapshots, publications and manifests still read.
pub const MIN_PROTOCOL_VERSION: u32 = 3;

/// Every feature the bridge serves, by name. The editor checks the ones it needs.
pub const CAPABILITIES: [&str; 7] = [
    "state",
    "geometry",
    "catalog",
    "placeables",
    "data_assets",
    "bake_preview",
    "load_level",
];

/// The reply to `broom.hello`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct HelloReply {
    /// The newest protocol version the bridge speaks.
    pub protocol: u32,
    /// The oldest protocol version the bridge accepts.
    pub min_protocol: u32,
    pub bridge_version: String,
    /// The project the running game was started for.
    pub project_id: String,
    /// The process; changes every time the game starts.
    pub instance_id: String,
    pub capabilities: Vec<String>,
}

/// The protocol versions a bridge advertises. Games use the default; tests override it to
/// prove the editor rejects a mismatch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ProtocolRange {
    pub min: u32,
    pub max: u32,
}

impl Default for ProtocolRange {
    fn default() -> Self {
        Self {
            min: MIN_PROTOCOL_VERSION,
            max: PROTOCOL_VERSION,
        }
    }
}

impl ProtocolRange {
    /// A range that only speaks `version`.
    pub fn only(version: u32) -> Self {
        Self {
            min: version,
            max: version,
        }
    }

    /// Whether messages of `version` are accepted.
    pub fn accepts(&self, version: u32) -> bool {
        (self.min..=self.max).contains(&version)
    }

    /// The handshake reply for this range.
    pub fn hello(&self, bridge_version: &str, project_id: &str, instance_id: &str) -> HelloReply {
        HelloReply {
            protocol: self.max,
            min_protocol: self.min,
            bridge_version: bridge_version.to_owned(),
            project_id: project_id.to_owned(),
            instance_id: instance_id.to_owned(),
            capabilities: CAPABILITIES.iter().map(|name| (*name).to_owned()).collect(),
        }
    }
}

/// Whether messages of `version` are accepted by the default range.
pub fn protocol_supported(version: u32) -> bool {
    ProtocolRange::default().accepts(version)
}
