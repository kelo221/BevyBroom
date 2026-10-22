//! Exported geometry nodes: tagged with their editor id when a level spawns, then kept at the
//! applied snapshot's local transform and visibility.

use std::collections::HashMap;

use bevy::gltf::GltfExtras;
use bevy::prelude::*;

use super::AppliedAuthoring;
use super::ownership::{authored_unchanged, previous_of_same_document};
use crate::protocol::{AuthoredState, EXTRAS_OBJECT_ID, local_transform};

/// A glTF node exported from the editor object with this id.
#[derive(Component, Reflect, Clone, Debug, PartialEq, Eq)]
#[reflect(Component)]
pub struct AuthoredNode(pub String);

/// The editor id in a node's extras JSON, if it has one.
pub(crate) fn authored_id_from_extras(json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    let id = value.get(EXTRAS_OBJECT_ID)?.as_str()?;
    (!id.is_empty()).then(|| id.to_owned())
}

/// Tags newly spawned glTF nodes that carry an editor id.
pub(crate) fn tag_authored_nodes(
    mut commands: Commands,
    nodes: Query<(Entity, &GltfExtras), Added<GltfExtras>>,
) {
    for (entity, extras) in &nodes {
        if let Some(id) = authored_id_from_extras(&extras.value) {
            commands.entity(entity).insert(AuthoredNode(id));
        }
    }
}

/// The local transform and visibility a snapshot authors for each geometry node, by id.
fn node_targets(state: &AuthoredState) -> HashMap<&str, (Transform, bool)> {
    state
        .objects
        .iter()
        .map(|object| {
            (
                object.id.as_str(),
                (local_transform(object), object.visible),
            )
        })
        .collect()
}

/// Writes the applied snapshot's transforms onto tagged nodes: nodes that just appeared, and,
/// when the snapshot changed, nodes whose authored transform or visibility changed since the
/// previous snapshot. A node the snapshot left unchanged keeps what gameplay did to it.
pub(super) fn sync_node_transforms(
    applied: Res<AppliedAuthoring>,
    mut nodes: Query<(Ref<AuthoredNode>, &mut Transform, &mut Visibility)>,
) {
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    let is_snapshot_new = applied.is_changed();
    let targets = node_targets(state);
    let previous_targets = previous_of_same_document(&applied).map(node_targets);
    for (node, mut transform, mut visibility) in &mut nodes {
        let id = node.0.as_str();
        let Some(target) = targets.get(id) else {
            continue;
        };
        let is_authored_change =
            is_snapshot_new && !authored_unchanged(previous_targets.as_ref(), &id, target);
        if !node.is_added() && !is_authored_change {
            continue;
        }
        transform.set_if_neq(target.0);
        visibility.set_if_neq(if target.1 {
            Visibility::Inherited
        } else {
            Visibility::Hidden
        });
    }
}
