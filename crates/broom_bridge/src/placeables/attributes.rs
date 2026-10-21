//! Reflect custom attributes that tune how the editor shows a field of a placeable component:
//!
//! ```ignore
//! #[derive(Component, Reflect, Default)]
//! #[reflect(Component, Default)]
//! struct Door {
//!     #[reflect(@FieldRange::new(0.0, 10.0), @FieldStep(0.5))]
//!     speed: f32,
//!     #[reflect(@FieldLabel("Key name"))]
//!     key_name: String,
//!     #[reflect(@FieldHidden)]
//!     runtime_timer: f32,
//! }
//! ```

use bevy::prelude::*;

/// The smallest and largest value the editor offers for a number field.
#[derive(Reflect, Clone, Copy, Debug, PartialEq)]
pub struct FieldRange {
    pub minimum: f64,
    pub maximum: f64,
}

impl FieldRange {
    /// A range from `minimum` to `maximum`, both included.
    pub const fn new(minimum: f64, maximum: f64) -> Self {
        Self { minimum, maximum }
    }
}

/// The amount the editor's number field steps by.
#[derive(Reflect, Clone, Copy, Debug, PartialEq)]
pub struct FieldStep(pub f64);

/// The caption the editor shows instead of the field name.
#[derive(Reflect, Clone, Copy, Debug, PartialEq)]
pub struct FieldLabel(pub &'static str);

/// Keeps a field out of the editor; it always has its default value.
#[derive(Reflect, Clone, Copy, Debug, PartialEq)]
pub struct FieldHidden;
