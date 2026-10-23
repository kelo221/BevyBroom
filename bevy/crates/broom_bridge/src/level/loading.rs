//! Loading geometry revisions and swapping them in when their instance is ready.

use bevy::asset::LoadState;
use bevy::gltf::{GltfAssetLabel, GltfLoaderSettings};
use bevy::prelude::*;
use bevy::world_serialization::{WorldAsset, WorldAssetRoot, WorldInstanceReady};

use super::files::{
    next_geometry_file_name, remove_level_package, remove_other_geometry_files, write_atomically,
};
use super::manifest::ManifestWriter;
use super::{GeometrySource, LevelGeometry, LoadingGeometry, ShownGeometry};
use crate::authoring::DocumentSwitched;
use crate::project::ProjectPaths;
use crate::status::BridgeStatus;

/// The root of one geometry revision's spawned glTF scene.
#[derive(Component, Clone, Debug, PartialEq, Eq)]
pub struct LevelGeometryRoot {
    pub geometry_revision: u64,
    pub file_name: String,
}

/// The handle of a revision's scene, kept on its root so its load state can be watched.
#[derive(Component)]
pub(super) struct GeometryHandle(Handle<WorldAsset>);

/// Drops the geometry of the previous document when another document is applied.
pub(super) fn forget_other_documents(
    mut commands: Commands,
    mut switched: MessageReader<DocumentSwitched>,
    mut level: ResMut<LevelGeometry>,
) {
    let Some(current) = switched.read().last().map(|switch| switch.current.clone()) else {
        return;
    };
    if let Some(shown) = level.shown.take_if(|shown| shown.document_id != current) {
        commands.entity(shown.root).despawn();
    }
    if let Some(loading) = level
        .loading
        .take_if(|loading| loading.job_document != current)
    {
        commands.entity(loading.root).despawn();
    }
    level.queued.take_if(|job| job.document_id != current);
}

/// Starts loading the queued revision when nothing else is loading.
pub(super) fn start_queued_geometry(
    mut commands: Commands,
    mut level: ResMut<LevelGeometry>,
    mut status: ResMut<BridgeStatus>,
    paths: Res<ProjectPaths>,
    assets: Res<AssetServer>,
) {
    if level.loading.is_some() {
        return;
    }
    let Some(job) = level.queued.take() else {
        return;
    };
    let directory = paths.level_directory_of(&job.level_name);
    let (stamp, file_name) = match job.source {
        GeometrySource::ExistingFile(name) => (level.last_stamp, name),
        GeometrySource::Bytes(bytes) => {
            let (stamp, name) = next_geometry_file_name(&directory, level.last_stamp);
            if let Err(error) = write_atomically(&directory.join(&name), &bytes) {
                status.report_error(format!("cannot write geometry {name}: {error}"));
                return;
            }
            (stamp, name)
        }
    };
    level.last_stamp = level.last_stamp.max(stamp);
    let path = paths.level_asset_path(&job.level_name, &file_name);
    let handle = load_scene(&assets, path);
    let root = spawn_hidden_root(&mut commands, handle, job.geometry_revision, &file_name);
    level.loading = Some(LoadingGeometry {
        job_document: job.document_id,
        level_name: job.level_name,
        geometry_revision: job.geometry_revision,
        file_name,
        root,
    });
}

/// Starts loading the first scene of the GLB at `path` without its glTF lights and cameras.
fn load_scene(assets: &AssetServer, path: String) -> Handle<WorldAsset> {
    assets
        .load_builder()
        .with_settings(|settings: &mut GltfLoaderSettings| {
            settings.load_lights = false;
            settings.load_cameras = false;
        })
        .load(GltfAssetLabel::Scene(0).from_asset(path))
}

/// Spawns the revision's root hidden; [`reveal_ready_geometry`] shows it once spawned.
fn spawn_hidden_root(
    commands: &mut Commands,
    handle: Handle<WorldAsset>,
    geometry_revision: u64,
    file_name: &str,
) -> Entity {
    commands
        .spawn((
            Name::new(format!("BevyBroom geometry {file_name}")),
            LevelGeometryRoot {
                geometry_revision,
                file_name: file_name.to_owned(),
            },
            GeometryHandle(handle.clone()),
            WorldAssetRoot(handle),
            Transform::default(),
            Visibility::Hidden,
        ))
        .observe(reveal_ready_geometry)
        .id()
}

/// Shows a revision once its scene has spawned, despawns the previous one and deletes files no
/// longer in use.
fn reveal_ready_geometry(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    mut level: ResMut<LevelGeometry>,
    mut writer: ResMut<ManifestWriter>,
    paths: Res<ProjectPaths>,
) {
    let is_loading_root = level
        .loading
        .as_ref()
        .is_some_and(|loading| loading.root == ready.entity);
    if !is_loading_root {
        return;
    }
    let Some(loading) = level.loading.take() else {
        return;
    };
    commands.entity(loading.root).insert(Visibility::Inherited);
    if let Some(previous) = level.shown.take() {
        commands.entity(previous.root).despawn();
        remove_renamed_level(&paths, &previous, &loading);
    }
    let directory = paths.level_directory_of(&loading.level_name);
    remove_other_geometry_files(&directory, &[loading.file_name.as_str()]);
    info!(
        "broom bridge: geometry revision {} shown from {}",
        loading.geometry_revision, loading.file_name
    );
    level.shown = Some(ShownGeometry {
        document_id: loading.job_document,
        level_name: loading.level_name,
        geometry_revision: loading.geometry_revision,
        file_name: loading.file_name,
        root: loading.root,
    });
    writer.mark_due();
}

/// Deletes the package of `previous` when `next` shows the same document under another level
/// name, so renaming a level leaves no old files behind.
fn remove_renamed_level(paths: &ProjectPaths, previous: &ShownGeometry, next: &LoadingGeometry) {
    let renamed =
        previous.document_id == next.job_document && previous.level_name != next.level_name;
    if renamed {
        let directory = paths.level_directory_of(&previous.level_name);
        remove_level_package(&directory, &previous.document_id);
    }
}

/// Abandons a revision whose file failed to load, keeping the shown geometry.
pub(super) fn watch_failed_loads(
    mut commands: Commands,
    mut level: ResMut<LevelGeometry>,
    mut status: ResMut<BridgeStatus>,
    roots: Query<&GeometryHandle>,
    assets: Res<AssetServer>,
    paths: Res<ProjectPaths>,
) {
    let Some(loading) = level.loading.as_ref() else {
        return;
    };
    let Ok(handle) = roots.get(loading.root) else {
        return;
    };
    let Some(LoadState::Failed(error)) = assets.get_load_state(handle.0.id()) else {
        return;
    };
    status.report_error(format!(
        "geometry revision {} ({}) failed to load, keeping the previous geometry: {error}",
        loading.geometry_revision, loading.file_name
    ));
    let file = paths
        .level_directory_of(&loading.level_name)
        .join(&loading.file_name);
    let _ = std::fs::remove_file(file);
    commands.entity(loading.root).despawn();
    let revision = loading.geometry_revision;
    level.loading = None;
    level.record_failed(revision);
}
