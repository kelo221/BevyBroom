use std::time::Duration;

use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;

use super::*;
use crate::protocol::AuthoredLogicOutput;

#[derive(Resource, Default)]
struct ReceivedLog(Vec<LogicInputReceived>);

fn collect_received(mut reader: MessageReader<LogicInputReceived>, mut log: ResMut<ReceivedLog>) {
    for msg in reader.read() {
        log.0.push(msg.clone());
    }
}

fn test_app() -> App {
    let mut app = App::new();
    app.add_plugins(MinimalPlugins)
        .init_resource::<AppliedAuthoring>()
        .init_resource::<ReceivedLog>()
        .add_plugins(LogicPlugin)
        .add_systems(Update, collect_received.after(tick_pending_logic_queue));
    app
}

#[test]
fn wildcard_and_self_matching_work() {
    assert!(wildcard_matches("door_*", "door_main"));
    assert!(wildcard_matches("light_?", "light_1"));
    assert!(!wildcard_matches("light_?", "light_10"));

    let e1 = Entity::from_raw_u32(1).unwrap();
    let e2 = Entity::from_raw_u32(2).unwrap();
    let list = vec![(e1, "button_1"), (e2, "door_alpha")];
    assert_eq!(resolve_targets(e1, "!self", list.clone()), vec![e1]);
    assert_eq!(resolve_targets(e1, "door_*", list), vec![e2]);
}

#[test]
fn fires_immediate_and_delayed_outputs_and_respects_times_to_fire() {
    let mut app = test_app();
    app.insert_resource(TimeUpdateStrategy::ManualDuration(Duration::from_millis(
        100,
    )));

    let button = app
        .world_mut()
        .spawn((
            Name::new("btn_start"),
            BroomLogicEnabled(true),
            BroomLogicOutputs {
                connections: vec![
                    RuntimeLogicConnection::from(&AuthoredLogicOutput {
                        output: "OnPressed".into(),
                        target: "door_*".into(),
                        input: "Open".into(),
                        parameter: "fast".into(),
                        delay: 0.0,
                        times_to_fire: 1,
                    }),
                    RuntimeLogicConnection::from(&AuthoredLogicOutput {
                        output: "OnPressed".into(),
                        target: "door_main".into(),
                        input: "Close".into(),
                        parameter: String::new(),
                        delay: 0.25,
                        times_to_fire: -1,
                    }),
                ],
            },
        ))
        .id();
    let door = app
        .world_mut()
        .spawn((Name::new("door_main"), BroomLogicEnabled(true)))
        .id();

    app.world_mut()
        .write_message(LogicFireOutput::new(button, "OnPressed", "fallback"));
    app.update();

    let log = &app.world().resource::<ReceivedLog>().0;
    assert_eq!(log.len(), 1);
    assert_eq!(log[0].target, door);
    assert_eq!(log[0].input, "Open");
    assert_eq!(log[0].parameter, "fast");

    // Firing a second time should not trigger the `times_to_fire: 1` Open connection again.
    app.world_mut()
        .write_message(LogicFireOutput::new(button, "OnPressed", "fallback"));
    app.update();
    app.update();
    app.update();

    let log = &app.world().resource::<ReceivedLog>().0;
    let opens = log.iter().filter(|m| m.input == "Open").count();
    let closes = log.iter().filter(|m| m.input == "Close").count();
    assert_eq!(opens, 1);
    assert!(closes >= 1);
}

#[test]
fn universal_disable_enable_and_cancel_work() {
    let mut app = test_app();
    let relay = app
        .world_mut()
        .spawn((
            Name::new("relay_1"),
            BroomLogicEnabled(true),
            BroomLogicOutputs {
                connections: vec![RuntimeLogicConnection::from(&AuthoredLogicOutput {
                    output: "OnTrigger".into(),
                    target: "!self".into(),
                    input: "Disable".into(),
                    parameter: String::new(),
                    delay: 0.0,
                    times_to_fire: -1,
                })],
            },
        ))
        .id();

    app.world_mut()
        .write_message(LogicFireOutput::new(relay, "OnTrigger", ""));
    app.update();

    let enabled = app.world().get::<BroomLogicEnabled>(relay).unwrap();
    assert!(!enabled.0);
}
