//! Watching the catalog file and its textures, and rebuilding materials in place.

use std::path::Path;

use bevy::asset::RenderAssetUsages;
use bevy::ecs::system::SystemParam;
use bevy::image::{CompressedImageFormats, ImageType};
use bevy::prelude::*;
use dynlight::surface::DynLitMaterial;

use super::build::CatalogResolvers;
use super::{CatalogState, FileStamp, WatchedTexture};
use crate::project::ProjectPaths;
use crate::protocol::{CatalogMaterial, MaterialCatalog};
use crate::status::BridgeStatus;

/// Seconds between two looks at the files.
const POLL_SECONDS: f32 = 0.5;

/// Paces [`poll_catalog_files`].
#[derive(Resource)]
pub(super) struct CatalogPollTimer(Timer);

impl Default for CatalogPollTimer {
    fn default() -> Self {
        let mut timer = Timer::from_seconds(POLL_SECONDS, TimerMode::Repeating);
        timer.set_elapsed(timer.duration());
        Self(timer)
    }
}

/// The modification time and size of `path`, `None` when it can't be read.
fn file_stamp(path: &Path) -> Option<FileStamp> {
    let meta = std::fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

/// The asset stores catalog reloads write into.
#[derive(SystemParam)]
pub(super) struct CatalogAssets<'w> {
    assets: Res<'w, AssetServer>,
    materials: ResMut<'w, Assets<DynLitMaterial>>,
    images: ResMut<'w, Assets<Image>>,
}

/// Reloads the catalog when its file changed and replaces textures whose files changed.
pub(super) fn poll_catalog_files(
    time: Res<Time<Real>>,
    mut timer: ResMut<CatalogPollTimer>,
    mut state: ResMut<CatalogState>,
    paths: Res<ProjectPaths>,
    resolvers: Res<CatalogResolvers>,
    mut stores: CatalogAssets,
    mut status: ResMut<BridgeStatus>,
) {
    if !timer.0.tick(time.delta()).just_finished() {
        return;
    }
    let catalog_stamp = file_stamp(&paths.catalog_file);
    if catalog_stamp != state.catalog_stamp {
        state.catalog_stamp = catalog_stamp;
        let CatalogAssets {
            assets, materials, ..
        } = &mut stores;
        reload_catalog(&mut state, &paths, &resolvers, assets, materials);
        status.catalog_material_count = state.catalog.materials.len();
        status.catalog_error.clone_from(&state.error);
        if let Some(error) = &state.error {
            status.report_error(format!("material catalog: {error}"));
        }
    }
    let CatalogAssets { assets, images, .. } = &mut stores;
    reload_changed_textures(&mut state, &paths, assets, images, &mut status);
}

/// Parses the catalog file; on success rebuilds every material in place and replaces the
/// catalog, on failure keeps the previous catalog and records why.
fn reload_catalog(
    state: &mut CatalogState,
    paths: &ProjectPaths,
    resolvers: &CatalogResolvers,
    assets: &AssetServer,
    materials: &mut Assets<DynLitMaterial>,
) {
    let parsed = std::fs::read_to_string(&paths.catalog_file)
        .map_err(|error| format!("cannot read {}: {error}", paths.catalog_file.display()))
        .and_then(|json| MaterialCatalog::parse(&json));
    let catalog = match parsed {
        Ok(catalog) => catalog,
        Err(error) => {
            state.error = Some(error);
            return;
        }
    };
    let mut errors = Vec::new();
    for entry in &catalog.materials {
        match resolvers.build(entry, assets) {
            Ok(material) => store_material(state, entry, material, materials),
            Err(error) => errors.push(error),
        }
    }
    state.error = (!errors.is_empty()).then(|| errors.join("; "));
    watch_textures(state, &catalog, paths);
    state.catalog = catalog;
    state.generation += 1;
    info!(
        "broom bridge: material catalog loaded, {} materials",
        state.catalog.materials.len()
    );
}

