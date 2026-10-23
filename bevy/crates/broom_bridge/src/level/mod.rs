//! Level geometry: publications from the editor are written as new immutable GLB files, loaded,
//! and swapped in once spawned. The previous geometry stays until then, and stays for good when
//! the new revision fails to load. The manifest next to the geometry lets the game load the
//! level on its own ([`LevelLoadRequest`]).

pub mod files;
mod loading;
mod manifest;
#[cfg(test)]
mod tests;

use bevy::prelude::*;

use crate::authoring::BroomSystems;
use crate::protocol::{GeometryPublication, RevisionGate, RevisionVerdict, sanitize_level_name};

pub use loading::LevelGeometryRoot;
pub use manifest::LevelLoadRequest;

/// Where the bytes of a geometry revision come from.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum GeometrySource {
    /// A publication's GLB, to be written to a new file.
    Bytes(Vec<u8>),
    /// A file already in the level directory, named by a manifest.
    ExistingFile(String),
}

/// A geometry revision waiting to load.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct GeometryJob {
    pub document_id: String,
    pub level_name: String,
    pub geometry_revision: u64,
    pub source: GeometrySource,
}

/// The geometry being loaded.
#[derive(Debug)]
pub(crate) struct LoadingGeometry {
    pub job_document: String,
    pub level_name: String,
    pub geometry_revision: u64,
    pub file_name: String,
    pub root: Entity,
}

/// The geometry on screen.
#[derive(Clone, Debug, PartialEq)]
pub struct ShownGeometry {
    pub document_id: String,
    pub level_name: String,
    pub geometry_revision: u64,
    pub file_name: String,
    pub root: Entity,
}

/// The geometry pipeline: at most one revision loading and one waiting, the newest.
#[derive(Resource, Default)]
pub struct LevelGeometry {
    gate: RevisionGate,
    queued: Option<GeometryJob>,
    loading: Option<LoadingGeometry>,
    shown: Option<ShownGeometry>,
    last_stamp: u64,
    failed: u64,
}

impl LevelGeometry {
    /// Validates and decodes `publication`, queueing it when newer than what was received.
    pub fn receive(&mut self, publication: GeometryPublication) -> Result<RevisionVerdict, String> {
        publication.validate()?;
        let verdict = self.gate.judge(
            &publication.document_id,
            &publication.session_id,
            publication.geometry_revision,
        );
        if !verdict.accepts() {
            return Ok(verdict);
        }
        let bytes = decode_base64(&publication.glb_base64)?;
        if !bytes.starts_with(b"glTF") {
            return Err("the publication is not a binary glTF (GLB) file".into());
        }
        self.gate.admit(
            &publication.document_id,
            &publication.session_id,
            publication.geometry_revision,
        );
        self.queued = Some(GeometryJob {
            document_id: publication.document_id,
            level_name: sanitize_level_name(&publication.level_name),
            geometry_revision: publication.geometry_revision,
            source: GeometrySource::Bytes(bytes),
        });
        Ok(verdict)
    }

    /// Queues an existing geometry file (from a manifest), replacing any queued job.
    pub(crate) fn queue(&mut self, job: GeometryJob) {
        self.queued = Some(job);
    }

    /// The newest received geometry revision.
    pub fn received_revision(&self) -> u64 {
        self.gate.revision()
    }

    /// The newest geometry revision that failed to load, 0 when none did.
    pub fn failed_revision(&self) -> u64 {
        self.failed
    }

    /// Records that `revision` failed to load and forgets it in the gate, so the editor may
    /// resend it.
    pub(crate) fn record_failed(&mut self, revision: u64) {
        self.failed = self.failed.max(revision);
        let fallback = self
            .shown
            .as_ref()
            .map_or(0, |shown| shown.geometry_revision);
        self.gate.forget(revision, fallback);
    }

    /// Whether a revision is loading or waiting.
    pub fn busy(&self) -> bool {
        self.loading.is_some() || self.queued.is_some()
    }

    /// The geometry on screen.
    pub fn shown(&self) -> Option<&ShownGeometry> {
        self.shown.as_ref()
    }
}

#[cfg(test)]
impl LevelGeometry {
    /// Test setup: makes `shown` the geometry on screen without loading it.
    pub(crate) fn set_shown_for_test(&mut self, shown: ShownGeometry) {
        self.shown = Some(shown);
    }

    /// The revision waiting to load, for tests to inspect.
    pub(crate) fn queued_for_test(&self) -> Option<&GeometryJob> {
        self.queued.as_ref()
    }
}

/// Decodes standard base64 with or without padding.
fn decode_base64(text: &str) -> Result<Vec<u8>, String> {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(text.trim())
        .map_err(|error| format!("the geometry is not valid base64: {error}"))
}

pub struct LevelPlugin;

impl Plugin for LevelPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<LevelGeometry>()
            .init_resource::<manifest::ManifestWriter>()
            .add_message::<LevelLoadRequest>()
            .add_systems(
                Update,
                (
                    manifest::load_requested_levels,
                    loading::forget_other_documents,
                    loading::start_queued_geometry,
                    loading::watch_failed_loads,
                    manifest::write_manifest_when_due,
                )
                    .chain()
                    .in_set(BroomSystems::Geometry),
            );
    }
}
