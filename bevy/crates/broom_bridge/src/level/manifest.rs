//! Keeping the level manifest in step with what is shown, and loading a level from its
//! manifest without the editor.

use bevy::prelude::*;

use super::files::{read_manifest, write_manifest};
use super::{GeometryJob, GeometrySource, LevelGeometry};
use crate::authoring::{AppliedAuthoring, AuthoringInbox};
use crate::project::ProjectPaths;
use crate::protocol::{LevelManifest, sanitize_level_name};
use crate::status::BridgeStatus;

/// The shortest time between two manifest writes while lights are being dragged.
const MANIFEST_INTERVAL_SECONDS: f64 = 0.5;

/// Asks to load the level named `level_name` from its manifest.
#[derive(Message, Clone, Debug, PartialEq, Eq)]
pub struct LevelLoadRequest {
    pub level_name: String,
}

/// Rate limiting of manifest writes.
#[derive(Resource, Default)]
pub(crate) struct ManifestWriter {
    due: bool,
    last_written: Option<f64>,
}

impl ManifestWriter {
    /// Asks for the manifest to be written soon.
    pub(super) fn mark_due(&mut self) {
        self.due = true;
    }

    /// Whether a write may happen at `now`.
    fn may_write(&self, now: f64) -> bool {
        self.due
            && self
                .last_written
                .is_none_or(|last| now - last >= MANIFEST_INTERVAL_SECONDS)
    }
}

/// Writes the manifest when the applied state or the shown geometry changed, at most every
/// [`MANIFEST_INTERVAL_SECONDS`], and only when both belong to the same document.
pub(super) fn write_manifest_when_due(
    mut writer: ResMut<ManifestWriter>,
    applied: Res<AppliedAuthoring>,
    level: Res<LevelGeometry>,
    paths: Res<ProjectPaths>,
    time: Res<Time<Real>>,
    mut status: ResMut<BridgeStatus>,
) {
    if applied.is_changed() {
        writer.mark_due();
    }
    let now = time.elapsed_secs_f64();
    if !writer.may_write(now) {
        return;
    }
    let (Some(state), Some(shown)) = (applied.state.as_ref(), level.shown()) else {
        return;
    };
    if state.document_id != shown.document_id {
        return;
    }
    let manifest = LevelManifest::new(
        shown.level_name.clone(),
        shown.file_name.clone(),
        shown.geometry_revision,
        state.clone(),
    );
    writer.due = false;
    writer.last_written = Some(now);
    if let Err(error) = write_manifest(&paths.level_directory_of(&shown.level_name), &manifest) {
        status.report_error(error);
    }
}

/// Loads requested levels: their state is received like an editor snapshot and their geometry
/// file is queued.
pub(super) fn load_requested_levels(
    mut requests: MessageReader<LevelLoadRequest>,
    mut inbox: ResMut<AuthoringInbox>,
    mut level: ResMut<LevelGeometry>,
    mut status: ResMut<BridgeStatus>,
    paths: Res<ProjectPaths>,
) {
    for request in requests.read() {
        let level_name = sanitize_level_name(&request.level_name);
        let manifest = match read_manifest(&paths.level_directory_of(&level_name)) {
            Ok(manifest) => manifest,
            Err(error) => {
                status.report_error(format!("level {level_name}: {error}"));
                continue;
            }
        };
        let document_id = manifest.state.document_id.clone();
        if let Err(error) = inbox.receive(manifest.state) {
            status.report_error(format!("level {level_name}: {error}"));
            continue;
        }
        level.queue(GeometryJob {
            document_id,
            level_name,
            geometry_revision: manifest.geometry_revision,
            source: GeometrySource::ExistingFile(manifest.geometry_file),
        });
    }
}