/// Writes `material` into the id's existing asset, or adds one for a new id.
fn store_material(
    state: &mut CatalogState,
    entry: &CatalogMaterial,
    material: DynLitMaterial,
    materials: &mut Assets<DynLitMaterial>,
) {
    if entry.normal_texture.is_some() {
        state.needs_tangents.insert(entry.id.clone());
    } else {
        state.needs_tangents.remove(&entry.id);
    }
    match state.handles.get(&entry.id) {
        Some(handle) => {
            let _ = materials.insert(handle.id(), material);
        }
        None => {
            let handle = materials.add(material);
            state.handles.insert(entry.id.clone(), handle);
        }
    }
}

/// Starts watching every texture of `catalog`, remembering whether each is sRGB.
fn watch_textures(state: &mut CatalogState, catalog: &MaterialCatalog, paths: &ProjectPaths) {
    let mut watched = std::collections::HashMap::new();
    for entry in &catalog.materials {
        let colors = [&entry.base_color_texture, &entry.emissive_texture];
        let data = [&entry.normal_texture, &entry.metallic_roughness_texture];
        let flagged = colors
            .into_iter()
            .map(|path| (path, true))
            .chain(data.into_iter().map(|path| (path, false)));
        for (path, srgb) in flagged {
            let Some(path) = path.as_deref() else {
                continue;
            };
            let stamp = file_stamp(&paths.asset_root.join(path));
            watched.insert(path.replace('\\', "/"), WatchedTexture { srgb, stamp });
        }
    }
    state.textures = watched;
}

/// Decodes textures whose files changed straight into their existing image assets, keeping the
/// sRGB flag and the repeating sampler the catalog loads them with.
fn reload_changed_textures(
    state: &mut CatalogState,
    paths: &ProjectPaths,
    assets: &AssetServer,
    images: &mut Assets<Image>,
    status: &mut BridgeStatus,
) {
    let mut reloaded = 0;
    for (path, texture) in &mut state.textures {
        let file = paths.asset_root.join(path);
        let now = file_stamp(&file);
        if now == texture.stamp || now.is_none() {
            continue;
        }
        texture.stamp = now;
        let Some(handle) = assets.get_handle::<Image>(path.clone()) else {
            continue;
        };
        match decode_texture(&file, texture.srgb) {
            Ok(image) => {
                let _ = images.insert(handle.id(), image);
                reloaded += 1;
                info!("broom bridge: texture {path} reloaded");
            }
            Err(error) => status.report_error(format!("texture {path}: {error}")),
        }
    }
    if reloaded > 0 {
        state.texture_generation += 1;
    }
}

/// Reads and decodes the image file at `file`.
fn decode_texture(file: &Path, srgb: bool) -> Result<Image, String> {
    let bytes = std::fs::read(file).map_err(|error| error.to_string())?;
    let extension = file
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("png");
    Image::from_buffer(
        &bytes,
        ImageType::Extension(extension),
        CompressedImageFormats::NONE,
        srgb,
        super::build::repeating_sampler(),
        RenderAssetUsages::default(),
    )
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::file_stamp;
    use crate::test_support::TemporaryDirectory;

    #[test]
    fn a_file_replaced_with_its_modification_time_kept_counts_as_changed() {
        let directory = TemporaryDirectory::new("file_stamp");
        let file = directory.path().join("castle_wall_base.png");
        std::fs::write(&file, b"original texture bytes").unwrap();
        let before = file_stamp(&file).expect("the file has a stamp");

        std::fs::write(&file, b"replacement").unwrap();
        std::fs::File::options()
            .write(true)
            .open(&file)
            .unwrap()
            .set_modified(before.0)
            .unwrap();

        let after = file_stamp(&file).expect("the file has a stamp");
        assert_eq!(after.0, before.0);
        assert_ne!(after, before);
    }

    #[test]
    fn a_missing_file_has_no_stamp() {
        let directory = TemporaryDirectory::new("file_stamp_missing");
        assert_eq!(file_stamp(&directory.path().join("missing.png")), None);
    }
}
