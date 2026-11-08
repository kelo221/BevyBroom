//! Applies the editor's authored state to the world: the transforms and visibility of exported
//! geometry nodes and, with the `dynlight` feature, DynLight lights, room cells and portals
//! spawned and updated by id and the complete settings of light nodes in shipped levels. Without
//! the feature, lights, rooms and portals are accepted but get no entities (`unrendered`).
//!
//! Remote handlers only queue a validated snapshot in [`AuthoringInbox`]; the systems here apply
//! the newest one in `Update`, before transforms propagate in `PostUpdate`.

#[cfg(feature = "dynlight")]
mod light_companions;
#[cfg(feature = "dynlight")]
mod lights;
mod markers;
mod nodes;
mod ownership;
#[cfg(feature = "dynlight")]
mod portals;
#[cfg(feature = "dynlight")]
mod shipped_lights;
#[cfg(all(test, feature = "dynlight"))]
mod tests;
#[cfg(not(feature = "dynlight"))]
mod unrendered;

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::prelude::*;
use bevy::transform::TransformSystems;

use crate::protocol::{AuthoredState, RevisionGate, RevisionVerdict, StateRejection};

#[cfg(feature = "dynlight")]
pub use light_companions::AuthoredLightCookiePath;
pub use markers::{AuthoredCellEntity, AuthoredLightEntity};
pub use nodes::AuthoredNode;
pub(crate) use nodes::tag_authored_nodes;
#[cfg(feature = "dynlight")]
pub use shipped_lights::{ShippedLight, ShippedLightReplaced, ShippedLightSettings};

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

/// The snapshot the world currently shows, and the one shown before it.
#[derive(Resource, Default)]
pub struct AppliedAuthoring {
    pub state: Option<AuthoredState>,
    /// The snapshot applied before `state`; authored values it already wrote are not written
    /// again (see the `ownership` module).
    pub previous: Option<AuthoredState>,
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
            .add_systems(Update, apply_pending_state.in_set(BroomSystems::ApplyState))
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
        add_authored_object_systems(app);
    }
}

/// Lights, rooms and portals follow the applied snapshot as DynLight entities, and shipped
/// light nodes get their complete settings.
#[cfg(feature = "dynlight")]
fn add_authored_object_systems(app: &mut App) {
    app.register_type::<AuthoredLightCookiePath>()
        .register_type::<dynlight::effects::LightEffect>()
        .register_type::<ShippedLight>()
        .register_type::<ShippedLightReplaced>()
        .add_systems(
            Update,
            (lights::sync_lights, portals::sync_cells)
                .after(apply_pending_state)
                .in_set(BroomSystems::ApplyState),
        )
        .add_systems(
            PostUpdate,
            (
                shipped_lights::read_shipped_lights,
                shipped_lights::replace_shipped_lights,
            )
                .chain(),
        );
}

/// Without DynLight, lights, rooms and portals get no entities; a debug line says so.
#[cfg(not(feature = "dynlight"))]
fn add_authored_object_systems(app: &mut App) {
    app.add_systems(
        Update,
        unrendered::log_unrendered_objects
            .after(apply_pending_state)
            .in_set(BroomSystems::ApplyState),
    );
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
    applied.previous = applied.state.replace(state);
}
