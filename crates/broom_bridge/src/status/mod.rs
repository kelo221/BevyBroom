//! What the bridge reports to the editor: which revisions arrived and which are shown, what is
//! loading, the bake state, budgets and recent errors.

mod refresh;
#[cfg(test)]
mod tests;

use std::collections::VecDeque;

use bevy::prelude::*;
use serde::Serialize;

use crate::authoring::BroomSystems;

/// How many recent errors are kept.
const ERROR_HISTORY: usize = 16;

/// Where the preview bake stands.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum BakeState {
    #[default]
    NoBake,
    Current,
    /// The scene changed since the shown bake.
    NeedsBake,
    Baking,
    Failed,
}

/// Whether DynLight culls with the authored rooms and portals.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum PortalCullingState {
    /// No rooms: only the cameras' frusta cull.
    #[default]
    Empty,
    /// The rooms and portals are valid and cull.
    Active,
    /// The rooms or portals break DynLight's rules; `portal_message` says how.
    Disabled,
}

/// One reported error, numbered so the editor shows each only once.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct BridgeError {
    pub sequence: u64,
    pub message: String,
}

/// The status snapshot, serialized as the `broom.status` result.
#[derive(Resource, Serialize, Clone, Debug, PartialEq, Default)]
pub struct BridgeStatus {
    pub bridge_version: &'static str,
    pub protocol: u32,
    /// Changes whenever the game restarts, so the editor knows to resend everything.
    pub instance_id: String,
    pub project_id: String,
    pub document_id: Option<String>,
    pub state_revision_received: u64,
    pub state_revision_applied: u64,
    pub geometry_revision_received: u64,
    pub geometry_revision_applied: u64,
    /// The newest geometry revision that was accepted but failed to load; 0 when none.
    pub geometry_revision_failed: u64,
    pub geometry_loading: bool,
    pub geometry_file: Option<String>,
    pub light_count: usize,
    pub realtime_light_count: usize,
    pub realtime_shadow_count: usize,
    pub realtime_light_budget: u32,
    pub shadow_cubemap_budget: u32,
    pub room_count: usize,
    pub portal_count: usize,
    pub portal_state: PortalCullingState,
    pub portal_message: Option<String>,
    pub bake_state: BakeState,
    pub bake_message: Option<String>,
    pub catalog_material_count: usize,
    pub catalog_error: Option<String>,
    pub errors: VecDeque<BridgeError>,
    #[serde(skip)]
    next_error: u64,
}

impl BridgeStatus {
    /// A fresh status for project `project_id` with a new instance id.
    pub fn new(project_id: &str) -> Self {
        Self {
            bridge_version: env!("CARGO_PKG_VERSION"),
            protocol: crate::protocol::PROTOCOL_VERSION,
            instance_id: new_instance_id(),
            project_id: project_id.to_owned(),
            ..default()
        }
    }

    /// Records an error for the editor and the log.
    pub fn report_error(&mut self, message: impl Into<String>) {
        let message = message.into();
        warn!("broom bridge: {message}");
        self.next_error += 1;
        self.errors.push_back(BridgeError {
            sequence: self.next_error,
            message,
        });
        while self.errors.len() > ERROR_HISTORY {
            self.errors.pop_front();
        }
    }
}

/// An id unique to this process run.
fn new_instance_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_nanos());
    format!("{:x}-{:x}", nanos, std::process::id())
}

pub struct StatusPlugin;

impl Plugin for StatusPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (refresh::refresh_status, refresh::refresh_portal_status).after(BroomSystems::Geometry),
        );
    }
}
