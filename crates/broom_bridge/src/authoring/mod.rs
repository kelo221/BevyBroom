//! Applies the editor's authored state to the world: DynLight lights, room cells and portals
//! spawned and updated by id, and the transforms and visibility of exported geometry nodes.
//!
//! Remote handlers only queue a validated snapshot in [`AuthoringInbox`]; the systems here apply
//! the newest one in `Update`, before transforms propagate in `PostUpdate`.

mod lights;
mod nodes;
mod portals;
#[cfg(test)]
mod tests;

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::prelude::*;
use bevy::transform::TransformSystems;

use crate::protocol::{AuthoredState, RevisionGate, RevisionVerdict, StateRejection};

pub use lights::AuthoredLightEntity;
pub use nodes::AuthoredNode;
pub(crate) use nodes::tag_authored_nodes;
pub use portals::AuthoredCellEntity;

/// Ordering of the bridge's own work.
#[derive(SystemSet, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum BroomSystems {
    /// The newest snapshot becomes [`AppliedAuthoring`]; lights, rooms and portals follow it.
    ApplyState,
    /// Game entities and placeable components follow the applied snapshot.
    Components,
    /// Geometry publications are written, loaded and swapped in.
    Geometry,
}

/// Snapshots received but not yet applied, and the ordering of what was received.
#[derive(Resource, Default)]
pub struct AuthoringInbox {
    pending: Option<AuthoredState>,
    gate: RevisionGate,
}

impl AuthoringInbox {
    /// Validates `state` and queues it when it is newer than everything received before.
    pub fn receive(&mut self, state: AuthoredState) -> Result<RevisionVerdict, StateRejection> {
        state.validate()?;
        let verdict = self
            .gate
            .admit(&state.document_id, &state.session_id, state.revision);
        if verdict.accepts() {
            self.pending = Some(state);
        }
        Ok(verdict)
    }

    /// The newest received revision.
    pub fn received_revision(&self) -> u64 {
        self.gate.revision()
    }

    /// Takes the snapshot waiting to be applied.
    fn take_pending(&mut self) -> Option<AuthoredState> {
        self.pending.take()
    }
}

/// The snapshot the world currently shows.
#[derive(Resource, Default)]
pub struct AppliedAuthoring {
    pub state: Option<AuthoredState>,
}

impl AppliedAuthoring {
    /// The applied document's id.
    pub fn document_id(&self) -> Option<&str> {
        self.state.as_ref().map(|state| state.document_id.as_str())
    }

    /// The applied revision, 0 before any.
    pub fn revision(&self) -> u64 {
        self.state.as_ref().map_or(0, |state| state.revision)
    }
}

/// Sent when a snapshot of a different document than the shown one is applied, before it is.
#[derive(Message, Clone, Debug)]
pub struct DocumentSwitched {
    pub previous: Option<String>,
    pub current: String,
}

pub struct AuthoringPlugin;

impl Plugin for AuthoringPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<AuthoringInbox>()
            .init_resource::<AppliedAuthoring>()
            .register_type::<AuthoredNode>()
            .add_message::<DocumentSwitched>()
            .configure_sets(Update, BroomSystems::ApplyState)
            .configure_sets(
                Update,
                BroomSystems::Components.after(BroomSystems::ApplyState),
            )
            .configure_sets(
                Update,
                BroomSystems::Geometry.after(BroomSystems::Components),
            )
            .add_systems(
                Update,
                (
                    apply_pending_state,
                    (lights::sync_lights, portals::sync_cells),
                )
                    .chain()
                    .in_set(BroomSystems::ApplyState),
            )
            .add_systems(
                SpawnScene,
                nodes::tag_authored_nodes
                    .after(SceneSpawnerSystems::WorldInstanceSpawn)
                    .after(SceneSpawnerSystems::SceneSpawn),
            )
            .add_systems(
                PostUpdate,
                nodes::sync_node_transforms.before(TransformSystems::Propagate),
            );
    }
}

/// Moves the newest received snapshot into [`AppliedAuthoring`], announcing document switches.
fn apply_pending_state(
    mut inbox: ResMut<AuthoringInbox>,
    mut applied: ResMut<AppliedAuthoring>,
    mut switched: MessageWriter<DocumentSwitched>,
) {
    let Some(state) = inbox.take_pending() else {
        return;
    };
    if applied.document_id() != Some(state.document_id.as_str()) {
        switched.write(DocumentSwitched {
            previous: applied.document_id().map(str::to_owned),
            current: state.document_id.clone(),
        });
    }
    applied.state = Some(state);
}
