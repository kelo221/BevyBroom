//! The `broom.*` methods. Each validates its parameters and queues work; nothing here moves
//! entities, so changes apply in the frame's normal schedule.

use bevy::prelude::*;
use bevy::remote::{BrpError, BrpResult, error_codes};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use crate::authoring::AuthoringInbox;
use crate::bake_link::BakeLink;
use crate::level::{LevelGeometry, LevelLoadRequest};
use crate::materials::CatalogState;
use crate::placeables::{
    DataAssetWrites, PlaceableAssetTypes, PlaceableClasses, class_list, data_asset_file_read,
    data_asset_write_check,
};
use crate::project::ProjectPaths;
use crate::protocol::{
    AuthoredState, DataAssetReadRequest, DataAssetWriteReply, DataAssetWriteRequest,
    GeometryPublication, RevisionVerdict, is_contained_path,
};
use crate::status::BridgeStatus;

use super::AdvertisedProtocol;

/// The largest file `broom.read_asset` returns.
const MAX_ASSET_BYTES: u64 = 64 * 1024 * 1024;

/// An invalid-parameters error with `message`.
fn invalid(message: impl Into<String>) -> BrpError {
    BrpError {
        code: error_codes::INVALID_PARAMS,
        message: message.into(),
        data: None,
    }
}

/// Deserializes the request parameters into `T`.
fn parse<T: DeserializeOwned>(params: Option<Value>) -> Result<T, BrpError> {
    let params = params.ok_or_else(|| invalid("parameters are required"))?;
    serde_json::from_value(params).map_err(|error| invalid(error.to_string()))
}

/// The reply for a revision verdict.
fn verdict_reply(verdict: RevisionVerdict, revision: u64) -> Value {
    json!({
        "accepted": verdict.accepts(),
        "verdict": format!("{verdict:?}").to_lowercase(),
        "revision": revision,
    })
}

/// `broom.apply_state`: queues an authored snapshot.
pub fn apply_state(In(params): In<Option<Value>>, mut inbox: ResMut<AuthoringInbox>) -> BrpResult {
    let state: AuthoredState = parse(params)?;
    let revision = state.revision;
    let verdict = inbox
        .receive(state)
        .map_err(|rejection| invalid(rejection.to_string()))?;
    Ok(verdict_reply(verdict, revision))
}

/// `broom.publish_geometry`: queues a geometry revision.
pub fn publish_geometry(
    In(params): In<Option<Value>>,
    mut level: ResMut<LevelGeometry>,
    mut status: ResMut<BridgeStatus>,
) -> BrpResult {
    let publication: GeometryPublication = parse(params)?;
    let revision = publication.geometry_revision;
    let verdict = level.receive(publication).map_err(|error| {
        status.report_error(format!("geometry revision {revision} rejected: {error}"));
        invalid(error)
    })?;
    Ok(verdict_reply(verdict, revision))
}

/// `broom.hello`: the protocol range, capabilities, project and process of this bridge.
pub fn hello(
    In(_): In<Option<Value>>,
    advertised: Res<AdvertisedProtocol>,
    status: Res<BridgeStatus>,
) -> BrpResult {
    let reply = advertised.0.hello(
        status.bridge_version,
        &status.project_id,
        &status.instance_id,
    );
    serde_json::to_value(reply).map_err(|error| invalid(error.to_string()))
}

/// `broom.status`: the bridge status.
pub fn status(In(_): In<Option<Value>>, status: Res<BridgeStatus>) -> BrpResult {
    serde_json::to_value(&*status).map_err(|error| invalid(error.to_string()))
}

/// `broom.catalog`: the material catalog as loaded, with its error if the file is broken.
pub fn catalog(In(_): In<Option<Value>>, catalog: Res<CatalogState>) -> BrpResult {
    Ok(json!({
        "catalog": catalog.catalog,
        "error": catalog.error,
        "generation": catalog.generation,
        "texture_generation": catalog.texture_generation,
    }))
}

#[derive(Deserialize)]
struct ReadAssetParams {
    path: String,
}

/// `broom.read_asset`: a file under the asset root, base64 encoded, for editor previews.
pub fn read_asset(In(params): In<Option<Value>>, paths: Res<ProjectPaths>) -> BrpResult {
    use base64::Engine as _;
    let ReadAssetParams { path } = parse(params)?;
    if !is_contained_path(&path) {
        return Err(invalid(format!("{path:?} is not inside the asset root")));
    }
    let file = paths.asset_root.join(&path);
    let size = std::fs::metadata(&file)
        .map_err(|error| invalid(format!("{path}: {error}")))?
        .len();
    if size > MAX_ASSET_BYTES {
        return Err(invalid(format!(
            "{path} is larger than {MAX_ASSET_BYTES} bytes"
        )));
    }
    let bytes = std::fs::read(&file).map_err(|error| invalid(format!("{path}: {error}")))?;
    Ok(json!({
        "path": path,
        "base64": base64::engine::general_purpose::STANDARD.encode(bytes),
    }))
}

/// `broom.bake_preview`: asks for a shadow-only preview bake.
pub fn bake_preview(In(_): In<Option<Value>>, mut link: ResMut<BakeLink>) -> BrpResult {
    link.request();
    Ok(json!({ "requested": true }))
}

#[derive(Deserialize)]
struct LoadLevelParams {
    level_name: String,
}

/// `broom.load_level`: loads a level from its manifest, as the game would.
pub fn load_level(
    In(params): In<Option<Value>>,
    mut requests: MessageWriter<LevelLoadRequest>,
) -> BrpResult {
    let LoadLevelParams { level_name } = parse(params)?;
    requests.write(LevelLoadRequest { level_name });
    Ok(json!({ "requested": true }))
}

/// `broom.placeable_classes`: every component type the editor may place, with its fields and
/// defaults, and the asset types its fields may reference.
pub fn placeable_classes(
    In(_): In<Option<Value>>,
    registry: Res<AppTypeRegistry>,
    classes: Res<PlaceableClasses>,
    assets: Res<PlaceableAssetTypes>,
    paths: Res<ProjectPaths>,
) -> BrpResult {
    let list = class_list(&registry.read(), &classes, &assets, &paths.asset_root);
    serde_json::to_value(list).map_err(|error| invalid(error.to_string()))
}

/// `broom.data_asset_read`: the type and overrides of a data asset file.
pub fn data_asset_read(
    In(params): In<Option<Value>>,
    assets: Res<PlaceableAssetTypes>,
    paths: Res<ProjectPaths>,
) -> BrpResult {
    let DataAssetReadRequest { path } = parse(params)?;
    let reply = data_asset_file_read(&paths, &assets, &path).map_err(invalid)?;
    serde_json::to_value(reply).map_err(|error| invalid(error.to_string()))
}

/// `broom.data_asset_write`: queues replacing a data asset file with new overrides.
pub fn data_asset_write(
    In(params): In<Option<Value>>,
    registry: Res<AppTypeRegistry>,
    assets: Res<PlaceableAssetTypes>,
    mut writes: ResMut<DataAssetWrites>,
) -> BrpResult {
    let request: DataAssetWriteRequest = parse(params)?;
    data_asset_write_check(&registry.read(), &assets, &request).map_err(invalid)?;
    let path = request.path.clone();
    let generation = writes.queue(request);
    serde_json::to_value(DataAssetWriteReply { path, generation })
        .map_err(|error| invalid(error.to_string()))
}
