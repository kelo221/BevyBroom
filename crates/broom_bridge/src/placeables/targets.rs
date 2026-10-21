//! Which entity shows which authored object, for attaching placeable components.

use bevy::ecs::query::QueryData;
use bevy::prelude::*;

use super::points::AuthoredGameEntity;
use super::sync::PlacedComponents;
use crate::authoring::{AuthoredCellEntity, AuthoredLightEntity, AuthoredNode};

/// Every entity that shows an authored object, with what was placed on it so far.
#[derive(QueryData)]
pub(crate) struct AuthoredTarget {
    pub entity: Entity,
    pub owner: AnyOf<(
        &'static AuthoredNode,
        &'static AuthoredLightEntity,
        &'static AuthoredCellEntity,
        &'static AuthoredGameEntity,
    )>,
    pub placed: Option<&'static PlacedComponents>,
}

impl AuthoredTargetItem<'_, '_> {
    /// The id of the authored object the entity shows.
    pub(crate) fn authored_id(&self) -> &str {
        match self.owner {
            (Some(node), _, _, _) => &node.0,
            (_, Some(light), _, _) => &light.id,
            (_, _, Some(cell), _) => &cell.id,
            (_, _, _, Some(point)) => &point.id,
            (None, None, None, None) => "",
        }
    }
}
