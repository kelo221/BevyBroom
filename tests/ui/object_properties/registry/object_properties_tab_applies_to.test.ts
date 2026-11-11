import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import {
  objectPropertiesTabAppliesToNonVolumesIs,
  objectPropertiesTabAppliesToVolumesIs,
} from '@/ui/object_properties/registry/object_properties_tab_applies_to.js';

describe('object properties tab applicability', () => {
  it('applies the Modifiers tab only when every selected object is a modifier volume', () => {
    const volumeA = ModifierVolume.create({});
    const volumeB = ModifierVolume.create({});
    const brush = new THREE.Group();
    expect(objectPropertiesTabAppliesToVolumesIs([volumeA])).toBe(true);
    expect(objectPropertiesTabAppliesToVolumesIs([volumeA, volumeB])).toBe(true);
    expect(objectPropertiesTabAppliesToVolumesIs([volumeA, brush])).toBe(false);
    expect(objectPropertiesTabAppliesToVolumesIs([brush])).toBe(false);
    expect(objectPropertiesTabAppliesToVolumesIs([])).toBe(false);
  });

  it('applies the entity I/O tabs only when no selected object is a modifier volume', () => {
    const volume = ModifierVolume.create({});
    const brush = new THREE.Group();
    expect(objectPropertiesTabAppliesToNonVolumesIs([brush])).toBe(true);
    expect(objectPropertiesTabAppliesToNonVolumesIs([])).toBe(true);
    expect(objectPropertiesTabAppliesToNonVolumesIs([volume])).toBe(false);
    expect(objectPropertiesTabAppliesToNonVolumesIs([brush, volume])).toBe(false);
  });
});
