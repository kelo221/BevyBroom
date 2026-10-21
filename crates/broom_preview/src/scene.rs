//! The preview's own entities and conveniences: a free camera, a status title, smoke-test exits.

use bevy::camera_controller::free_camera::FreeCamera;
use bevy::gltf::GltfAssetLabel;
use bevy::prelude::*;
use bevy::render::view::screenshot::{Screenshot, save_to_disk};
use bevy::window::PrimaryWindow;
use bevy::world_serialization::WorldAssetRoot;
use broom_bridge::status::BridgeStatus;
use dynlight::prelude::LightingViewer;

use crate::arguments::PreviewArguments;

/// Spawns the camera, looking at the origin from above and behind.
pub fn spawn_camera(mut commands: Commands) {
    commands.spawn((
        Camera3d::default(),
        LightingViewer,
        FreeCamera::default(),
        Transform::from_xyz(-6.0, 4.0, 8.0).looking_at(Vec3::new(0.0, 1.0, 0.0), Vec3::Y),
    ));
}

/// Spawns the `--scene` GLB's first scene the way a game loads a shipped level, so its
/// `broom_components` node extras become components.
pub fn spawn_shipped_scene(
    mut commands: Commands,
    arguments: Res<Arguments>,
    assets: Res<AssetServer>,
) {
    let Some(path) = arguments.0.scene.clone() else {
        return;
    };
    commands.spawn((
        Name::new(format!("Shipped scene {path}")),
        WorldAssetRoot(assets.load(GltfAssetLabel::Scene(0).from_asset(path))),
        Transform::default(),
    ));
}

/// Shows the applied revisions and the bake state in the window title.
pub fn show_status_in_title(
    status: Res<BridgeStatus>,
    mut windows: Query<&mut Window, With<PrimaryWindow>>,
    mut shown: Local<String>,
) {
    let title = format!(
        "BevyBroom preview | document {} | geometry r{}{} | bake {:?}",
        status
            .document_id
            .as_deref()
            .map_or("none", |id| id.get(..8).unwrap_or(id)),
        status.geometry_revision_applied,
        if status.geometry_loading {
            " (loading)"
        } else {
            ""
        },
        status.bake_state,
    );
    if *shown == title {
        return;
    }
    for mut window in &mut windows {
        window.title.clone_from(&title);
    }
    *shown = title;
}

/// Exits after `--frames` frames, saving `--screenshot` one frame before.
pub fn exit_after_frames(
    mut commands: Commands,
    arguments: Res<Arguments>,
    mut frame: Local<u32>,
    mut exit: MessageWriter<AppExit>,
) {
    let Some(frames) = arguments.0.frames else {
        return;
    };
    *frame += 1;
    if *frame + 1 == frames
        && let Some(path) = arguments.0.screenshot.clone()
    {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk(path));
    }
    if *frame >= frames {
        exit.write(AppExit::Success);
    }
}

/// The parsed command line as a resource.
#[derive(Resource)]
pub struct Arguments(pub PreviewArguments);
