//! The component types a game lets the editor place, registered with
//! [`AppPlaceableExt::register_placeable`].

use std::collections::BTreeMap;

use bevy::prelude::*;
use bevy::reflect::{GetTypeRegistration, TypePath};

use crate::protocol::PlaceablePlacement;

/// The default sRGB color of editor markers.
const DEFAULT_MARKER_COLOR: Srgba = Srgba::rgb(0.35, 0.65, 0.95);

/// How the editor offers one placeable component.
#[derive(Clone, Debug, PartialEq)]
pub struct PlaceableOptions {
    /// Shown instead of the type's short name when set.
    pub label: Option<String>,
    /// Add menu category.
    pub category: String,
    pub placement: PlaceablePlacement,
    pub marker_color: Srgba,
}

impl PlaceableOptions {
    /// A component that can be attached to any object.
    pub fn any() -> Self {
        Self {
            label: None,
            category: "Game".into(),
            placement: PlaceablePlacement::Any,
            marker_color: DEFAULT_MARKER_COLOR,
        }
    }

    /// A component that only lives on game entities (empty points).
    pub fn point() -> Self {
        Self {
            placement: PlaceablePlacement::Point,
            ..Self::any()
        }
    }

    /// Uses `category` as the Add menu category.
    pub fn category(mut self, category: impl Into<String>) -> Self {
        self.category = category.into();
        self
    }

    /// Shows `label` instead of the type's short name.
    pub fn label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }

    /// Tints the editor marker of game entities carrying this component.
    pub fn marker_color(mut self, color: Srgba) -> Self {
        self.marker_color = color;
        self
    }
}

impl Default for PlaceableOptions {
    fn default() -> Self {
        Self::any()
    }
}

/// Every placeable component by type path.
#[derive(Resource, Clone, Debug, Default)]
pub struct PlaceableClasses {
    registrations: BTreeMap<String, PlaceableOptions>,
    generation: u64,
}

impl PlaceableClasses {
    /// Registers or replaces the options of the component at `type_path`.
    pub fn register(&mut self, type_path: impl Into<String>, options: PlaceableOptions) {
        self.registrations.insert(type_path.into(), options);
        self.generation += 1;
    }

    /// Whether the component at `type_path` may be placed.
    pub fn contains(&self, type_path: &str) -> bool {
        self.registrations.contains_key(type_path)
    }

    /// Every registration, sorted by type path.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &PlaceableOptions)> {
        self.registrations
            .iter()
            .map(|(type_path, options)| (type_path.as_str(), options))
    }

    /// How many components are registered.
    pub fn len(&self) -> usize {
        self.registrations.len()
    }

    /// Whether no component is registered.
    pub fn is_empty(&self) -> bool {
        self.registrations.is_empty()
    }

    /// Changes whenever a registration changes.
    pub fn generation(&self) -> u64 {
        self.generation
    }
}

/// Registers placeable components on an [`App`].
pub trait AppPlaceableExt {
    /// Lets the editor place `T`. The type is reflected and registered with its `Component`
    /// and `Default` data, so its fields and defaults reach the editor.
    fn register_placeable<T>(&mut self, options: PlaceableOptions) -> &mut Self
    where
        T: Component + Reflect + TypePath + Default + GetTypeRegistration;
}

impl AppPlaceableExt for App {
    fn register_placeable<T>(&mut self, options: PlaceableOptions) -> &mut Self
    where
        T: Component + Reflect + TypePath + Default + GetTypeRegistration,
    {
        self.register_type::<T>()
            .register_type_data::<T, ReflectComponent>()
            .register_type_data::<T, ReflectDefault>();
        self.world_mut()
            .get_resource_or_init::<PlaceableClasses>()
            .register(T::type_path(), options);
        self
    }
}
