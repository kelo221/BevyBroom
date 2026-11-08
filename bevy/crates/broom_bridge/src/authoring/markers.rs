//! The components that mark which editor document owns an authored light, room or portal
//! entity. Other slices find authored entities through them with or without DynLight.

use bevy::prelude::*;

/// A light owned by an editor document.
#[derive(Component, Clone, Debug, PartialEq, Eq)]
pub struct AuthoredLightEntity {
    pub id: String,
    pub document_id: String,
}

/// A room or portal owned by an editor document.
#[derive(Component, Clone, Debug, PartialEq, Eq)]
pub struct AuthoredCellEntity {
    pub id: String,
    pub document_id: String,
}
