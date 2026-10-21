//! The game project file (`broom.project.json`) shared by the editor and the game: where the
//! assets, the material catalog and the generated levels live, and how to launch the preview.

use std::path::{Path, PathBuf};

use bevy::prelude::*;
use serde::{Deserialize, Serialize};

use crate::protocol::is_contained_path;

#[cfg(test)]
mod tests;

/// The project file's conventional name at the game's root.
pub const PROJECT_FILE_NAME: &str = "broom.project.json";
/// The project format version.
pub const PROJECT_VERSION: u32 = 1;

/// How the editor launches the native preview.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct PreviewLaunch {
    /// The program to run, e.g. `cargo` or a built executable.
    pub program: String,
    #[serde(default)]
    pub arguments: Vec<String>,
    /// Relative to the project root.
    #[serde(default = "current_directory")]
    pub working_directory: String,
    /// The bridge's HTTP endpoint.
    #[serde(default = "default_endpoint")]
    pub endpoint: String,
}

/// Serde default for [`PreviewLaunch::working_directory`].
fn current_directory() -> String {
    ".".into()
}

/// Serde default for [`PreviewLaunch::endpoint`].
fn default_endpoint() -> String {
    format!("http://127.0.0.1:{}", crate::remote::DEFAULT_PORT)
}

/// The project file.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ProjectConfig {
    pub project_version: u32,
    pub project_id: String,
    #[serde(default)]
    pub name: String,
    /// Relative to the project root.
    pub asset_root: String,
    /// Relative to the asset root.
    pub material_catalog: String,
    /// Relative to the asset root.
    pub level_directory: String,
    /// Relative to the project root: where the editor keeps its source documents.
    #[serde(default = "default_document_directory")]
    pub document_directory: String,
    #[serde(default)]
    pub preview: PreviewLaunch,
    /// The editor's coordinate profile; `bevy_meters` is Y up, right-handed, 1 unit = 1 m.
    #[serde(default = "default_coordinate_profile")]
    pub coordinate_profile: String,
}

/// Serde default for [`ProjectConfig::document_directory`].
fn default_document_directory() -> String {
    "broom/documents".into()
}

/// Serde default for [`ProjectConfig::coordinate_profile`].
fn default_coordinate_profile() -> String {
    "bevy_meters".into()
}

impl ProjectConfig {
    /// Parses a project file and checks that every path stays inside the project.
    pub fn parse(json: &str) -> Result<Self, String> {
        let config: Self = serde_json::from_str(json).map_err(|error| error.to_string())?;
        if config.project_version != PROJECT_VERSION {
            return Err(format!(
                "project version {} is not supported (expected {PROJECT_VERSION})",
                config.project_version
            ));
        }
        if config.project_id.trim().is_empty() {
            return Err("the project has no project_id".into());
        }
        let paths = [
            ("asset_root", &config.asset_root),
            ("material_catalog", &config.material_catalog),
            ("level_directory", &config.level_directory),
            ("document_directory", &config.document_directory),
        ];
        for (field, path) in paths {
            if path != "." && !is_contained_path(path) {
                return Err(format!(
                    "{field} {path:?} must be a relative path inside the project"
                ));
            }
        }
        Ok(config)
    }
}

/// Resolved project locations. Asset paths use `/` and are relative to the asset root, the way
/// Bevy's `AssetServer` wants them.
#[derive(Resource, Clone, Debug, PartialEq)]
pub struct ProjectPaths {
    pub project_id: String,
    pub project_root: PathBuf,
    pub asset_root: PathBuf,
    pub catalog_file: PathBuf,
    pub level_directory: PathBuf,
    /// The level directory as an asset path.
    pub level_asset_directory: String,
}

impl ProjectPaths {
    /// Resolves `config` against the directory holding the project file.
    pub fn resolve(config: &ProjectConfig, project_root: &Path) -> Self {
        let asset_root = project_root.join(&config.asset_root);
        Self {
            project_id: config.project_id.clone(),
            project_root: project_root.to_path_buf(),
            catalog_file: asset_root.join(&config.material_catalog),
            level_directory: asset_root.join(&config.level_directory),
            level_asset_directory: config.level_directory.replace('\\', "/"),
            asset_root,
        }
    }

    /// Reads and resolves the project file at `file`. Paths come out absolute, since Bevy
    /// resolves relative asset roots against the executable's directory.
    pub fn load(file: &Path) -> Result<Self, String> {
        let file = std::path::absolute(file)
            .map_err(|error| format!("cannot resolve {}: {error}", file.display()))?;
        let json = std::fs::read_to_string(&file)
            .map_err(|error| format!("cannot read {}: {error}", file.display()))?;
        let config = ProjectConfig::parse(&json)?;
        let root = file.parent().unwrap_or(Path::new("."));
        Ok(Self::resolve(&config, root))
    }

    /// The directory of the level named `level_name` (already sanitized).
    pub fn level_directory_of(&self, level_name: &str) -> PathBuf {
        self.level_directory.join(level_name)
    }

    /// The asset path of `file_name` in the level named `level_name`.
    pub fn level_asset_path(&self, level_name: &str, file_name: &str) -> String {
        format!("{}/{level_name}/{file_name}", self.level_asset_directory)
    }
}
