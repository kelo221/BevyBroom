//! Level package files on disk: immutable geometry files and the manifest, written so a reader
//! never sees a half-written file.

use std::io::Write;
use std::path::Path;

use crate::protocol::{
    LevelManifest, MANIFEST_FILE_NAME, geometry_file_name, is_geometry_file_name,
};

/// Writes `bytes` to `path` through a temporary sibling file and a rename, which replaces an
/// existing file in one step on Windows and Unix.
pub fn write_atomically(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(".tmp");
    let temporary = std::path::PathBuf::from(temporary);
    {
        let mut file = std::fs::File::create(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&temporary, path)
}

/// The stamps of the geometry files already in `directory`.
fn existing_stamps(directory: &Path) -> Vec<u64> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter(|name| is_geometry_file_name(name))
        .filter_map(|name| {
            name["geometry_".len()..name.len() - ".glb".len()]
                .parse()
                .ok()
        })
        .collect()
}

/// A geometry file name in `directory` newer than every existing one and than `previous`.
pub fn next_geometry_file_name(directory: &Path, previous: u64) -> (u64, String) {
    let newest = existing_stamps(directory).into_iter().max().unwrap_or(0);
    let stamp = newest.max(previous) + 1;
    (stamp, geometry_file_name(stamp))
}

/// Deletes the geometry files in `directory` other than `keep`. Failures are returned by name
/// so they can be reported; a file still open elsewhere is simply kept until next time.
pub fn remove_other_geometry_files(directory: &Path, keep: &[&str]) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };
    let mut failures = Vec::new();
    for entry in entries.flatten() {
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        if !is_geometry_file_name(&name) || keep.contains(&name.as_str()) {
            continue;
        }
        if std::fs::remove_file(entry.path()).is_err() {
            failures.push(name);
        }
    }
    failures
}

/// Deletes the bridge's files of the level package in `directory` (its geometry files and its
/// manifest) and then the directory when nothing else is left in it. Nothing is deleted when the
/// manifest names another document, so a package of another document is never touched.
pub fn remove_level_package(directory: &Path, document_id: &str) {
    let owned_by_other_document =
        read_manifest(directory).is_ok_and(|manifest| manifest.state.document_id != document_id);
    if owned_by_other_document {
        return;
    }
    remove_other_geometry_files(directory, &[]);
    let _ = std::fs::remove_file(directory.join(MANIFEST_FILE_NAME));
    let _ = std::fs::remove_dir(directory);
}

/// Writes the manifest of the level in `directory`.
pub fn write_manifest(directory: &Path, manifest: &LevelManifest) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    write_atomically(&directory.join(MANIFEST_FILE_NAME), &json)
        .map_err(|error| format!("cannot write the level manifest: {error}"))
}

/// Reads the manifest of the level in `directory`.
pub fn read_manifest(directory: &Path) -> Result<LevelManifest, String> {
    let path = directory.join(MANIFEST_FILE_NAME);
    let json = std::fs::read_to_string(&path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    LevelManifest::parse(&json)
}
