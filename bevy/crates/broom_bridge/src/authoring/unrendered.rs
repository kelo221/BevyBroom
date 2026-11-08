//! A bridge built without the `dynlight` feature shows no lights, rooms or portals: authored
//! objects of those kinds are accepted with the snapshot but get no entities, and one debug line
//! per document says so.

use bevy::prelude::*;

use super::AppliedAuthoring;
use crate::protocol::{AuthoredObjectKind, AuthoredState};

/// How many objects of `state` are lights, rooms or portals, which only DynLight shows.
fn dynlight_object_count(state: &AuthoredState) -> usize {
    state
        .objects
        .iter()
        .filter(|object| {
            matches!(
                object.kind,
                AuthoredObjectKind::Light | AuthoredObjectKind::Room | AuthoredObjectKind::Portal
            )
        })
        .count()
}

/// Logs one debug line the first time an applied document has lights, rooms or portals that
/// this build leaves out. `logged_document` remembers the document that was logged.
pub(super) fn log_unrendered_objects(
    applied: Res<AppliedAuthoring>,
    mut logged_document: Local<Option<String>>,
) {
    if !applied.is_changed() {
        return;
    }
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    if logged_document.as_deref() == Some(state.document_id.as_str()) {
        return;
    }
    let count = dynlight_object_count(state);
    if count == 0 {
        return;
    }
    debug!(
        "broom bridge: built without the dynlight feature; {count} lights, rooms and portals of \
         document {} are not shown",
        state.document_id
    );
    *logged_document = Some(state.document_id.clone());
}

#[cfg(test)]
mod tests {
    use bevy::prelude::*;

    use super::dynlight_object_count;
    use crate::authoring::{AppliedAuthoring, AuthoredCellEntity, AuthoredLightEntity};
    use crate::protocol::RevisionVerdict;
    use crate::test_support::{authoring_app, sample_state, state_send};

    /// How many entities in `app` carry component `C`.
    fn entity_count_with<C: Component>(app: &mut App) -> usize {
        let mut query = app.world_mut().query_filtered::<(), With<C>>();
        query.iter(app.world()).count()
    }

    /// A snapshot with lights, rooms and portals is accepted and applied, and none of them
    /// becomes an entity.
    #[test]
    fn a_state_with_lights_is_applied_without_spawning_them() {
        let mut app = authoring_app();
        let state = sample_state();
        assert!(dynlight_object_count(&state) > 0);
        assert_eq!(
            state_send(&mut app, state.clone()),
            Ok(RevisionVerdict::NewSession)
        );
        app.update();
        let applied = app.world().resource::<AppliedAuthoring>();
        assert_eq!(applied.revision(), state.revision);
        assert_eq!(entity_count_with::<AuthoredLightEntity>(&mut app), 0);
        assert_eq!(entity_count_with::<AuthoredCellEntity>(&mut app), 0);
    }
}
