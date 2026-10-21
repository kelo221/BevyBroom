//! Sample placeable components, the way a game registers its own: a door covering every field
//! kind, a spinner that visibly moves what it is placed on, and a door stats data asset.
//!
//! [`DoorStatsMirror`] copies what the door's stats handle points at into plain fields, because
//! asset handles cannot be read through the remote protocol.

use bevy::prelude::*;
use broom_bridge::prelude::*;

/// What a door is made of.
#[derive(Reflect, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum DoorKind {
    #[default]
    Wooden,
    Iron,
    Glass,
}

/// How a door swings.
#[derive(Reflect, Clone, Debug, PartialEq)]
pub struct DoorHinge {
    pub angle: f32,
    pub squeaky: bool,
}

impl Default for DoorHinge {
    fn default() -> Self {
        Self {
            angle: 90.0,
            squeaky: true,
        }
    }
}

/// Tuning shared by many doors, kept in `.door.ron` files.
#[derive(Asset, Reflect, Clone, Debug, PartialEq)]
#[reflect(Default)]
pub struct DoorStats {
    pub health: f32,
    pub open_seconds: f32,
}

impl Default for DoorStats {
    fn default() -> Self {
        Self {
            health: 100.0,
            open_seconds: 1.0,
        }
    }
}

/// A door placed from the editor.
#[derive(Component, Reflect, Clone, Debug, PartialEq)]
#[reflect(Component, Default)]
pub struct Door {
    #[reflect(@FieldRange::new(0.0, 10.0), @FieldStep(0.1), @FieldLabel("Speed"))]
    pub speed: f32,
    pub locked: bool,
    pub key_name: String,
    pub uses: u32,
    pub kind: DoorKind,
    pub open_offset: Vec3,
    pub tint: Color,
    pub hinge: DoorHinge,
    /// Not serialized, because asset handles cannot be read through the remote protocol;
    /// [`DoorStatsMirror`] shows what it points at.
    #[reflect(skip_serializing)]
    pub stats: Handle<DoorStats>,
}

impl Default for Door {
    fn default() -> Self {
        Self {
            speed: 1.5,
            locked: false,
            key_name: String::new(),
            uses: 3,
            kind: DoorKind::Wooden,
            open_offset: Vec3::new(0.0, 2.5, 0.0),
            tint: Color::WHITE,
            hinge: DoorHinge::default(),
            stats: Handle::default(),
        }
    }
}

/// Spins the children of whatever it is placed on around `axis`.
#[derive(Component, Reflect, Clone, Debug, PartialEq)]
#[reflect(Component, Default)]
pub struct Spinner {
    /// Turns per second.
    pub speed: f32,
    pub axis: Vec3,
}

impl Default for Spinner {
    fn default() -> Self {
        Self {
            speed: 1.0,
            axis: Vec3::Y,
        }
    }
}

/// The asset path of a door's stats and their health once loaded.
#[derive(Component, Reflect, Clone, Debug, Default, PartialEq)]
#[reflect(Component)]
pub struct DoorStatsMirror {
    pub path: Option<String>,
    pub health: Option<f32>,
}

/// Registers the sample components and their systems.
pub struct SamplePlaceablesPlugin;

impl Plugin for SamplePlaceablesPlugin {
    fn build(&self, app: &mut App) {
        app.register_data_asset::<DoorStats>("door.ron")
            .register_type::<DoorStatsMirror>()
            .register_placeable::<Door>(
                PlaceableOptions::point()
                    .category("Doors")
                    .marker_color(Srgba::rgb(0.9, 0.5, 0.1)),
            )
            .register_placeable::<Spinner>(
                PlaceableOptions::any()
                    .category("Motion")
                    .marker_color(Srgba::rgb(0.3, 0.9, 0.5)),
            )
            .add_systems(Update, (spin_children, mirror_door_stats));
    }
}

/// Turns the children of every spinner.
fn spin_children(
    time: Res<Time>,
    spinners: Query<(&Spinner, &Children)>,
    mut transforms: Query<&mut Transform>,
) {
    for (spinner, children) in &spinners {
        let Ok(axis) = Dir3::new(spinner.axis) else {
            continue;
        };
        let turn = Quat::from_axis_angle(
            *axis,
            spinner.speed * std::f32::consts::TAU * time.delta_secs(),
        );
        for child in children {
            if let Ok(mut transform) = transforms.get_mut(*child) {
                transform.rotate(turn);
            }
        }
    }
}

/// Keeps every door's [`DoorStatsMirror`] in step with its stats handle.
fn mirror_door_stats(
    mut commands: Commands,
    doors: Query<(Entity, &Door, Option<&DoorStatsMirror>)>,
    stats: Res<Assets<DoorStats>>,
) {
    for (entity, door, mirror) in &doors {
        let current = DoorStatsMirror {
            path: door.stats.path().map(ToString::to_string),
            health: stats.get(&door.stats).map(|stats| stats.health),
        };
        if mirror != Some(&current) {
            commands.entity(entity).insert(current);
        }
    }
}
