import { describe, expect, it } from 'vitest';
import { faceSelectSecondaryPressResultMiss } from '@/editor/tools/face_select/face_select_secondary_press_result.js';

describe('faceSelectSecondaryPressResultMiss', () => {
  it('returns a press that hit nothing and started no stroke', () => {
    expect(faceSelectSecondaryPressResultMiss()).toEqual({ viewportHit: false, strokeStarted: false });
  });
});
