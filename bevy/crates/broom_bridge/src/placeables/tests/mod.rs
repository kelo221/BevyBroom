//! Tests of the placeables slice: class descriptions, composing components from overrides, and
//! attaching them to authored entities in a headless app.

mod compose;
mod data_assets;
mod extras;
mod manifest;
mod schema;
mod sync;

use bevy::prelude::*;

use super::{
    AppPlaceableAssetExt, AppPlaceableExt, FieldHidden, FieldLabel, FieldRange, FieldStep,
    PlaceableOptions, PlaceablesPlugin,
};
use crate::authoring::AuthoringPlugin;
use crate::status::BridgeStatus;

/// A unit-only enum field.
#[derive(Reflect, Clone, Copy, Debug, PartialEq, Default)]
pub(super) enum TestDoorKind {
    #[default]
    Wooden,
    Iron,
    Glass,
}

/// A nested struct field, shown as a group.
#[derive(Reflect, Clone, Debug, PartialEq)]
pub(super) struct TestHinge {
    pub angle: f32,
    pub squeaky: bool,
}

impl Default for TestHinge {
    fn default() -> Self {
        Self {
            angle: 90.0,
            squeaky: true,
        }
    }
}

/// A data asset a door field references.
#[derive(Asset, Reflect, Clone, Debug, Default)]
pub(super) struct TestDoorStats {
    pub health: f32,
}

/// A component covering every field kind, with defaults that differ from the types' zeros.
#[derive(Component, Reflect, Clone, Debug, PartialEq)]
#[reflect(Component, Default)]
pub(super) struct TestDoor {
    #[reflect(@FieldRange::new(0.0, 10.0), @FieldStep(0.5))]
    pub speed: f32,
    pub locked: bool,
    #[reflect(@FieldLabel("Key"))]
    pub key_name: String,
    pub uses: u8,
    pub kind: TestDoorKind,
    pub offset: Vec3,
    pub tint: Color,
    pub hinge: TestHinge,
    pub stats: Handle<TestDoorStats>,
    #[reflect(@FieldHidden)]
    pub secret: i32,
}

impl Default for TestDoor {
    fn default() -> Self {
        Self {
            speed: 2.5,
            locked: true,
            key_name: "brass".into(),
            uses: 3,
            kind: TestDoorKind::Iron,
            offset: Vec3::new(0.25, 1.0, -0.5),
            tint: Color::srgba(1.0, 0.5, 0.25, 1.0),
            hinge: TestHinge::default(),
            stats: Handle::default(),
            secret: 7,
        }
    }
}

/// A tuple struct component.
#[derive(Component, Reflect, Clone, Debug, PartialEq)]
#[reflect(Component, Default)]
pub(super) struct TestWeight(pub f32);

impl Default for TestWeight {
    fn default() -> Self {
        Self(12.0)
    }
}

/// The type path of a reflected type, as the editor names it.
pub(super) fn type_path_of<T: TypePath>() -> String {
    T::type_path().to_owned()
}

/// A headless app that applies authored state and places the test components, with a status
/// for errors.
pub(super) fn placeables_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, AuthoringPlugin, PlaceablesPlugin))
        .insert_resource(BridgeStatus::new("test"))
        .register_placeable::<TestDoor>(PlaceableOptions::point().category("Doors"))
        .register_placeable::<TestWeight>(PlaceableOptions::any())
        .register_placeable_asset::<TestDoorStats>(&["stats.ron"]);
    app
}
