import { describe, it, expect, beforeEach } from 'vitest';
import { ManagerSnap } from '@/transform/snap/manager_snap.js';
import { GRID_INTERVAL_MINIMUM, SNAP_PRESETS } from '@/types/snap_presets.js';

describe('SnapManager default interval', () => {
  it('should initialize with the provided default interval', () => {
    const manager = new ManagerSnap(2.0);
    expect(manager.getInterval()).toBe(2.0);
  });
});

describe('SnapManager cycle forward', () => {
  let manager: ManagerSnap;

  beforeEach(() => {
    manager = new ManagerSnap(1.0);
  });

  it('should advance to the next preset on cycleForward', () => {
    manager.cycleForward();
    expect(manager.getInterval()).toBe(2.0);
  });

  it('should wrap from last preset to first on cycleForward', () => {
    manager.setInterval(64.0);
    manager.cycleForward();
    expect(manager.getInterval()).toBe(0.03125);
  });

  it('should fire callback on forward cycle', () => {
    let called = false;
    let captured: number | undefined;
    manager.onIntervalChanged((value) => {
      called = true;
      captured = value;
    });
    manager.cycleForward();
    expect(called).toBe(true);
    expect(captured).toBe(2.0);
  });
});

describe('SnapManager cycle backward', () => {
  let manager: ManagerSnap;

  beforeEach(() => {
    manager = new ManagerSnap(1.0);
  });

  it('should go to the previous preset on cycleBackward', () => {
    manager.cycleBackward();
    expect(manager.getInterval()).toBe(0.5);
  });

  it('should wrap from first preset to last on cycleBackward', () => {
    manager.setInterval(0.03125);
    manager.cycleBackward();
    expect(manager.getInterval()).toBe(64.0);
  });

  it('should fire callback on backward cycle', () => {
    let called = false;
    let captured: number | undefined;
    manager.onIntervalChanged((value) => {
      called = true;
      captured = value;
    });
    manager.cycleBackward();
    expect(called).toBe(true);
    expect(captured).toBe(0.5);
  });
});

describe('SnapManager setInterval validation', () => {
  it('should reject zero value', () => {
    const manager = new ManagerSnap(1.0);
    manager.setInterval(0);
    expect(manager.getInterval()).toBe(1.0);
  });

  it('should reject negative value', () => {
    const manager = new ManagerSnap(1.0);
    manager.setInterval(-5);
    expect(manager.getInterval()).toBe(1.0);
  });

  it('should accept positive non-preset value', () => {
    const manager = new ManagerSnap(1.0);
    manager.setInterval(7.5);
    expect(manager.getInterval()).toBe(7.5);
  });
});

describe('SnapManager callback', () => {
  it('should fire multiple callbacks on interval change', () => {
    const manager = new ManagerSnap(1.0);
    const results: number[] = [];
    manager.onIntervalChanged((v) => results.push(v));
    manager.onIntervalChanged((v) => results.push(v * 2));
    manager.setInterval(5.0);
    expect(results).toEqual([5.0, 10.0]);
  });

  it('should not fire callback when interval does not change', () => {
    const manager = new ManagerSnap(1.0);
    let callCount = 0;
    manager.onIntervalChanged(() => {
      callCount++;
    });
    manager.setInterval(1.0);
    expect(callCount).toBe(0);
  });
});

describe('SnapManager getPresetIndex', () => {
  it('should return correct index for a preset value', () => {
    const manager = new ManagerSnap(4.0);
    expect(manager.getPresetIndex()).toBe(SNAP_PRESETS.indexOf(4.0));
  });

  it('should return -1 for a non-preset value', () => {
    const manager = new ManagerSnap(1.0);
    manager.setInterval(7.5);
    expect(manager.getPresetIndex()).toBe(-1);
  });

  it('should return 0 for the first preset', () => {
    const manager = new ManagerSnap(0.03125);
    expect(manager.getPresetIndex()).toBe(0);
  });
});

/** Proves the grid never goes finer than the minimum grid interval. */
describe('SnapManager minimum grid interval', () => {
  it('raises a finer requested interval to the minimum grid', () => {
    const manager = new ManagerSnap(1.0);
    manager.setInterval(GRID_INTERVAL_MINIMUM / 4);
    expect(manager.getInterval()).toBe(GRID_INTERVAL_MINIMUM);
  });

  it('raises a finer default interval to the minimum grid', () => {
    expect(new ManagerSnap(GRID_INTERVAL_MINIMUM / 2).getInterval()).toBe(GRID_INTERVAL_MINIMUM);
  });

  it('ignores intervals that are not positive numbers', () => {
    const manager = new ManagerSnap(1.0);
    manager.setInterval(Number.NaN);
    manager.setInterval(-1);
    expect(manager.getInterval()).toBe(1.0);
  });

  it('starts the preset list at the minimum grid', () => {
    expect(Math.min(...SNAP_PRESETS)).toBe(GRID_INTERVAL_MINIMUM);
  });
});
