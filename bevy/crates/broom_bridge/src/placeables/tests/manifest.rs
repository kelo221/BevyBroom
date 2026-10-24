//! A level loaded from its manifest, without the editor, places the components the editor
//! authored.

use std::time::Duration;

use bevy::asset::{AssetApp, AssetPlugin};
use bevy::prelude::*;
use bevy::world_serialization::WorldAsset;
use serde_json::json;

use super::*;
use crate::level::files::write_manifest;
use crate::level::{LevelLoadRequest, LevelPlugin};
use crate::placeables::AuthoredGameEntity;
use crate::protocol::{AuthoredObjectKind, LevelManifest, sanitize_level_name};
use crate::test_support::{TemporaryDirectory, object_mut, sample_project_paths, sample_state};

/// The most frames the test waits for the manifest's state to apply.
const MAX_FRAMES: usize = 500;

/// The level name the manifest is written under.
const LEVEL_NAME: &str = "Manifest Components";

/// The placeables app with an asset server and the level plugin on a sample project inside
/// `directory`.
fn manifest_app(directory: &TemporaryDirectory) -> (App, crate::project::ProjectPaths) {
    let paths = sample_project_paths(directory.path());
    std::fs::create_dir_all(&paths.asset_root).expect("the asset root can be created");
    let mut app = placeables_app();
    app.add_plugins(AssetPlugin {
        file_path: paths.asset_root.to_string_lossy().into_owned(),
        ..default()
    })
    .init_asset::<WorldAsset>()
    .insert_resource(paths.clone())
    .add_plugins(LevelPlugin);
    (app, paths)
}

/// The test door on the game entity with `id`, once it is placed.
fn placed_door(app: &mut App, id: &str) -> Option<TestDoor> {
    let mut query = app
        .world_mut()
        .query::<(&AuthoredGameEntity, Option<&TestDoor>)>();
    query
        .iter(app.world())
        .find(|(owner, _)| owner.id == id)
        .and_then(|(_, door)| door.cloned())
}

/// Loading a manifest whose game entity carries a door override spawns the entity with the
/// composed door.
#[test]
fn manifest_loads_restore_placed_components() {
    let directory = TemporaryDirectory::new("manifest_components");
    let (mut app, paths) = manifest_app(&directory);
    let mut state = sample_state();
    let id = state
        .objects
        .iter()
        .find(|object| object.kind == AuthoredObjectKind::GameEntity)
        .map(|object| object.id.clone())
        .expect("the sample has a game entity");
    let uses = TestDoor::default().uses + 2;
    object_mut(&mut state, &id).components = [(
        type_path_of::<TestDoor>(),
        [("uses".to_owned(), json!(uses))].into(),
    )]
    .into();
    let geometry_revision = state.geometry_revision;
    let manifest = LevelManifest::new(
        LEVEL_NAME.to_owned(),
        "level_1.glb".to_owned(),
        geometry_revision,
        state,
    );
    let level_name = sanitize_level_name(LEVEL_NAME);
    write_manifest(&paths.level_directory_of(&level_name), &manifest).expect("written");
    app.world_mut()
        .write_message(LevelLoadRequest { level_name });
    for _ in 0..MAX_FRAMES {
        if placed_door(&mut app, &id).is_some() {
            break;
        }
        app.update();
        std::thread::sleep(Duration::from_millis(2));
    }
    let door = placed_door(&mut app, &id).expect("the door is placed from the manifest");
    assert_eq!(
        door,
        TestDoor {
            uses,
            ..TestDoor::default()
        }
    );
}
