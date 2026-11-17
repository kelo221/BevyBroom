import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENTITY_HANDLE_SNAP_NONE, type EntityHandleSnap } from '@/entity/handles/entity_handle.js';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import {
  PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
  PROCEDURAL_PEOPLE_MOVER_END,
  PROCEDURAL_PEOPLE_MOVER_START,
  PROCEDURAL_PEOPLE_MOVER_WIDTH,
} from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralHandleSpan } from '@/procedural/handles/procedural_handle_span.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/** Grid step of the snapping used by these tests, in meters. */
const GRID_STEP = 0.25;

/** Snapping to multiples of the grid step. */
const gridSnap: EntityHandleSnap = {
  snapValue: (value) => Math.round(value / GRID_STEP) * GRID_STEP,
  snapAngleRadians: (angle) => angle,
};

const handle = new ProceduralHandleSpan({
  path: PROCEDURAL_PEOPLE_MOVER_WIDTH,
  lineStartPath: PROCEDURAL_PEOPLE_MOVER_START,
  lineEndPath: PROCEDURAL_PEOPLE_MOVER_END,
});

/**
 * Creates a turned people mover away from the origin.
 *
 * @returns Owner, settings, the middle of its line and its across direction.
 */
function moverCreate(): {
  owner: THREE.Group;
  settings: ProceduralSettings;
  middle: THREE.Vector3;
  across: THREE.Vector3;
} {
  const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID);
  if (generator === null) throw new Error('the people mover is built in');
  const owner = ProceduralOwner.create('Mover', ProceduralSettingsRules.createForGenerator(generator));
  owner.position.set(-4, 2, 5);
  owner.rotation.set(0, 0.7, 0);
  owner.updateMatrixWorld(true);
  const settings = ProceduralOwner.settingsRead(owner);
  if (settings === null) throw new Error('missing settings');
  const start = ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_PEOPLE_MOVER_START);
  const end = ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_PEOPLE_MOVER_END);
  const middle = start.clone().add(end).multiplyScalar(0.5);
  return { owner, settings, middle, across: ProceduralPartFrame.acrossDirectionOf(end.sub(start)) };
}

/** Span handles set a length across the line between two points. */
describe('ProceduralHandleSpan', () => {
  it('sits beside the middle of the line at half the length', () => {
    const { owner, settings, middle, across } = moverCreate();
    const width = ProceduralParametersRead.number(settings.parameters, PROCEDURAL_PEOPLE_MOVER_WIDTH);
    const expected = owner.localToWorld(middle.clone().addScaledVector(across, width / 2));
    expect(handle.worldPositionFor({ owner, camera: new THREE.Camera() }, settings).distanceTo(expected)).toBeLessThan(
      1e-9,
    );
  });

  it('sets the length to twice the distance across the line, ignoring movement along it', () => {
    const { owner, settings, middle, across } = moverCreate();
    const along = new THREE.Vector3(0, 1, 0).cross(across).normalize();
    const local = middle.clone().addScaledVector(across, -1.3).addScaledVector(along, 2);
    const world = owner.localToWorld(local);
    const dragged = handle.settingsDragged(
      { owner, camera: new THREE.Camera() },
      settings,
      world,
      ENTITY_HANDLE_SNAP_NONE,
    );
    expect(ProceduralParametersRead.number(dragged.parameters, PROCEDURAL_PEOPLE_MOVER_WIDTH)).toBeCloseTo(2.6, 9);
  });

  it('snaps the length to the grid', () => {
    const { owner, settings, middle, across } = moverCreate();
    const world = owner.localToWorld(middle.clone().addScaledVector(across, 0.93));
    const dragged = handle.settingsDragged({ owner, camera: new THREE.Camera() }, settings, world, gridSnap);
    const width = ProceduralParametersRead.number(dragged.parameters, PROCEDURAL_PEOPLE_MOVER_WIDTH);
    expect(width).toBeCloseTo(gridSnap.snapValue(0.93 * 2), 9);
  });
});
