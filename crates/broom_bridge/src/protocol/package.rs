//! The generated level package: the geometry publication the editor sends and the manifest the
//! bridge writes next to the geometry so the game can load the level without the editor.

use serde::{Deserialize, Serialize};

use super::hello::{MIN_PROTOCOL_VERSION, protocol_supported};
use super::state::{AuthoredState, PROTOCOL_VERSION};

/// The manifest's file name inside a level directory.
pub const MANIFEST_FILE_NAME: &str = "level.broom.json";

/// A compiled geometry revision sent by the editor.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct GeometryPublication {
    pub protocol: u32,
    pub document_id: String,
    pub session_id: String,
    pub geometry_revision: u64,
    /// Names the level directory; see [`sanitize_level_name`].
    #[serde(default)]
    pub level_name: String,
    /// The binary glTF, base64 encoded.
    pub glb_base64: String,
}

impl GeometryPublication {
    /// Checks the fields that don't need decoding.
    pub fn validate(&self) -> Result<(), String> {
        if !protocol_supported(self.protocol) {
            return Err(format!(
                "protocol {} is not supported (expected {MIN_PROTOCOL_VERSION} to {PROTOCOL_VERSION})",
                self.protocol
            ));
        }
        if self.document_id.is_empty() || self.session_id.is_empty() {
            return Err("the publication needs a document_id and a session_id".into());
        }
        if self.glb_base64.is_empty() {
            return Err("the publication has no geometry".into());
        }
        Ok(())
    }
}

/// Everything needed to load a level: which geometry file, and the authored state that goes
/// with it (lights and transforms).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct LevelManifest {
    pub protocol: u32,
    pub level_name: String,
    /// The GLB file name inside the level directory.
    pub geometry_file: String,
    pub geometry_revision: u64,
    pub state: AuthoredState,
}

impl LevelManifest {
    /// Parses a manifest and checks its protocol and state.
    pub fn parse(json: &str) -> Result<Self, String> {
        let manifest: Self = serde_json::from_str(json).map_err(|error| error.to_string())?;
        if !protocol_supported(manifest.protocol) {
            return Err(format!(
                "manifest protocol {} is not supported",
                manifest.protocol
            ));
        }
        if manifest.geometry_file.contains(['/', '\\']) || manifest.geometry_file.is_empty() {
            return Err(format!(
                "geometry file {:?} must be a plain file name",
                manifest.geometry_file
            ));
        }
        manifest
            .state
            .validate()
            .map_err(|error| error.to_string())?;
        Ok(manifest)
    }
}

/// A file-system-safe level directory name: lowercase ASCII letters, digits, `_` and `-`, with
/// everything else turned into `_`. Empty names become `level`.
pub fn sanitize_level_name(name: &str) -> String {
    let cleaned: String = name
        .trim()
        .chars()
        .map(|character| match character {
            'a'..='z' | '0'..='9' | '_' | '-' => character,
            'A'..='Z' => character.to_ascii_lowercase(),
            _ => '_',
        })
        .take(64)
        .collect();
    if cleaned.chars().all(|character| character == '_') {
        "level".into()
    } else {
        cleaned
    }
}

/// The geometry file name for one publication. `stamp` must grow with every publication of the
/// level so a new file never overwrites the one being shown.
pub fn geometry_file_name(stamp: u64) -> String {
    format!("geometry_{stamp:016}.glb")
}

/// Whether `file_name` is a geometry file written by [`geometry_file_name`].
pub fn is_geometry_file_name(file_name: &str) -> bool {
    file_name
        .strip_prefix("geometry_")
        .and_then(|rest| rest.strip_suffix(".glb"))
        .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
}
