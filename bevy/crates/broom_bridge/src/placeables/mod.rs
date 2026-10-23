//! Placeable components: reflected game components the editor attaches to any authored object
//! or to an empty game entity, with the game's own defaults and the editor's field overrides.
//!
//! - [`AppPlaceableExt::register_placeable`] lets the editor place a component type.
//! - [`AppPlaceableAssetExt::register_placeable_asset`] lets `Handle` fields reference files.
//! - The `broom.placeable_classes` method describes every registered type to the editor.
//! - The applied snapshot's components are composed from the type's `Default` plus the
//!   overrides and inserted on the entity showing each object, again after geometry swaps.
//! - [`AppDataAssetExt::register_data_asset`] makes a type a data asset the editor edits.
//! - [`BroomGltfComponentsPlugin`] does the same for the `broom_components` node extras of a
//!   GLB exported by the editor, without the bridge.

mod assets;
mod attributes;
mod compose;
pub(crate) mod data_asset_files;
pub(crate) mod data_assets;
mod extras;
mod points;
mod properties;
mod registry;
mod schema;
mod sync;
mod targets;
#[cfg(test)]
mod tests;
mod value_read;
mod value_shape;
mod value_write;

use bevy::app::SpawnScene;
use bevy::prelude::*;

use crate::authoring::{BroomSystems, tag_authored_nodes};
use crate::project::ProjectPaths;
use crate::status::BridgeStatus;

pub use assets::{AppPlaceableAssetExt, PlaceableAssetRegistration, PlaceableAssetTypes};
pub use attributes::{FieldHidden, FieldLabel, FieldRange, FieldStep};
pub use data_asset_files::DataAssetWrites;
pub use data_assets::{
    AppDataAssetExt, DataAssetLoader, data_asset_values_format, data_asset_values_parse,
};
pub use extras::BroomGltfComponentsPlugin;
pub use points::AuthoredGameEntity;
pub use properties::{BroomProperties, PropertyValue};
pub use registry::{AppPlaceableExt, PlaceableClasses, PlaceableOptions};
pub use sync::PlacedComponents;

pub(crate) use data_asset_files::{data_asset_file_read, data_asset_write_check};
pub(crate) use schema::class_list;

pub struct PlaceablesPlugin;

impl Plugin for PlaceablesPlugin {
    fn build(&self, app: &mut App) {
        placeable_basics_init(app);
        app.register_type::<AuthoredGameEntity>()
            .init_resource::<DataAssetWrites>()
            .add_systems(
                Update,
                (points::sync_game_entities, sync::sync_placed_components)
                    .chain()
                    .in_set(BroomSystems::Components),
            )
            .add_systems(
                SpawnScene,
                sync::sync_placed_components.after(tag_authored_nodes),
            )
            .add_systems(
                Update,
                sync::refresh_placeable_status
                    .after(BroomSystems::Geometry)
                    .run_if(resource_exists::<BridgeStatus>),
            )
            .add_systems(
                Update,
                data_asset_files::write_queued_data_assets
                    .run_if(resource_exists::<BridgeStatus>)
                    .run_if(resource_exists::<ProjectPaths>)
                    .run_if(resource_exists::<AssetServer>),
            );
    }
}

/// The resources and built-in placeables every placeable plugin needs. Safe to run twice.
fn placeable_basics_init(app: &mut App) {
    app.init_resource::<PlaceableClasses>()
        .init_resource::<PlaceableAssetTypes>();
    let has_properties = app
        .world()
        .resource::<PlaceableClasses>()
        .contains(BroomProperties::type_path());
    if !has_properties {
        app.register_placeable::<BroomProperties>(
            PlaceableOptions::any().category("Data").label("Properties"),
        );
    }
    let has_images = app
        .world()
        .resource::<PlaceableAssetTypes>()
        .by_asset_type_path(Image::type_path())
        .is_some();
    if !has_images {
        app.register_placeable_asset::<Image>(IMAGE_EXTENSIONS);
    }
}

/// The image files offered for `Handle<Image>` fields and light cookies unless the game
/// registers `Image` itself.
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg"];
