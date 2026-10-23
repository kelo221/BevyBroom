//! Data assets: files under the asset root that hold one reflected value, like a Unity
//! ScriptableObject. A file stores only the fields that differ from the type's `Default`, as
//! field path → normalized value, the same form component overrides use.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The fields a data asset file overrides: field path → normalized value.
pub type DataAssetValues = BTreeMap<String, Value>;

/// The `broom.data_asset_read` parameters.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DataAssetReadRequest {
    /// The asset path of the file, relative to the asset root.
    pub path: String,
}

/// The `broom.data_asset_read` reply.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DataAssetReadReply {
    pub path: String,
    /// The asset type the file's extension belongs to.
    pub type_path: String,
    pub values: DataAssetValues,
}

/// The `broom.data_asset_write` parameters: replaces the file at `path` with `values`, creating
/// it when it does not exist.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DataAssetWriteRequest {
    pub path: String,
    pub type_path: String,
    #[serde(default)]
    pub values: DataAssetValues,
}

/// The `broom.data_asset_write` reply: the write is queued, and the status's
/// `data_asset_generation` reaches `generation` once the file is written and reloading.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DataAssetWriteReply {
    pub path: String,
    pub generation: u64,
}

/// Checks that every field path is named.
pub fn validate_data_asset_values(values: &DataAssetValues) -> Result<(), String> {
    if values.keys().any(|path| path.trim().is_empty()) {
        return Err("a data asset field has an empty path".into());
    }
    Ok(())
}
