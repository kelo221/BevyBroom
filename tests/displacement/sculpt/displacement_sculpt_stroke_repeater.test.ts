import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DisplacementSculptStrokeRepeater } from '@/displacement/sculpt/displacement_sculpt_stroke_repeater.js';
import { DisplacementSculptFrameSchedulerFake } from './displacement_sculpt_frame_scheduler_fake.js';

/** Continuous Mouse dab repeats driven by animation frames. */
describe('DisplacementSculptStrokeRepeater', () => {
  it('repeats the latest center once per frame until stopped', () => {
    const scheduler = new DisplacementSculptFrameSchedulerFake();
    const centers: THREE.Vector3[] = [];
    const repeater = new DisplacementSculptStrokeRepeater(scheduler, (center) => centers.push(center.clone()));
    const start = new THREE.Vector3(1, 2, 3);
    const moved = start.clone().add(new THREE.Vector3(0.5, 0, -0.5));
    repeater.centerUpdate(moved);
    expect(repeater.isRunning()).toBe(false);
    repeater.start(start);
    scheduler.framesRun(2);
    repeater.centerUpdate(moved);
    scheduler.framesRun(1);
    expect(centers.map((center) => center.toArray())).toEqual([start.toArray(), start.toArray(), moved.toArray()]);
    repeater.stop();
    expect(repeater.isRunning()).toBe(false);
    expect(scheduler.pendingCount()).toBe(0);
    scheduler.framesRun(3);
    expect(centers).toHaveLength(3);
  });

  it('keeps a single pending frame when restarted', () => {
    const scheduler = new DisplacementSculptFrameSchedulerFake();
    let dabCount = 0;
    const repeater = new DisplacementSculptStrokeRepeater(scheduler, () => {
      dabCount += 1;
    });
    repeater.start(new THREE.Vector3());
    repeater.start(new THREE.Vector3(1, 0, 0));
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.framesRun(1);
    expect(dabCount).toBe(1);
    repeater.stop();
  });
});
