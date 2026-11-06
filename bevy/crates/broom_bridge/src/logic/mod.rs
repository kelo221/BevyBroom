//! Entity I/O runtime slice: syncs authored `logic_outputs` from the live preview state or
//! `broom_logic` glTF node extras, resolves targets by object `Name` (with `*`/`?` wildcards and
//! `!self`), ticks delayed connections, handles universal `Enable` / `Disable` / `Cancel` inputs,
//! and emits [`LogicInputReceived`] messages for game systems.
//!
//! Clean-room Rust implementation inspired by Hammer++ and ReactiveLogic
//! (MIT License, Copyright (c) 2023 Henry de Jongh).

mod matcher;
#[cfg(test)]
mod tests;

use std::collections::HashMap;

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::gltf::GltfExtras;
use bevy::prelude::*;

pub use matcher::{resolve_targets, wildcard_matches};

use crate::authoring::{
    AppliedAuthoring, AuthoredCellEntity, AuthoredLightEntity, AuthoredNode, BroomSystems,
};
use crate::placeables::AuthoredGameEntity;
use crate::protocol::{AuthoredLogicOutput, EXTRAS_LOGIC};

/// Maximum synchronous/chained dispatch depth per update tick to guard against loops.
pub const MAX_LOGIC_CHAIN_DEPTH: u32 = 64;

/// Runtime state of one authored output connection row on an entity.
#[derive(Reflect, Clone, Debug, PartialEq)]
pub struct RuntimeLogicConnection {
    /// Output event name on the source entity.
    pub output: String,
    /// Target name pattern (`*`, `?`, or `!self`).
    pub target: String,
    /// Input action name delivered to matching targets.
    pub input: String,
    /// Parameter string passed with the input.
    pub parameter: String,
    /// Delay in seconds before dispatching the input.
    pub delay: f32,
    /// Remaining fires (`-1` = infinite, `0` = exhausted, `> 0` = remaining count).
    pub remaining_fires: i32,
}

impl From<&AuthoredLogicOutput> for RuntimeLogicConnection {
    fn from(authored: &AuthoredLogicOutput) -> Self {
        Self {
            output: authored.output.clone(),
            target: authored.target.clone(),
            input: authored.input.clone(),
            parameter: authored.parameter.clone(),
            delay: authored.delay.max(0.0),
            remaining_fires: if authored.times_to_fire <= 0 {
                -1
            } else {
                authored.times_to_fire
            },
        }
    }
}

/// Component holding an entity's authored output connections and their refire counters.
#[derive(Component, Reflect, Clone, Debug, Default, PartialEq)]
#[reflect(Component, Default)]
pub struct BroomLogicOutputs {
    pub connections: Vec<RuntimeLogicConnection>,
}

/// Component gating whether an entity processes entity I/O outputs and inputs.
#[derive(Component, Reflect, Clone, Copy, Debug, PartialEq, Eq)]
#[reflect(Component, Default)]
pub struct BroomLogicEnabled(pub bool);

impl Default for BroomLogicEnabled {
    fn default() -> Self {
        Self(true)
    }
}

/// Message sent by game systems to fire a named output on `source`.
#[derive(Message, Clone, Debug, PartialEq)]
pub struct LogicFireOutput {
    /// Entity firing the output.
    pub source: Entity,
    /// Output pin name being fired.
    pub output: String,
    /// Optional runtime parameter fallback when connection parameter is empty.
    pub parameter: String,
    /// Entity that initiated the I/O chain.
    pub activator: Option<Entity>,
    /// Current recursion depth in the I/O chain.
    pub depth: u32,
}

impl LogicFireOutput {
    /// Creates a new output fire message at chain depth 0.
    pub fn new(source: Entity, output: impl Into<String>, parameter: impl Into<String>) -> Self {
        Self {
            source,
            output: output.into(),
            parameter: parameter.into(),
            activator: Some(source),
            depth: 0,
        }
    }
}

/// Message emitted when a connection delivers an input to `target`.
#[derive(Message, Clone, Debug, PartialEq)]
pub struct LogicInputReceived {
    /// Destination entity receiving the input.
    pub target: Entity,
    /// Input action name.
    pub input: String,
    /// Parameter string delivered with the input.
    pub parameter: String,
    /// Entity that originally initiated the I/O chain.
    pub activator: Option<Entity>,
    /// Entity whose output connection dispatched this input.
    pub caller: Entity,
    /// Chain depth at delivery.
    pub depth: u32,
}

