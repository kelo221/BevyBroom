//! Helpers shared by the crate's tests: the sample fixtures, headless apps that apply authored
//! state, minimal GLB publications and per-test temporary directories.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use base64::Engine as _;
use bevy::prelude::*;

use crate::authoring::{AuthoringInbox, AuthoringPlugin};
use crate::project::{ProjectConfig, ProjectPaths};
use crate::protocol::{
    AuthoredObject, AuthoredState, GeometryPublication, PROTOCOL_VERSION, RevisionVerdict,
    StateRejection,
};

/// The sample project file at the workspace root.
pub(crate) const SAMPLE_PROJECT: &str = include_str!("../../../broom.project.json");

/// The level name every test publication uses, before sanitizing.
pub(crate) const TEST_LEVEL_NAME: &str = "Test Level";

/// The shared sample snapshot, also parsed by the editor's tests.
pub(crate) fn sample_state() -> AuthoredState {
    let json = include_str!("../../../fixtures/authored_state_sample.json");
    serde_json::from_str(json).expect("the sample state parses")
}

/// The object with `id` in `state`, for editing a snapshot in place.
pub(crate) fn object_mut<'a>(state: &'a mut AuthoredState, id: &str) -> &'a mut AuthoredObject {
    state
        .objects
        .iter_mut()
        .find(|object| object.id == id)
        .unwrap_or_else(|| panic!("the state has an object {id}"))
}

/// `state` as the next snapshot of the same editor session.
pub(crate) fn next_revision(state: &AuthoredState) -> AuthoredState {
    AuthoredState {
        revision: state.revision + 1,
        ..state.clone()
    }
}

/// A headless app that applies authored state: `MinimalPlugins` plus the authoring plugin.
pub(crate) fn authoring_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, AuthoringPlugin));
    app
}

/// Hands `state` to the app's inbox the way the remote handler does, then runs one frame.
pub(crate) fn state_send(
    app: &mut App,
    state: AuthoredState,
) -> Result<RevisionVerdict, StateRejection> {
    let verdict = app
        .world_mut()
        .resource_mut::<AuthoringInbox>()
        .receive(state);
    app.update();
    verdict
}

/// A minimal binary glTF: a valid 12-byte GLB header followed by `payload`.
pub(crate) fn glb_bytes(payload: &[u8]) -> Vec<u8> {
    let total_length = u32::try_from(12 + payload.len()).expect("a small test payload");
    let mut bytes = b"glTF".to_vec();
    bytes.extend_from_slice(&2u32.to_le_bytes());
    bytes.extend_from_slice(&total_length.to_le_bytes());
    bytes.extend_from_slice(payload);
    bytes
}

/// A publication of `bytes` as geometry revision `geometry_revision` of `state`'s document and
/// session, named [`TEST_LEVEL_NAME`].
pub(crate) fn publication_of_bytes(
    state: &AuthoredState,
    geometry_revision: u64,
    bytes: &[u8],
) -> GeometryPublication {
    GeometryPublication {
        protocol: PROTOCOL_VERSION,
        document_id: state.document_id.clone(),
        session_id: state.session_id.clone(),
        geometry_revision,
        level_name: TEST_LEVEL_NAME.into(),
        glb_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}

/// A GLB publication carrying [`glb_bytes`] of `payload`; see [`publication_of_bytes`].
pub(crate) fn glb_publication(
    state: &AuthoredState,
    geometry_revision: u64,
    payload: &[u8],
) -> GeometryPublication {
    publication_of_bytes(state, geometry_revision, &glb_bytes(payload))
}

/// The sample project resolved inside `project_root`.
pub(crate) fn sample_project_paths(project_root: &Path) -> ProjectPaths {
    let config = ProjectConfig::parse(SAMPLE_PROJECT).expect("the sample project parses");
    ProjectPaths::resolve(&config, project_root)
}

/// A directory unique to one test, deleted with everything in it when dropped.
pub(crate) struct TemporaryDirectory {
    path: PathBuf,
}

impl TemporaryDirectory {
    /// Creates a new empty directory under the system temp directory; `label` names the test.
    pub(crate) fn new(label: &str) -> Self {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |elapsed| elapsed.as_nanos());
        let name = format!(
            "broom_bridge_{label}_{}_{nanos}_{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        );
        let path = std::env::temp_dir().join(name);
        std::fs::create_dir_all(&path).expect("the temporary directory can be created");
        Self { path }
    }

    /// The directory's absolute path.
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TemporaryDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}
