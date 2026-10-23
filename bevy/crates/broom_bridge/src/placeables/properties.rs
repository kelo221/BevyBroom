//! Free-form properties any object can carry without a game-specific component, like
//! TrenchBroom's custom keys. Game code reads them from [`BroomProperties`].

use std::collections::BTreeMap;

use bevy::prelude::*;

/// One property value.
#[derive(Reflect, Clone, Debug, PartialEq)]
pub enum PropertyValue {
    Text(String),
    Number(f64),
    Bool(bool),
}

/// Named values placed on an object in the editor.
#[derive(Component, Reflect, Clone, Debug, Default, PartialEq)]
#[reflect(Component, Default)]
pub struct BroomProperties {
    pub values: BTreeMap<String, PropertyValue>,
}

impl BroomProperties {
    /// The text value named `name`.
    pub fn text(&self, name: &str) -> Option<&str> {
        match self.values.get(name)? {
            PropertyValue::Text(text) => Some(text),
            PropertyValue::Number(_) | PropertyValue::Bool(_) => None,
        }
    }

    /// The number value named `name`.
    pub fn number(&self, name: &str) -> Option<f64> {
        match self.values.get(name)? {
            PropertyValue::Number(number) => Some(*number),
            PropertyValue::Text(_) | PropertyValue::Bool(_) => None,
        }
    }

    /// The boolean value named `name`.
    pub fn flag(&self, name: &str) -> Option<bool> {
        match self.values.get(name)? {
            PropertyValue::Bool(flag) => Some(*flag),
            PropertyValue::Text(_) | PropertyValue::Number(_) => None,
        }
    }
}
