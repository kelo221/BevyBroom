//! Geometry pipeline tests: revision gating of publications, and loading, failing and swapping
//! revisions in a headless app with an asset server on a temporary project.

use std::path::Path;
use std::time::Duration;

use bevy::asset::{AssetApp, AssetPlugin};
use bevy::prelude::*;
use bevy::world_serialization::{WorldAsset, WorldInstanceReady, WorldInstanceSpawner};

use super::files::{remove_level_package, write_manifest};
use super::{GeometrySource, LevelGeometry, LevelGeometryRoot, LevelPlugin, ShownGeometry};
use crate::project::ProjectPaths;
use crate::protocol::{
    AuthoredState, LevelManifest, MANIFEST_FILE_NAME, PROTOCOL_VERSION, RevisionVerdict,
    geometry_file_name, is_geometry_file_name, sanitize_level_name,
};
use crate::status::BridgeStatus;
use crate::test_support::{
    TEST_LEVEL_NAME, TemporaryDirectory, authoring_app, glb_bytes, glb_publication,
    publication_of_bytes, sample_project_paths, sample_state, state_send,
};

/// The most frames a test waits for an asset load to settle.
const MAX_FRAMES: usize = 2000;

/// A headless app with the authoring and level plugins and an asset server rooted at the asset
/// root of a sample project inside `directory`. No glTF loader is registered, so every geometry
/// load fails.
fn level_app(directory: &TemporaryDirectory) -> (App, ProjectPaths) {
    let paths = sample_project_paths(directory.path());
    std::fs::create_dir_all(&paths.asset_root).expect("the asset root can be created");
    let mut app = authoring_app();
    app.add_plugins(AssetPlugin {
        file_path: paths.asset_root.to_string_lossy().into_owned(),
        ..default()
    })
    .init_asset::<WorldAsset>()
    .insert_resource(paths.clone())
    .insert_resource(BridgeStatus::new(&paths.project_id))
    .add_plugins(LevelPlugin);
    (app, paths)
}

/// The directory the test publications' level is written to.
fn test_level_directory(paths: &ProjectPaths) -> std::path::PathBuf {
    paths.level_directory_of(&sanitize_level_name(TEST_LEVEL_NAME))
}

/// The geometry file names in `directory`, sorted.
fn geometry_files(directory: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(directory)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
                .filter(|name| is_geometry_file_name(name))
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}

/// Hands a GLB publication of `state`'s document to the app and runs one frame.
fn publish(app: &mut App, state: &AuthoredState, geometry_revision: u64) -> RevisionVerdict {
    let payload = format!("revision {geometry_revision}");
    let publication = glb_publication(state, geometry_revision, payload.as_bytes());
    let verdict = app
        .world_mut()
        .resource_mut::<LevelGeometry>()
        .receive(publication)
        .expect("the publication is valid");
    app.update();
    verdict
}

/// The spawned geometry roots, as (entity, root) pairs.
fn geometry_roots(app: &mut App) -> Vec<(Entity, LevelGeometryRoot)> {
    let mut query = app.world_mut().query::<(Entity, &LevelGeometryRoot)>();
    query
        .iter(app.world())
        .map(|(entity, root)| (entity, root.clone()))
        .collect()
}

/// The root entity spawned for `geometry_revision`.
fn root_of_revision(app: &mut App, geometry_revision: u64) -> Entity {
    geometry_roots(app)
        .into_iter()
        .find(|(_, root)| root.geometry_revision == geometry_revision)
        .map(|(entity, _)| entity)
        .expect("the revision's root is spawned")
}

/// Announces that `root`'s world instance has spawned, as the scene spawner does, then runs one
/// frame.
fn instance_ready(app: &mut App, root: Entity) {
    let instance_id = WorldInstanceSpawner::default().spawn(Handle::<WorldAsset>::default());
    app.world_mut().trigger(WorldInstanceReady {
        entity: root,
        instance_id,
    });
    app.update();
}

/// Runs frames until `done` holds, failing the test after [`MAX_FRAMES`].
fn update_until(app: &mut App, what: &str, done: impl Fn(&App) -> bool) {
    for _ in 0..MAX_FRAMES {
        if done(app) {
            return;
        }
        app.update();
        std::thread::sleep(Duration::from_millis(2));
    }
    panic!("timed out waiting until {what}");
}

/// Stale revisions, resends and publications that aren't GLB files are refused without changing
/// the queued revision or the accepted revision, so a newer GLB still gets in afterwards.
#[test]
fn stale_and_non_glb_publications_leave_the_queue_untouched() {
    let state = sample_state();
    let mut level = LevelGeometry::default();
    let accepted = state.geometry_revision + 1;
    let first = level.receive(glb_publication(&state, accepted, b"accepted"));
    assert_eq!(first, Ok(RevisionVerdict::NewSession));
    let queued = level.queued_for_test().cloned();
    let stale = level.receive(glb_publication(&state, accepted - 1, b"stale"));
    assert_eq!(stale, Ok(RevisionVerdict::Stale));
    let repeat = level.receive(glb_publication(&state, accepted, b"repeat"));
    assert_eq!(repeat, Ok(RevisionVerdict::Repeat));
    let not_glb = publication_of_bytes(&state, accepted + 1, b"PK\x03\x04 not a glb");
    assert!(level.receive(not_glb).is_err());
    assert_eq!(level.queued_for_test().cloned(), queued);
    assert_eq!(level.received_revision(), accepted);
    let newer = level.receive(glb_publication(&state, accepted + 1, b"newer"));
    assert_eq!(newer, Ok(RevisionVerdict::Newer));
}

