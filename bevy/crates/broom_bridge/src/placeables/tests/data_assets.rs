//! Data asset files: their text format, the path and value checks of editor writes, and loading,
//! writing and reloading them in a headless app with an asset server.

use std::time::Duration;

use bevy::asset::AssetPlugin;
use bevy::prelude::*;
use serde_json::json;

use super::*;
use crate::placeables::data_asset_files::{data_asset_file_read, data_asset_write_check};
use crate::placeables::data_assets::data_asset_compose;
use crate::placeables::{
    AppDataAssetExt, DataAssetWrites, PlaceableAssetTypes, data_asset_values_format,
    data_asset_values_parse,
};
use crate::project::ProjectPaths;
use crate::protocol::{DataAssetValues, DataAssetWriteRequest};
use crate::test_support::{TemporaryDirectory, sample_project_paths};

/// The extension the test data asset uses.
const CRATE_EXTENSION: &str = "crate.ron";

/// The most frames a test waits for an asset to load or reload.
const MAX_FRAMES: usize = 2000;

/// A data asset with defaults that differ from the types' zeros.
#[derive(Asset, Reflect, Clone, Debug, PartialEq)]
pub(super) struct TestCrateStats {
    pub weight: f32,
    pub label: String,
    pub breakable: bool,
}

impl Default for TestCrateStats {
    fn default() -> Self {
        Self {
            weight: 20.0,
            label: "crate".into(),
            breakable: true,
        }
    }
}

/// Overrides from `pairs`.
fn values_of(pairs: &[(&str, serde_json::Value)]) -> DataAssetValues {
    pairs
        .iter()
        .map(|(path, value)| ((*path).to_owned(), value.clone()))
        .collect()
}

/// The placeables app with an asset server on a sample project in `directory` and the test
/// data asset registered.
fn data_asset_app(directory: &TemporaryDirectory) -> (App, ProjectPaths) {
    let paths = sample_project_paths(directory.path());
    std::fs::create_dir_all(&paths.asset_root).expect("the asset root can be created");
    let mut app = placeables_app();
    app.add_plugins(AssetPlugin {
        file_path: paths.asset_root.to_string_lossy().into_owned(),
        ..default()
    })
    .insert_resource(paths.clone())
    .register_data_asset::<TestCrateStats>(CRATE_EXTENSION);
    (app, paths)
}

/// A write request for the test data asset at `path`.
fn crate_write(path: &str, values: DataAssetValues) -> DataAssetWriteRequest {
    DataAssetWriteRequest {
        path: path.to_owned(),
        type_path: type_path_of::<TestCrateStats>(),
        values,
    }
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

/// The loaded value of `handle`, if loaded.
fn loaded(app: &App, handle: &Handle<TestCrateStats>) -> Option<TestCrateStats> {
    app.world()
        .resource::<Assets<TestCrateStats>>()
        .get(handle)
        .cloned()
}

/// Formatted overrides parse back unchanged, an empty file overrides nothing and malformed
/// text or unnamed fields are refused.
#[test]
fn data_asset_text_round_trips() {
    let values = values_of(&[
        ("weight", json!(42.5)),
        ("label", json!("heavy \"crate\"")),
        ("breakable", json!(false)),
        ("offset", json!([1.0, -2.0, 0.5])),
        ("nested.count", json!(3)),
    ]);
    let text = data_asset_values_format(&values).expect("the values format");
    assert_eq!(data_asset_values_parse(&text), Ok(values));
    assert_eq!(data_asset_values_parse("  \n"), Ok(DataAssetValues::new()));
    assert!(data_asset_values_parse("{ \"weight\": ").is_err());
    assert!(data_asset_values_parse("{ \"\": 1.0 }").is_err());
}

/// Composing keeps the defaults of fields the file does not list.
#[test]
fn data_assets_compose_from_defaults_and_overrides() {
    let directory = TemporaryDirectory::new("data_asset_compose");
    let (app, _paths) = data_asset_app(&directory);
    let registry = app.world().resource::<AppTypeRegistry>().read();
    let weight = TestCrateStats::default().weight * 3.0;
    let (stats, errors) = data_asset_compose::<TestCrateStats>(
        &registry,
        &values_of(&[("weight", json!(weight)), ("missing", json!(1))]),
    )
    .expect("the stats compose");
    assert_eq!(
        stats,
        TestCrateStats {
            weight,
            ..TestCrateStats::default()
        }
    );
    assert_eq!(errors.len(), 1, "the unknown field is reported: {errors:?}");
}

/// Writes are refused outside the asset root, for other extensions, for the wrong type and for
/// values that do not apply, and accepted otherwise.
#[test]
fn data_asset_writes_are_checked() {
    let directory = TemporaryDirectory::new("data_asset_checks");
    let (app, _paths) = data_asset_app(&directory);
    let registry = app.world().resource::<AppTypeRegistry>().read();
    let assets = app.world().resource::<PlaceableAssetTypes>();
    let good_path = format!("data/good.{CRATE_EXTENSION}");
    let check =
        |request: DataAssetWriteRequest| data_asset_write_check(&registry, assets, &request);
    assert!(
        check(crate_write(
            &good_path,
            values_of(&[("weight", json!(5.0))])
        ))
        .is_ok()
    );
    assert!(
        check(crate_write(
            &format!("../out.{CRATE_EXTENSION}"),
            DataAssetValues::new()
        ))
        .is_err()
    );
    assert!(check(crate_write("data/good.png", DataAssetValues::new())).is_err());
    assert!(
        check(crate_write(
            &good_path,
            values_of(&[("weight", json!("heavy"))])
        ))
        .is_err()
    );
    let mut wrong_type = crate_write(&good_path, DataAssetValues::new());
    wrong_type.type_path = type_path_of::<TestDoor>();
    assert!(check(wrong_type).is_err());
}

/// A file loads as the asset, an editor write replaces the file and advances the status
/// generation, and the loaded asset reloads with the new values.
#[test]
fn data_assets_load_write_and_reload() {
    let directory = TemporaryDirectory::new("data_asset_reload");
    let (mut app, paths) = data_asset_app(&directory);
    let path = format!("data/box.{CRATE_EXTENSION}");
    let first = values_of(&[("label", json!("first"))]);
    let file = paths.asset_root.join(&path);
    std::fs::create_dir_all(file.parent().expect("a parent")).expect("directory");
    std::fs::write(&file, data_asset_values_format(&first).expect("format")).expect("written");
    let handle: Handle<TestCrateStats> = app.world().resource::<AssetServer>().load(path.clone());
    update_until(&mut app, "the file loads", |app| {
        loaded(app, &handle).is_some()
    });
    assert_eq!(
        loaded(&app, &handle).map(|stats| stats.label),
        Some("first".into())
    );
    let second = values_of(&[("label", json!("second")), ("breakable", json!(false))]);
    let generation = app
        .world_mut()
        .resource_mut::<DataAssetWrites>()
        .queue(crate_write(&path, second.clone()));
    update_until(&mut app, "the write is done", |app| {
        app.world().resource::<BridgeStatus>().data_asset_generation >= generation
    });
    let read = data_asset_file_read(&paths, app.world().resource::<PlaceableAssetTypes>(), &path);
    assert_eq!(read.map(|reply| reply.values), Ok(second));
    update_until(&mut app, "the asset reloads", |app| {
        loaded(app, &handle).is_some_and(|stats| stats.label == "second" && !stats.breakable)
    });
}
