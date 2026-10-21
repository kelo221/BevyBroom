//! Exported geometry nodes: tagged with their editor id when a level spawns, then kept at the
//! applied snapshot's local transform and visibility.

use std::collections::HashMap;

use bevy::gltf::GltfExtras;
use bevy::prelude::*;

use super::AppliedAuthoring;
use crate::protocol::{AuthoredObject, EXTRAS_OBJECT_ID, local_transform};

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

/// Writes the applied snapshot's transforms onto tagged nodes: all of them when the snapshot
/// changed, otherwise only nodes that just appeared.
pub(super) fn sync_node_transforms(
    applied: Res<AppliedAuthoring>,
    mut nodes: Query<(Ref<AuthoredNode>, &mut Transform, &mut Visibility)>,
) {
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    let everything = applied.is_changed();
    let by_id: HashMap<&str, &AuthoredObject> = state
        .objects
        .iter()
        .map(|object| (object.id.as_str(), object))
        .collect();
    for (node, mut transform, mut visibility) in &mut nodes {
        if !everything && !node.is_added() {
            continue;
        }
        let Some(object) = by_id.get(node.0.as_str()) else {
            continue;
        };
        transform.set_if_neq(local_transform(object));
        visibility.set_if_neq(if object.visible {
            Visibility::Inherited
        } else {
            Visibility::Hidden
        });
    }
}
