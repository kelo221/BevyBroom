//! Reading and writing data asset files for the editor. Writes are queued by the remote method
//! and done by [`write_queued_data_assets`], which reloads the asset so the game sees the change.

use bevy::prelude::*;
use bevy::reflect::TypeRegistry;

use super::assets::{PlaceableAssetRegistration, PlaceableAssetTypes};
use super::compose::{ComposeContext, compose};
use super::data_assets::{data_asset_values_format, data_asset_values_parse};
use crate::level::files::write_atomically;
use crate::project::ProjectPaths;
use crate::protocol::{
    DataAssetReadReply, DataAssetWriteRequest, is_contained_path, validate_data_asset_values,
};
use crate::status::BridgeStatus;

/// Data asset writes waiting for the frame, and the generation the last one was given.
#[derive(Resource, Debug, Default)]
pub struct DataAssetWrites {
    queued: Vec<(u64, DataAssetWriteRequest)>,
    generation: u64,
}

impl DataAssetWrites {
    /// Queues `request` and returns the generation the status reaches once it is written.
    pub fn queue(&mut self, request: DataAssetWriteRequest) -> u64 {
        self.generation += 1;
        self.queued.push((self.generation, request));
        self.generation
    }
}

/// The editable data asset type whose extension `path` has, if `path` stays inside the asset
/// root.
pub(crate) fn data_asset_registration_of<'a>(
    assets: &'a PlaceableAssetTypes,
    path: &str,
) -> Result<&'a PlaceableAssetRegistration, String> {
    if !is_contained_path(path) {
        return Err(format!("{path:?} is not inside the asset root"));
    }
    assets
        .editable()
        .find(|registration| registration.matches_file_name(path))
        .ok_or_else(|| format!("{path} is not a data asset file of this game"))
}

/// The type and overrides stored in the data asset file at `path`.
pub(crate) fn data_asset_file_read(
    paths: &ProjectPaths,
    assets: &PlaceableAssetTypes,
    path: &str,
) -> Result<DataAssetReadReply, String> {
    let registration = data_asset_registration_of(assets, path)?;
    let text = std::fs::read_to_string(paths.asset_root.join(path))
        .map_err(|error| format!("{path}: {error}"))?;
    Ok(DataAssetReadReply {
        path: path.to_owned(),
        type_path: registration.asset_type_path.clone(),
        values: data_asset_values_parse(&text).map_err(|error| format!("{path}: {error}"))?,
    })
}

/// Checks that `request` names a data asset file of its type and that every value applies.
pub(crate) fn data_asset_write_check(
    registry: &TypeRegistry,
    assets: &PlaceableAssetTypes,
    request: &DataAssetWriteRequest,
) -> Result<(), String> {
    let registration = data_asset_registration_of(assets, &request.path)?;
    if registration.asset_type_path != request.type_path {
        return Err(format!(
            "{} holds {}, not {}",
            request.path, registration.asset_type_path, request.type_path
        ));
    }
    validate_data_asset_values(&request.values)?;
    let context = ComposeContext {
        registry,
        assets: &PlaceableAssetTypes::default(),
        asset_server: None,
    };
    let composed = compose(&context, &request.type_path, &request.values)?;
    match composed.errors.is_empty() {
        true => Ok(()),
        false => Err(composed.errors.join("; ")),
    }
}

/// Writes the queued data asset files, reloads them and advances the status generation.
pub(super) fn write_queued_data_assets(
    mut writes: ResMut<DataAssetWrites>,
    paths: Res<ProjectPaths>,
    server: Res<AssetServer>,
    mut status: ResMut<BridgeStatus>,
) {
    for (generation, request) in std::mem::take(&mut writes.queued) {
        if let Err(error) = data_asset_file_write(&paths, &request) {
            status.report_error(format!("data asset {}: {error}", request.path));
        } else {
            server.reload(request.path.clone());
        }
        status.data_asset_generation = generation;
    }
}

/// Replaces the file `request` names with its values.
fn data_asset_file_write(
    paths: &ProjectPaths,
    request: &DataAssetWriteRequest,
) -> Result<(), String> {
    let text = data_asset_values_format(&request.values)?;
    write_atomically(&paths.asset_root.join(&request.path), text.as_bytes())
        .map_err(|error| error.to_string())
}
