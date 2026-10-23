//! A conservative fingerprint of everything that changes a bake: the geometry file, every
//! object's transform and visibility, and every baked light except its live-only values. Rooms
//! and portals only cull realtime work, so they never change a bake.

use std::hash::{Hash, Hasher};

use crate::protocol::{AuthoredLight, AuthoredObjectKind, AuthoredState};

/// Hashes `value`'s bits so `-0.0` and `0.0` differ, which is conservative.
fn hash_floats(hasher: &mut impl Hasher, values: &[f32]) {
    for value in values {
        value.to_bits().hash(hasher);
    }
}

/// Hashes the parts of `light` a bake depends on, through its serialized
/// [`AuthoredLight::bake_relevant`] form. Realtime lights are never baked, so only that flag
/// counts for them.
fn hash_light(hasher: &mut impl Hasher, light: &AuthoredLight) {
    light.realtime.hash(hasher);
    light.enabled.hash(hasher);
    if light.realtime || !light.enabled {
        return;
    }
    serde_json::to_string(&light.bake_relevant())
        .unwrap_or_default()
        .hash(hasher);
}

/// The bake fingerprint of `state` shown with the geometry in `geometry_file`.
pub fn bake_fingerprint(state: &AuthoredState, geometry_file: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    geometry_file.hash(&mut hasher);
    state.document_id.hash(&mut hasher);
    let mut objects: Vec<_> = state
        .objects
        .iter()
        .filter(|object| {
            !matches!(
                object.kind,
                AuthoredObjectKind::Room | AuthoredObjectKind::Portal
            )
        })
        .collect();
    objects.sort_by(|a, b| a.id.cmp(&b.id));
    for object in objects {
        object.id.hash(&mut hasher);
        object.parent_id.hash(&mut hasher);
        object.visible.hash(&mut hasher);
        let realtime_light = object
            .light
            .as_ref()
            .is_some_and(|light| light.realtime || !light.enabled);
        if !realtime_light {
            hash_floats(&mut hasher, &object.translation);
            hash_floats(&mut hasher, &object.rotation);
            hash_floats(&mut hasher, &object.scale);
        }
        if let Some(light) = &object.light {
            hash_light(&mut hasher, light);
        }
    }
    hasher.finish()
}
