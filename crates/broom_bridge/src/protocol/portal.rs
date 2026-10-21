//! Room cells and portals as the editor authors them, and their DynLight equivalent.

use bevy::prelude::*;
use dynlight::portals::{Portal, Room};
use serde::{Deserialize, Serialize};

/// One authored room cell: a box of these half sizes, in local units, under the object's full
/// transform (scale included).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AuthoredRoom {
    pub half_size: [f32; 3],
}

/// One authored portal: a rectangle of this full width and height in the object's local XY
/// plane, its front along local +Z, linked to the rooms around it automatically.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AuthoredPortal {
    pub size: [f32; 2],
    /// A shut door: views do not pass through it.
    #[serde(default)]
    pub closed: bool,
}

/// Explains the first size that is not a finite number above zero.
fn validate_sizes(sizes: &[f32]) -> Result<(), String> {
    match sizes
        .iter()
        .find(|size| !(size.is_finite() && **size > 0.0))
    {
        Some(size) => Err(format!("size {size} must be a finite number above zero")),
        None => Ok(()),
    }
}

impl AuthoredRoom {
    /// Explains the first half size DynLight would treat as a flat or broken cell.
    pub fn validate(&self) -> Result<(), String> {
        validate_sizes(&self.half_size)
    }

    /// The DynLight component for this definition.
    pub fn to_room(&self) -> Room {
        Room {
            half_size: Vec3::from_array(self.half_size),
        }
    }
}

impl AuthoredPortal {
    /// Explains the first extent DynLight would treat as a flat or broken opening.
    pub fn validate(&self) -> Result<(), String> {
        validate_sizes(&self.size)
    }

    /// The DynLight component for this definition, linked automatically on both sides.
    pub fn to_portal(&self) -> Portal {
        Portal::new(Vec2::from_array(self.size))
    }
}