/// A newer publication replaces the one still waiting to load, bytes and all.
#[test]
fn newer_publication_replaces_the_queued_one() {
    let state = sample_state();
    let mut level = LevelGeometry::default();
    let older = state.geometry_revision + 1;
    let newer = older + 1;
    level
        .receive(glb_publication(&state, older, b"older"))
        .expect("valid");
    level
        .receive(glb_publication(&state, newer, b"newer"))
        .expect("valid");
    let queued = level.queued_for_test().expect("a revision is queued");
    assert_eq!(queued.geometry_revision, newer);
    assert_eq!(queued.document_id, state.document_id);
    assert_eq!(queued.level_name, sanitize_level_name(TEST_LEVEL_NAME));
    assert_eq!(queued.source, GeometrySource::Bytes(glb_bytes(b"newer")));
    assert!(level.busy());
}

/// A revision whose file fails to load is abandoned: its root and file are removed, an error is
/// reported, and the previously shown geometry stays shown with its file.
#[test]
fn failed_revision_is_abandoned_and_the_shown_geometry_stays() {
    let directory = TemporaryDirectory::new("failed_load");
    let (mut app, paths) = level_app(&directory);
    let state = sample_state();
    let level_directory = test_level_directory(&paths);
    let previous_revision = state.geometry_revision;
    let previous_file = geometry_file_name(previous_revision);
    std::fs::create_dir_all(&level_directory).expect("the level directory can be created");
    std::fs::write(level_directory.join(&previous_file), glb_bytes(b"shown")).expect("written");
    let previous_root = app
        .world_mut()
        .spawn((
            LevelGeometryRoot {
                geometry_revision: previous_revision,
                file_name: previous_file.clone(),
            },
            Visibility::Inherited,
        ))
        .id();
    let shown = ShownGeometry {
        document_id: state.document_id.clone(),
        level_name: sanitize_level_name(TEST_LEVEL_NAME),
        geometry_revision: previous_revision,
        file_name: previous_file.clone(),
        root: previous_root,
    };
    let mut level = app.world_mut().resource_mut::<LevelGeometry>();
    level.set_shown_for_test(shown.clone());
    assert_eq!(
        publish(&mut app, &state, previous_revision + 1),
        RevisionVerdict::NewSession
    );
    assert_eq!(geometry_files(&level_directory).len(), 2);
    update_until(&mut app, "the failed load is abandoned", |app| {
        !app.world().resource::<LevelGeometry>().busy()
    });
    assert_eq!(
        app.world().resource::<LevelGeometry>().shown(),
        Some(&shown)
    );
    let roots = geometry_roots(&mut app);
    assert_eq!(roots.len(), 1);
    assert_eq!(roots[0].0, previous_root);
    let visibility = app.world().get::<Visibility>(previous_root);
    assert_eq!(visibility, Some(&Visibility::Inherited));
    assert_eq!(geometry_files(&level_directory), vec![previous_file]);
    let errors = &app.world().resource::<BridgeStatus>().errors;
    let failed_revision = format!("geometry revision {}", previous_revision + 1);
    assert_eq!(errors.len(), 1);
    assert!(errors[0].message.contains(&failed_revision));
    let level = app.world().resource::<LevelGeometry>();
    assert_eq!(level.failed_revision(), previous_revision + 1);
    assert_eq!(level.received_revision(), previous_revision);
    assert_eq!(
        publish(&mut app, &state, previous_revision + 1),
        RevisionVerdict::Newer
    );
}

/// Once a loading revision's instance is ready it becomes visible and shown; the next ready
/// revision then replaces it, despawning the previous root and deleting its geometry file.
#[test]
fn ready_instance_swaps_in_and_removes_the_previous_geometry() {
    let directory = TemporaryDirectory::new("swap");
    let (mut app, paths) = level_app(&directory);
    let state = sample_state();
    let level_directory = test_level_directory(&paths);
    let first_revision = state.geometry_revision + 1;
    publish(&mut app, &state, first_revision);
    let first_root = root_of_revision(&mut app, first_revision);
    assert_eq!(
        app.world().get::<Visibility>(first_root),
        Some(&Visibility::Hidden)
    );
    instance_ready(&mut app, first_root);
    let first_shown = app.world().resource::<LevelGeometry>().shown().cloned();
    let first_shown = first_shown.expect("the first revision is shown");
    assert_eq!(first_shown.root, first_root);
    assert_eq!(
        geometry_files(&level_directory),
        vec![first_shown.file_name]
    );

    let second_revision = first_revision + 1;
    publish(&mut app, &state, second_revision);
    let second_root = root_of_revision(&mut app, second_revision);
    assert_eq!(geometry_files(&level_directory).len(), 2);
    instance_ready(&mut app, second_root);
    for _ in 0..3 {
        app.update();
    }
    let level = app.world().resource::<LevelGeometry>();
    let shown = level
        .shown()
        .cloned()
        .expect("the second revision is shown");
    assert!(!level.busy());
    assert_eq!(shown.root, second_root);
    assert_eq!(shown.geometry_revision, second_revision);
    assert!(app.world().get_entity(first_root).is_err());
    assert_eq!(
        app.world().get::<Visibility>(second_root),
        Some(&Visibility::Inherited)
    );
    assert_eq!(geometry_files(&level_directory), vec![shown.file_name]);
}

