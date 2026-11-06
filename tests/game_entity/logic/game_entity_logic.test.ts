import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';
import { CommandGameEntityLogicSet } from '@/game_entity/logic/command_game_entity_logic_set.js';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GAME_ENTITY_LOGIC_EXPORT_EXTRAS_KEY } from '@/game_entity/logic/game_entity_logic_types.js';
import { ObjectDataContributorGameLogic } from '@/game_entity/contributors/object_data_contributor_game_logic.js';

describe('GameEntityLogicStore, GameEntityLogicMatcher, and ObjectDataContributorGameLogic', () => {
  it('stores, sanitizes, and undoes logic output rows and comments', () => {
    const obj = new THREE.Group();
    obj.name = 'button_main';
    const onApplied = vi.fn();
    const cmd = new CommandGameEntityLogicSet(
      obj,
      [
        {
          output: ' OnPressed ',
          target: ' door_* ',
          input: ' Open ',
          parameter: 'fast',
          delay: -5,
          times_to_fire: 0,
        },
      ],
      onApplied,
    );

    cmd.execute();
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(GameEntityLogicStore.read(obj)).toEqual([
      {
        output: 'OnPressed',
        target: 'door_*',
        input: 'Open',
        parameter: 'fast',
        delay: 0,
        times_to_fire: -1,
      },
    ]);

    cmd.undo();
    expect(GameEntityLogicStore.hasAny(obj)).toBe(false);
  });

  it('resolves !self, exact names, and wildcards, builds incoming inputs, and syncs renames', () => {
    const world = new THREE.Group();
    const button = new THREE.Group();
    button.name = 'btn_1';
    const door1 = new THREE.Group();
    door1.name = 'door_north';
    const door2 = new THREE.Group();
    door2.name = 'door_south';
    world.add(button, door1, door2);

    GameEntityLogicStore.write(button, [
      { output: 'OnPressed', target: 'door_north', input: 'Open', parameter: '', delay: 0, times_to_fire: 1 },
      { output: 'OnPressed', target: 'door_*', input: 'Unlock', parameter: '', delay: 0.5, times_to_fire: -1 },
      { output: 'OnPressed', target: '!self', input: 'Disable', parameter: '', delay: 0, times_to_fire: 1 },
    ]);

    expect(GameEntityLogicMatcher.targetValidate(button, 'door_north', world)).toBe('valid_single');
    expect(GameEntityLogicMatcher.targetValidate(button, 'door_*', world)).toBe('valid_multiple');
    expect(GameEntityLogicMatcher.targetValidate(button, 'missing_target', world)).toBe('broken');
    expect(GameEntityLogicMatcher.targetsResolve(button, '!self', world)).toEqual([button]);

    const incomingToDoor1 = GameEntityLogicMatcher.incomingConnectionsCollect(door1, world);
    expect(incomingToDoor1.map((item) => item.row.input)).toEqual(['Open', 'Unlock']);

    door1.name = 'gate_north';
    const syncedCount = GameEntityLogicMatcher.renameTargetsSync(world, 'door_north', 'gate_north');
    expect(syncedCount).toBe(1);
    expect(GameEntityLogicStore.read(button)[0]?.target).toBe('gate_north');
  });

  it('round-trips logic outputs and comments through scene entries, preview payload, and GLB extras', () => {
    const contributor = new ObjectDataContributorGameLogic();
    const source = new THREE.Group();
    GameEntityLogicStore.write(source, [
      { output: 'OnTrigger', target: 'relay_1', input: 'Trigger', parameter: '1', delay: 0.25, times_to_fire: -1 },
    ]);
    GameEntityLogicStore.commentsWrite(source, 'Main courtyard trigger');

    const entry = {
      uuid: source.uuid,
      name: 'trigger_1',
      type: 'group',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      parentId: null,
    } as ObjectEntry;

    contributor.sceneEntryWrite(source, entry);
    expect(entry.gameLogicOutputs?.length).toBe(1);
    expect(entry.objectComments).toBe('Main courtyard trigger');

    const restored = new THREE.Group();
    contributor.sceneEntryRead(entry, restored);
    expect(GameEntityLogicStore.read(restored)).toEqual(GameEntityLogicStore.read(source));
    expect(GameEntityLogicStore.commentsRead(restored)).toBe('Main courtyard trigger');

    const previewObj = {} as PreviewAuthoredObject;
    contributor.previewPayloadAttach(source, previewObj);
    expect(previewObj.logic_outputs).toEqual(GameEntityLogicStore.read(source));

    const exportNode = new THREE.Group();
    contributor.exportExtrasWrite(source, exportNode, { includeGameComponents: true });
    expect(exportNode.userData[GAME_ENTITY_LOGIC_EXPORT_EXTRAS_KEY]).toEqual(GameEntityLogicStore.read(source));
  });
});
