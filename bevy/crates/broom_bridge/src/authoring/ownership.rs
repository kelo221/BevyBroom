//! What the editor owns and what the game owns.
//!
//! The editor owns the authored value of every field it sends: a light's settings and world
//! transform, a room or portal's shape, transform and closed state, and a geometry node's local
//! transform and visibility. Everything else on those entities, and every change gameplay makes
//! to them, belongs to the game. The bridge writes an authored value only when it differs from
//! the value the previous snapshot of the same document authored, so a snapshot that leaves an
//! object unchanged never resets what gameplay did to it (a door opened by a script, a platform
//! moved by a system). A new game process, a new document or a new object gets every value.

use std::collections::HashMap;
use std::hash::Hash;

use super::AppliedAuthoring;
use crate::protocol::AuthoredState;

/// The snapshot applied before the current one, when both belong to the same document.
pub(crate) fn previous_of_same_document(applied: &AppliedAuthoring) -> Option<&AuthoredState> {
    let previous = applied.previous.as_ref()?;
    let current = applied.state.as_ref()?;
    (previous.document_id == current.document_id).then_some(previous)
}

/// Whether the previous snapshot authored exactly `target` for `id`, so the current snapshot
/// changes nothing the editor owns there.
pub(crate) fn authored_unchanged<Key, Target>(
    previous: Option<&HashMap<Key, Target>>,
    id: &Key,
    target: &Target,
) -> bool
where
    Key: Eq + Hash,
    Target: PartialEq,
{
    previous
        .and_then(|targets| targets.get(id))
        .is_some_and(|previous_target| previous_target == target)
}
