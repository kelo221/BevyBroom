//! Preview bakes requested by the editor, and whether the shown bake still matches the scene.
//!
//! A bake is kept in memory (`output: None`), so a bake that finishes after the scene changed
//! never writes a file; its result is simply dropped. Bakes wait while geometry is loading so a
//! half-swapped level is never baked.

mod fingerprint;
#[cfg(test)]
mod tests;

use bevy::prelude::*;
use dynlight::bake::{BakeFinished, BakePreset, BakeRequest, BakeStatus};
use dynlight::baked_lighting::ActiveBake;

use crate::authoring::{AppliedAuthoring, BroomSystems};
use crate::level::LevelGeometry;
use crate::status::{BakeState, BridgeStatus};

pub use fingerprint::bake_fingerprint;

/// The bake the editor asked for and the one shown.
#[derive(Resource, Default)]
pub struct BakeLink {
    requested: bool,
    /// Whether any bake was sent, so a first bake dropped as stale reports that a bake is needed.
    attempted: bool,
    running_fingerprint: Option<u64>,
    shown_fingerprint: Option<u64>,
    failure: Option<String>,
}

impl BakeLink {
    /// Asks for a preview bake as soon as the geometry is settled.
    pub fn request(&mut self) {
        self.requested = true;
    }
}

/// The current scene's fingerprint, when a document's geometry is shown.
fn current_fingerprint(applied: &AppliedAuthoring, level: &LevelGeometry) -> Option<u64> {
    let state = applied.state.as_ref()?;
    let shown = level.shown()?;
    (shown.document_id == state.document_id).then(|| bake_fingerprint(state, &shown.file_name))
}

/// Sends the requested bake once nothing is loading and no bake runs.
fn start_requested_bake(
    mut link: ResMut<BakeLink>,
    applied: Res<AppliedAuthoring>,
    level: Res<LevelGeometry>,
    bake_status: Res<BakeStatus>,
    mut requests: MessageWriter<BakeRequest>,
) {
    if !link.requested || level.busy() || bake_status.is_running() {
        return;
    }
    let Some(fingerprint) = current_fingerprint(&applied, &level) else {
        return;
    };
    link.requested = false;
    link.attempted = true;
    link.failure = None;
    link.running_fingerprint = Some(fingerprint);
    requests.write(BakeRequest {
        output: None,
        preset: BakePreset::Preview,
    });
}

/// Applies a finished bake only when the scene is still the one it baked.
fn finish_bake(
    mut link: ResMut<BakeLink>,
    mut finished: MessageReader<BakeFinished>,
    mut active: ResMut<ActiveBake>,
    applied: Res<AppliedAuthoring>,
    level: Res<LevelGeometry>,
) {
    for message in finished.read() {
        let Some(baked) = link.running_fingerprint.take() else {
            continue;
        };
        match &message.result {
            Ok(report) if Some(baked) == current_fingerprint(&applied, &level) => {
                active.0 = Some(report.handle.clone());
                link.shown_fingerprint = Some(baked);
                info!(
                    "broom bridge: preview bake applied in {} ms",
                    report.milliseconds
                );
            }
            Ok(_) => info!("broom bridge: the scene changed during the bake; result dropped"),
            Err(failure) => link.failure = Some(format!("{failure:?}")),
        }
    }
}

/// Publishes the bake state whenever the request, the scene or the geometry changed.
fn report_bake_state(
    link: Res<BakeLink>,
    applied: Res<AppliedAuthoring>,
    level: Res<LevelGeometry>,
    mut status: ResMut<BridgeStatus>,
) {
    if !(link.is_changed() || applied.is_changed() || level.is_changed()) {
        return;
    }
    let current = current_fingerprint(&applied, &level);
    let (state, message) = match (
        &link.failure,
        link.running_fingerprint,
        link.shown_fingerprint,
    ) {
        (Some(failure), _, _) => (BakeState::Failed, Some(failure.clone())),
        (None, Some(_), _) => (BakeState::Baking, None),
        _ if link.requested => (BakeState::Baking, Some("waiting for geometry".into())),
        (None, None, Some(shown)) if Some(shown) == current => (BakeState::Current, None),
        (None, None, Some(_)) => (BakeState::NeedsBake, None),
        (None, None, None) if link.attempted => (BakeState::NeedsBake, None),
        (None, None, None) => (BakeState::NoBake, None),
    };
    status.bake_state = state;
    status.bake_message = message;
}

pub struct BakeLinkPlugin;

impl Plugin for BakeLinkPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<BakeLink>().add_systems(
            Update,
            (start_requested_bake, finish_bake, report_bake_state)
                .chain()
                .after(BroomSystems::Geometry),
        );
    }
}
