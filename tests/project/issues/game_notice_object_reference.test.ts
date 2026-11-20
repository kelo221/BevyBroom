import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { gameNoticeObjectFind, gameNoticeObjectReferenceParse } from '@/project/issues/game_notice_object_reference.js';

/**
 * Creates a world holding one named child per given name.
 *
 * @param names Names of the children.
 * @returns World root and its children in order.
 */
function worldWithNamedChildrenCreate(names: readonly string[]): { world: THREE.Group; children: THREE.Object3D[] } {
  const world = new THREE.Group();
  const children = names.map((name) => {
    const child = new THREE.Object3D();
    child.name = name;
    world.add(child);
    return child;
  });
  return { world, children };
}

describe('gameNoticeObjectReferenceParse', () => {
  it('reads the name and the id of a warning', () => {
    const reference = gameNoticeObjectReferenceParse('Door (abc-123): has no mesh, so it is left out.');
    expect(reference).toEqual({ objectName: 'Door', objectId: 'abc-123' });
  });

  it('reads a warning without brackets as a name only', () => {
    const reference = gameNoticeObjectReferenceParse('Door: has no mesh, so it is left out.');
    expect(reference).toEqual({ objectName: 'Door', objectId: null });
  });

  it('ignores messages that are not about a left out object', () => {
    expect(gameNoticeObjectReferenceParse('unused variable: `x`')).toBeNull();
  });
});

describe('gameNoticeObjectFind', () => {
  it('finds the object by uuid even when another object has the name', () => {
    const { world, children } = worldWithNamedChildrenCreate(['Door', 'Door']);
    const target = children[1] as THREE.Object3D;
    expect(gameNoticeObjectFind({ objectName: 'Door', objectId: target.uuid }, world)).toBe(target);
  });

  it('falls back to a unique name when no id was printed', () => {
    const { world, children } = worldWithNamedChildrenCreate(['Door', 'Wall']);
    expect(gameNoticeObjectFind({ objectName: 'Wall', objectId: null }, world)).toBe(children[1]);
  });

  it('finds nothing when the name is ambiguous or unknown', () => {
    const { world } = worldWithNamedChildrenCreate(['Door', 'Door']);
    expect(gameNoticeObjectFind({ objectName: 'Door', objectId: null }, world)).toBeNull();
    expect(gameNoticeObjectFind({ objectName: 'Gone', objectId: null }, world)).toBeNull();
  });
});
