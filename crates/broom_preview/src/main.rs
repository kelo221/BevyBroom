//! The native preview: the sample game's rendering setup (DynLight with fixed shader features)
//! plus the BevyBroom bridge, a free camera and continuous updates so it keeps drawing while the
//! editor has focus. A real game adds `BroomBridgePlugin` to its own app the same way.
//!
//! `cargo run -p broom_preview -- --project broom.project.json`; see `arguments.rs` for the
//! other flags. `--scene` loads a GLB exported by the editor without the bridge's level files,
//! and [`BroomGltfComponentsPlugin`] places the components stored in its node extras.

mod arguments;
mod placeables;
mod scene;

use bevy::asset::AssetMetaCheck;
use bevy::camera_controller::free_camera::FreeCameraPlugin;
use bevy::prelude::*;
use bevy::winit::WinitSettings;
use broom_bridge::level::LevelLoadRequest;
use broom_bridge::placeables::BroomGltfComponentsPlugin;
use broom_bridge::project::ProjectPaths;
use broom_bridge::{BroomBridgePlugin, bake_link::BakeLink};
use dynlight::prelude::*;

use arguments::PreviewArguments;
use scene::Arguments;

fn main() -> AppExit {
    let arguments = match PreviewArguments::parse(std::env::args().skip(1)) {
        Ok(arguments) => arguments,
        Err(error) => {
            eprintln!("broom_preview: {error}");
            return AppExit::error();
        }
    };
    let paths = match ProjectPaths::load(&arguments.project) {
        Ok(paths) => paths,
        Err(error) => {
            eprintln!("broom_preview: {error}");
            return AppExit::error();
        }
    };
    build_app(arguments, paths).run()
}

/// The preview app for the project at `paths`.
fn build_app(arguments: PreviewArguments, paths: ProjectPaths) -> App {
    let mut app = App::new();
    app.add_plugins(
        DefaultPlugins
            .set(AssetPlugin {
                file_path: paths.asset_root.to_string_lossy().into_owned(),
                meta_check: AssetMetaCheck::Never,
                ..default()
            })
            .set(WindowPlugin {
                primary_window: Some(Window {
                    title: "BevyBroom preview".into(),
                    visible: !arguments.hidden,
                    ..default()
                }),
                ..default()
            }),
    )
    .add_plugins((DynamicLightingPlugin, FreeCameraPlugin))
    .insert_resource(DynamicLightingSettings {
        feature_selection: FeatureSelection::Fixed,
        ..default()
    })
    .insert_resource(WinitSettings::continuous())
    .insert_resource(ClearColor(Color::srgb(0.02, 0.025, 0.04)))
    .add_plugins(BroomBridgePlugin {
        port: arguments.port,
        ..BroomBridgePlugin::new(paths)
    })
    .add_plugins((
        BroomGltfComponentsPlugin,
        placeables::SamplePlaceablesPlugin,
    ))
    .add_systems(
        Startup,
        (
            scene::spawn_camera,
            scene::spawn_shipped_scene,
            startup_requests,
        ),
    )
    .add_systems(
        Update,
        (scene::show_status_in_title, scene::exit_after_frames),
    );
    app.insert_resource(Arguments(arguments));
    app
}

/// Sends the `--level` load and the `--bake` request.
fn startup_requests(
    arguments: Res<Arguments>,
    mut loads: MessageWriter<LevelLoadRequest>,
    mut bake: ResMut<BakeLink>,
) {
    if let Some(level_name) = arguments.0.level.clone() {
        loads.write(LevelLoadRequest { level_name });
    }
    if arguments.0.bake {
        bake.request();
    }
}
