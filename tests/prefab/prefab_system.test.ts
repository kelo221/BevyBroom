import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';

describe('Wave 2D: Prefab Library, Scoped Entity I/O Stamping, and toEntity/toWorld', () => {
  it('captures a multi-object prefab and scopes internal Entity I/O target names on each stamp', () => {
    const button = new THREE.Mesh();
    button.name = 'DoorButton';
    button.position.set(2, 0, 0);
    GameEntityLogicStore.write(button, [
      {
        output: 'OnPressed',
        target: 'VaultDoor',
        input: 'Open',
        parameter: '',
        delay: 0.5,
        times_to_fire: -1,
      },
      {
        output: 'OnPressed',
        target: 'GlobalAlarm',
        input: 'Trigger',
        parameter: '',
        delay: 0,
        times_to_fire: 1,
      },
    ]);

    const door = new THREE.Mesh();
    door.name = 'VaultDoor';
    door.position.set(6, 0, 0);

    const store = new PrefabCatalogStore();
    const tpl = store.templateCapture('Vault Entry', 'Doors', [button, door]);
    store.templateAdd(tpl);
    expect(store.categoriesRead()).toEqual(['Doors']);

    const stampA = store.stampTemplate(tpl.id, new THREE.Vector3(10, 0, 10), true);
    const stampB = store.stampTemplate(tpl.id, new THREE.Vector3(20, 0, 10), true);
    expect(stampA).not.toBeNull();
    expect(stampB).not.toBeNull();

    const btnA = stampA?.children[0] ?? null;
    const doorA = stampA?.children[1] ?? null;
    const btnB = stampB?.children[0] ?? null;
    const doorB = stampB?.children[1] ?? null;

    expect(btnA?.name).toBe('DoorButton_inst1');
    expect(doorA?.name).toBe('VaultDoor_inst1');
    expect(btnB?.name).toBe('DoorButton_inst2');
    expect(doorB?.name).toBe('VaultDoor_inst2');

    if (btnA && btnB) {
      const outputsA = GameEntityLogicStore.read(btnA);
      const outputsB = GameEntityLogicStore.read(btnB);
      expect(outputsA[0]?.target).toBe('VaultDoor_inst1');
      expect(outputsA[1]?.target).toBe('GlobalAlarm');
      expect(outputsB[0]?.target).toBe('VaultDoor_inst2');
      expect(outputsB[1]?.target).toBe('GlobalAlarm');
    }
  });

  it('captures templates with distinct ids without adding them to the catalog', () => {
    const store = new PrefabCatalogStore();
    const first = store.templateCapture('Crate', 'Props', [new THREE.Mesh()]);
    const second = store.templateCapture('Crate', 'Props', [new THREE.Mesh()]);
    expect(first.id).not.toBe(second.id);
    expect(store.templateFind(first.id)).toBeNull();
    store.templateAdd(first);
    expect(store.templateFind(first.id)).toBe(first);
  });
});