/// Applying another document's state drops the geometry shown and queued for the previous one.
#[test]
fn switching_documents_drops_the_other_documents_geometry() {
    let directory = TemporaryDirectory::new("switch");
    let (mut app, _paths) = level_app(&directory);
    let state = sample_state();
    let previous = AuthoredState {
        document_id: format!("{} previous", state.document_id),
        ..state.clone()
    };
    let previous_root = app.world_mut().spawn(Visibility::Inherited).id();
    let mut level = app.world_mut().resource_mut::<LevelGeometry>();
    level.set_shown_for_test(ShownGeometry {
        document_id: previous.document_id.clone(),
        level_name: sanitize_level_name(TEST_LEVEL_NAME),
        geometry_revision: previous.geometry_revision,
        file_name: geometry_file_name(previous.geometry_revision),
        root: previous_root,
    });
    let publication = glb_publication(&previous, previous.geometry_revision + 1, b"queued");
    level.receive(publication).expect("valid");
    state_send(&mut app, state).expect("the sample state is valid");
    let level = app.world().resource::<LevelGeometry>();
    assert!(level.shown().is_none());
    assert!(!level.busy());
    assert!(app.world().get_entity(previous_root).is_err());
    assert!(geometry_roots(&mut app).is_empty());
}

/// A manifest of `state` naming `geometry_file` in level `level_name`.
fn manifest_of(state: &AuthoredState, level_name: &str, geometry_file: &str) -> LevelManifest {
    LevelManifest {
        protocol: PROTOCOL_VERSION,
        level_name: level_name.to_owned(),
        geometry_file: geometry_file.to_owned(),
        geometry_revision: state.geometry_revision,
        state: state.clone(),
    }
}

/// Publishes revision `geometry_revision` of `state` under `level_name` and lets it be shown.
fn publish_and_show(app: &mut App, state: &AuthoredState, level_name: &str, revision: u64) {
    let mut publication = glb_publication(state, revision, b"renamed");
    publication.level_name = level_name.to_owned();
    let mut level = app.world_mut().resource_mut::<LevelGeometry>();
    level
        .receive(publication)
        .expect("the publication is valid");
    app.update();
    let root = root_of_revision(app, revision);
    instance_ready(app, root);
}

/// Showing the same document under a new level name deletes the old level's geometry files and
/// manifest, while a file the bridge did not write keeps the old directory in place.
#[test]
fn renaming_a_level_removes_the_old_level_files() {
    let directory = TemporaryDirectory::new("rename");
    let (mut app, paths) = level_app(&directory);
    let state = sample_state();
    let old_directory = test_level_directory(&paths);
    let first = state.geometry_revision + 1;
    publish_and_show(&mut app, &state, TEST_LEVEL_NAME, first);
    let shown = app.world().resource::<LevelGeometry>().shown().cloned();
    let shown = shown.expect("the first revision is shown");
    let manifest = manifest_of(&state, &shown.level_name, &shown.file_name);
    write_manifest(&old_directory, &manifest).expect("the manifest is written");
    std::fs::write(old_directory.join("notes.txt"), b"mine").expect("written");
    let new_name = format!("{TEST_LEVEL_NAME} Renamed");
    publish_and_show(&mut app, &state, &new_name, first + 1);
    assert!(geometry_files(&old_directory).is_empty());
    assert!(!old_directory.join(MANIFEST_FILE_NAME).exists());
    assert!(old_directory.join("notes.txt").exists());
    let new_directory = paths.level_directory_of(&sanitize_level_name(&new_name));
    assert_eq!(geometry_files(&new_directory).len(), 1);
}

/// A level package whose manifest belongs to another document is left alone, and an empty
/// package directory of this document is removed entirely.
#[test]
fn level_packages_are_only_removed_for_their_own_document() {
    let directory = TemporaryDirectory::new("package_removal");
    let state = sample_state();
    let package = directory.path().join("level");
    std::fs::create_dir_all(&package).expect("created");
    let geometry = geometry_file_name(1);
    std::fs::write(package.join(&geometry), glb_bytes(b"kept")).expect("written");
    write_manifest(&package, &manifest_of(&state, "level", &geometry)).expect("written");
    remove_level_package(&package, &format!("{} other", state.document_id));
    assert_eq!(geometry_files(&package), vec![geometry]);
    remove_level_package(&package, &state.document_id);
    assert!(!package.exists());
}
