//! The smallest game the BevyBroom editor can drive: `DefaultPlugins` on the project's asset
//! root, the bridge, one placeable component and a camera.
//!
//! From `bevy/`: `cargo run -p broom_bridge --example minimal_game -- --project
//! broom.project.json`. With `--no-default-features` the game needs no DynLight: catalog
//! materials bind as `StandardMaterial` and authored lights, rooms and portals are not shown.

use std::path::PathBuf;

use bevy::asset::AssetMetaCheck;
use bevy::prelude::*;
use bevy::winit::WinitSettings;
use broom_bridge::prelude::*;

/// Where players appear, placed from the editor's Add > Game Entities menu.
#[derive(Component, Reflect, Clone, Debug, PartialEq)]
#[reflect(Component, Default)]
pub struct SpawnPoint {
    pub team: String,
    #[reflect(@FieldRange::new(0.0, 30.0), @FieldLabel("Respawn delay (s)"))]
    pub respawn_seconds: f32,
    pub enabled: bool,
}

impl Default for SpawnPoint {
    fn default() -> Self {
        Self {
            team: "red".into(),
            respawn_seconds: 5.0,
            enabled: true,
        }
    }
}

fn main() -> AppExit {
    let paths = match project_argument().and_then(|file| ProjectPaths::load(&file)) {
        Ok(paths) => paths,
        Err(error) => {
            eprintln!("minimal_game: {error}");
            return AppExit::error();
        }
    };
    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(AssetPlugin {
        file_path: paths.asset_root.to_string_lossy().into_owned(),
        meta_check: AssetMetaCheck::Never,
        ..default()
    }));
    #[cfg(feature = "dynlight")]
    app.add_plugins(dynlight::prelude::DynamicLightingPlugin);
    app.add_plugins(BroomBridgePlugin::new(paths))
        .register_placeable::<SpawnPoint>(PlaceableOptions::point().category("Players"))
        .insert_resource(WinitSettings::continuous())
        .add_systems(Startup, spawn_camera)
        .run()
}

/// The `--project FILE` argument, `broom.project.json` when it is not given.
fn project_argument() -> Result<PathBuf, String> {
    let mut project = PathBuf::from(PROJECT_FILE_NAME);
    let mut arguments = std::env::args().skip(1);
    while let Some(flag) = arguments.next() {
        match flag.as_str() {
            "--project" => {
                let value = arguments.next().ok_or("--project needs a value")?;
                project = PathBuf::from(value);
            }
            other => return Err(format!("unknown argument {other}")),
        }
    }
    Ok(project)
}

/// Spawns the camera, looking at the origin from above and behind.
fn spawn_camera(mut commands: Commands) {
    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(-6.0, 4.0, 8.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));
}
