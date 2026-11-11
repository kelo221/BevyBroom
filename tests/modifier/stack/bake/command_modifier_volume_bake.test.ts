import { describe, expect, it } from 'vitest';
import { CommandModifierVolumeBake } from '@/modifier/stack/bake/command_modifier_volume_bake.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { stackFixture, stackResultBounds } from '../modifier_stack_fixture.js';

describe('modifier volume bake', () => {
  it('turns array copies into authored brushes, removes the volume and undoes cleanly', () => {
    const fixture = stackFixture([{ kind: 'linear', parameters: { mode: 'fixed', offsetX: 2 } }]);
    fixture.refresh();
    const bake = new CommandModifierVolumeBake(fixture.volume);
    expect(bake.createdCount()).toBe(2);
    bake.execute();
    expect(fixture.volume.parent).toBeNull();
    expect(fixture.model.getBrushes()).toHaveLength(3);
    fixture.model.rebuild(true);
    expect(stackResultBounds(fixture.model).max.x).toBeCloseTo(4.5);
    const baked = fixture.model.getBrushes()[2];
    expect(baked?.position.x).toBeCloseTo(4);
    bake.undo();
    expect(fixture.volume.parent).toBe(fixture.world);
    expect(fixture.model.getBrushes()).toHaveLength(1);
    expect(stackResultBounds(fixture.model).max.x).toBeCloseTo(4.5);
  });

  it('keeps the chamfer of bevelled authored brushes and restores the box on undo', () => {
    const fixture = stackFixture(['bevel']);
    fixture.refresh();
    const bake = new CommandModifierVolumeBake(fixture.volume);
    bake.execute();
    expect(fixture.source.brush.vertices.length).toBeGreaterThan(8);
    bake.undo();
    expect(fixture.source.brush.vertices).toHaveLength(8);
  });
});

describe('modifier volume bake scene order', () => {
  it('inserts copies right after their source and keeps ids across undo and redo', () => {
    const fixture = stackFixture([{ kind: 'linear', parameters: { mode: 'fixed', offsetX: 2, count: 3 } }], 2);
    const outside = fixture.model.addBoxBrush(1, SolidOperation.Subtractive);
    outside.mesh?.position.set(20, 0, 0);
    fixture.refresh();
    const bake = new CommandModifierVolumeBake(fixture.volume);
    bake.execute();
    const ids = fixture.model.getBrushes().map((brush) => brush.id);
    expect(ids[0]).toBe(fixture.source.id);
    expect(ids[3]).toBe(outside.id);
    bake.undo();
    expect(fixture.model.getBrushes().map((brush) => brush.id)).toEqual([fixture.source.id, outside.id]);
    bake.execute();
    expect(fixture.model.getBrushes().map((brush) => brush.id)).toEqual(ids);
  });
});