/// One delayed connection link waiting in [`LogicPendingQueue`].
#[derive(Clone, Debug, PartialEq)]
pub struct PendingLogicLink {
    /// Source entity that queued the link.
    pub caller: Entity,
    /// Target entity that will receive the input.
    pub target: Entity,
    /// Input action name.
    pub input: String,
    /// Parameter string.
    pub parameter: String,
    /// Chain activator entity.
    pub activator: Option<Entity>,
    /// Remaining countdown in seconds (`<= 0` dispatches on the next tick).
    pub remaining_seconds: f32,
    /// Chain depth carried onto [`LogicInputReceived`].
    pub depth: u32,
}

/// Resource holding delayed entity I/O links across ticks.
#[derive(Resource, Clone, Debug, Default)]
pub struct LogicPendingQueue {
    pub links: Vec<PendingLogicLink>,
}

/// Adds entity I/O components, messages, GLB extras loading, and dispatch systems.
pub struct LogicPlugin;

impl Plugin for LogicPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<LogicPendingQueue>()
            .register_type::<RuntimeLogicConnection>()
            .register_type::<BroomLogicOutputs>()
            .register_type::<BroomLogicEnabled>()
            .add_message::<LogicFireOutput>()
            .add_message::<LogicInputReceived>()
            .add_systems(
                SpawnScene,
                insert_extras_logic
                    .after(SceneSpawnerSystems::WorldInstanceSpawn)
                    .after(SceneSpawnerSystems::SceneSpawn),
            )
            .add_systems(
                Update,
                (
                    sync_authored_logic.in_set(BroomSystems::Components),
                    (enqueue_fired_outputs, tick_pending_logic_queue)
                        .chain()
                        .after(BroomSystems::Components),
                ),
            );
    }
}

/// Parses `broom_logic` from a glTF node's extras JSON string.
pub(crate) fn logic_from_extras(json: &str) -> Option<Vec<AuthoredLogicOutput>> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    let rows = value.get(EXTRAS_LOGIC)?.clone();
    serde_json::from_value::<Vec<AuthoredLogicOutput>>(rows).ok()
}

/// Attaches [`BroomLogicOutputs`] and [`BroomLogicEnabled`] from `broom_logic` node extras.
fn insert_extras_logic(
    mut commands: Commands,
    nodes: Query<(Entity, &GltfExtras), Added<GltfExtras>>,
) {
    for (entity, extras) in &nodes {
        let Some(rows) = logic_from_extras(&extras.value) else {
            continue;
        };
        if rows.is_empty() {
            continue;
        }
        commands.entity(entity).insert((
            BroomLogicOutputs {
                connections: rows.iter().map(RuntimeLogicConnection::from).collect(),
            },
            BroomLogicEnabled(true),
        ));
    }
}

/// Query row for matching authored entities during live logic state synchronization.
type AuthoredTargetRow<'a> = (
    Entity,
    Option<&'a AuthoredNode>,
    Option<&'a AuthoredLightEntity>,
    Option<&'a AuthoredCellEntity>,
    Option<&'a AuthoredGameEntity>,
    Option<&'a Name>,
);

/// Filter matching any newly spawned authored entity that still needs logic attachment.
type NewlyAddedAuthoredFilter = Or<(
    Added<AuthoredNode>,
    Added<AuthoredLightEntity>,
    Added<AuthoredCellEntity>,
    Added<AuthoredGameEntity>,
)>;

