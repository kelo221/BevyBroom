//! World transforms and effective visibility of authored objects, computed from the authored
//! hierarchy alone so they don't depend on which runtime entities exist.

use std::collections::HashMap;

use bevy::prelude::*;

use super::state::{AuthoredObject, AuthoredState};

/// Deeper chains are treated as broken (a parent cycle or corrupt data).
const MAX_DEPTH: usize = 256;

/// An object's local transform as a Bevy `Transform`.
pub fn local_transform(object: &AuthoredObject) -> Transform {
    let rotation = Quat::from_array(object.rotation);
    Transform {
        translation: Vec3::from_array(object.translation),
        rotation: if rotation.length_squared() > 0.0 {
            rotation.normalize()
        } else {
            Quat::IDENTITY
        },
        scale: Vec3::from_array(object.scale),
    }
}

/// Object lookups by id over one snapshot.
pub struct AuthoredHierarchy<'a> {
    by_id: HashMap<&'a str, &'a AuthoredObject>,
}

impl<'a> AuthoredHierarchy<'a> {
    /// Indexes every object of `state`.
    pub fn new(state: &'a AuthoredState) -> Self {
        Self {
            by_id: state
                .objects
                .iter()
                .map(|object| (object.id.as_str(), object))
                .collect(),
        }
    }

    /// The chain from `id` up to its root, `id` first. `None` when `id` is unknown or the chain
    /// loops. A parent id that isn't in the snapshot ends the chain there.
    fn chain(&self, id: &str) -> Option<Vec<&'a AuthoredObject>> {
        let mut chain = Vec::new();
        let mut current = *self.by_id.get(id)?;
        loop {
            chain.push(current);
            if chain.len() > MAX_DEPTH {
                return None;
            }
            let Some(parent) = current.parent_id.as_deref() else {
                return Some(chain);
            };
            match self.by_id.get(parent) {
                Some(next) => current = next,
                None => return Some(chain),
            }
        }
    }

    /// The world transform of `id`: its local transform under all of its ancestors'.
    pub fn world_transform(&self, id: &str) -> Option<Transform> {
        let chain = self.chain(id)?;
        let world = chain
            .iter()
            .rev()
            .fold(Transform::IDENTITY, |parent, object| {
                parent.mul_transform(local_transform(object))
            });
        Some(world)
    }

    /// Whether `id` and every ancestor is visible.
    pub fn effectively_visible(&self, id: &str) -> bool {
        self.chain(id)
            .is_some_and(|chain| chain.iter().all(|object| object.visible))
    }
}
