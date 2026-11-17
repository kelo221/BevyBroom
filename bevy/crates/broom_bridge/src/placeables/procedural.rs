//! Procedural objects: props whose mesh the editor generates from a few parameters, such as a
//! box from two corners or an escalator from its two ends. The mesh arrives as ordinary level
//! geometry; [`BroomProceduralProp`] on the object's node carries the parameters, so game code
//! can add behaviour (a moving belt, a lift) without generating anything.

use bevy::prelude::*;
use serde::de::DeserializeOwned;

/// The generator and parameters of a procedural object, as the editor wrote them.
#[derive(Component, Reflect, Clone, Debug, Default, PartialEq)]
#[reflect(Component, Default)]
pub struct BroomProceduralProp {
    /// Generator that built the mesh, such as `box`.
    pub generator: String,
    /// Version of the generator's parameter layout.
    pub version: u32,
    /// The parameters as a JSON object: field path to value, points as `[x, y, z]` in the
    /// node's local meters.
    pub parameters: String,
    /// Values the editor derived from the parameters, as a JSON object, so the game does not
    /// work them out again.
    pub derived: String,
}

impl BroomProceduralProp {
    /// The parameters read into a game type, or `None` when they do not fit it.
    pub fn parameters_as<T: DeserializeOwned>(&self) -> Option<T> {
        serde_json::from_str(&self.parameters).ok()
    }

    /// The derived values read into a game type, or `None` when they do not fit it.
    pub fn derived_as<T: DeserializeOwned>(&self) -> Option<T> {
        serde_json::from_str(&self.derived).ok()
    }

    /// The point parameter named `name`, in the node's local space.
    pub fn parameter_point(&self, name: &str) -> Option<Vec3> {
        let parameters: serde_json::Map<String, serde_json::Value> = self.parameters_as()?;
        let [x, y, z]: [f32; 3] = serde_json::from_value(parameters.get(name)?.clone()).ok()?;
        Some(Vec3::new(x, y, z))
    }
}