/// Syncs `logic_outputs` and object names from the applied live snapshot onto authored entities.
fn sync_authored_logic(
    mut commands: Commands,
    applied: Res<AppliedAuthoring>,
    targets: Query<AuthoredTargetRow<'_>>,
    newly_added: Query<(), NewlyAddedAuthoredFilter>,
    mut synced: Local<Option<(String, u64)>>,
) {
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    let rev = Some((state.document_id.clone(), state.revision));
    if *synced == rev && newly_added.is_empty() {
        return;
    }
    *synced = rev;
    let by_id: HashMap<&str, (&str, &[AuthoredLogicOutput])> = state
        .objects
        .iter()
        .map(|obj| {
            (
                obj.id.as_str(),
                (obj.name.as_str(), obj.logic_outputs.as_slice()),
            )
        })
        .collect();
    for (entity, node, light, cell, point, existing_name) in &targets {
        let id = node
            .map(|n| n.0.as_str())
            .or_else(|| light.map(|l| l.id.as_str()))
            .or_else(|| cell.map(|c| c.id.as_str()))
            .or_else(|| point.map(|p| p.id.as_str()));
        let Some(id) = id else { continue };
        let Some(&(authored_name, rows)) = by_id.get(id) else {
            continue;
        };
        let mut entity_cmds = commands.entity(entity);
        if !authored_name.is_empty() && existing_name.map(Name::as_str) != Some(authored_name) {
            entity_cmds.insert(Name::new(authored_name.to_owned()));
        }
        if rows.is_empty() {
            entity_cmds.remove::<BroomLogicOutputs>();
        } else {
            entity_cmds.insert((
                BroomLogicOutputs {
                    connections: rows.iter().map(RuntimeLogicConnection::from).collect(),
                },
                BroomLogicEnabled(true),
            ));
        }
    }
}

/// Reads [`LogicFireOutput`] messages, resolves target entities by name, and queues links.
fn enqueue_fired_outputs(
    mut fired: MessageReader<LogicFireOutput>,
    mut queue: ResMut<LogicPendingQueue>,
    mut sources: Query<(&mut BroomLogicOutputs, Option<&BroomLogicEnabled>)>,
    named: Query<(Entity, &Name)>,
) {
    if fired.is_empty() {
        return;
    }
    let named_list: Vec<(Entity, String)> = named
        .iter()
        .map(|(e, n)| (e, n.as_str().to_owned()))
        .collect();
    for event in fired.read() {
        if event.depth >= MAX_LOGIC_CHAIN_DEPTH {
            continue;
        }
        let Ok((mut outputs, enabled)) = sources.get_mut(event.source) else {
            continue;
        };
        if !enabled.is_none_or(|flag| flag.0) {
            continue;
        }
        for conn in &mut outputs.connections {
            if conn.output != event.output || conn.remaining_fires == 0 {
                continue;
            }
            if conn.remaining_fires > 0 {
                conn.remaining_fires -= 1;
            }
            let matched = resolve_targets(
                event.source,
                &conn.target,
                named_list.iter().map(|(e, n)| (*e, n.as_str())),
            );
            let param = if conn.parameter.is_empty() {
                event.parameter.clone()
            } else {
                conn.parameter.clone()
            };
            for target in matched {
                queue.links.push(PendingLogicLink {
                    caller: event.source,
                    target,
                    input: conn.input.clone(),
                    parameter: param.clone(),
                    activator: event.activator,
                    remaining_seconds: conn.delay,
                    depth: event.depth + 1,
                });
            }
        }
    }
}

/// Advances [`LogicPendingQueue`] timers and delivers ready links.
fn tick_pending_logic_queue(
    time: Option<Res<Time>>,
    mut queue: ResMut<LogicPendingQueue>,
    mut enabled_query: Query<&mut BroomLogicEnabled>,
    mut delivered: MessageWriter<LogicInputReceived>,
) {
    let dt = time.map_or(0.0, |t| t.delta_secs());
    let mut ready = Vec::new();
    queue.links.retain_mut(|link| {
        link.remaining_seconds -= dt;
        if link.remaining_seconds <= 0.0 {
            ready.push(link.clone());
            false
        } else {
            true
        }
    });
    for link in ready {
        match link.input.as_str() {
            "Enable" => {
                if let Ok(mut flag) = enabled_query.get_mut(link.target) {
                    flag.0 = true;
                }
            }
            "Disable" => {
                if let Ok(mut flag) = enabled_query.get_mut(link.target) {
                    flag.0 = false;
                }
            }
            "Cancel" => {
                queue.links.retain(|pending| pending.caller != link.target);
                continue;
            }
            _ => {}
        }
        let target_enabled = enabled_query.get(link.target).map_or(true, |flag| flag.0);
        if !target_enabled && link.input != "Enable" && link.input != "Disable" {
            continue;
        }
        delivered.write(LogicInputReceived {
            target: link.target,
            input: link.input,
            parameter: link.parameter,
            activator: link.activator,
            caller: link.caller,
            depth: link.depth,
        });
    }
}
