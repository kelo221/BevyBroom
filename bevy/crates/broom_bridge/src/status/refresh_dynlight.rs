//! Keeping the light, budget, room and portal fields of [`BridgeStatus`] current every frame.
//! Only built with the `dynlight` feature; without it those fields stay at their defaults.

use bevy::prelude::*;
use dynlight::light::{DynamicLight, ShadowMode};
use dynlight::portals::{Portal, PortalState, Room, RoomGraph};
use dynlight::prelude::DynamicLightingSettings;

use super::{BridgeStatus, PortalCullingState};
use crate::authoring::{AuthoredCellEntity, AuthoredLightEntity};

/// The authored rooms and portals, counted for the status.
type AuthoredCells<'w, 's> = Query<'w, 's, (Has<Room>, Has<Portal>), With<AuthoredCellEntity>>;

/// Copies the authored light counts and DynLight's realtime budgets into the status.
pub(crate) fn refresh_light_status(
    mut status: ResMut<BridgeStatus>,
    settings: Res<DynamicLightingSettings>,
    lights: Query<&DynamicLight, With<AuthoredLightEntity>>,
) {
    let status = status.bypass_change_detection();
    status.light_count = lights.iter().count();
    status.realtime_light_count = lights.iter().filter(|light| light.realtime).count();
    status.realtime_shadow_count = lights
        .iter()
        .filter(|light| light.shadows == ShadowMode::Realtime)
        .count();
    status.realtime_light_budget = settings.realtime_light_budget;
    status.shadow_cubemap_budget = settings.shadow_cubemap_budget;
}

/// Copies the room and portal counts and DynLight's culling state into the status.
pub(crate) fn refresh_portal_status(
    mut status: ResMut<BridgeStatus>,
    cells: AuthoredCells,
    graph: Option<Res<RoomGraph>>,
) {
    let status = status.bypass_change_detection();
    status.room_count = cells.iter().filter(|(room, _)| *room).count();
    status.portal_count = cells.iter().filter(|(_, portal)| *portal).count();
    (status.portal_state, status.portal_message) =
        portal_culling(graph.as_deref().map(RoomGraph::state));
}

/// The culling state and, when culling is off because of a problem, DynLight's reason.
pub(super) fn portal_culling(state: Option<&PortalState>) -> (PortalCullingState, Option<String>) {
    match state {
        Some(PortalState::Ready) => (PortalCullingState::Active, None),
        Some(PortalState::Disabled(reason)) => (PortalCullingState::Disabled, Some(reason.clone())),
        Some(PortalState::Empty) | None => (PortalCullingState::Empty, None),
    }
}
