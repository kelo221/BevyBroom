//! Keeping the revision, geometry and loading fields of [`BridgeStatus`] current every frame.

use bevy::prelude::*;

use super::BridgeStatus;
use crate::authoring::{AppliedAuthoring, AuthoringInbox};
use crate::level::LevelGeometry;

/// Copies the applied document, revisions and loading state into the status.
pub(crate) fn refresh_status(
    mut status: ResMut<BridgeStatus>,
    inbox: Res<AuthoringInbox>,
    applied: Res<AppliedAuthoring>,
    level: Res<LevelGeometry>,
) {
    let status = status.bypass_change_detection();
    status.document_id = applied.document_id().map(str::to_owned);
    status.state_revision_received = inbox.received_revision();
    status.state_revision_applied = applied.revision();
    status.geometry_revision_received = level.received_revision();
    status.geometry_revision_applied = level.shown().map_or(0, |shown| shown.geometry_revision);
    status.geometry_revision_failed = level.failed_revision();
    status.geometry_file = level.shown().map(|shown| shown.file_name.clone());
    status.geometry_loading = level.busy();
}
