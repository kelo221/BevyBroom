import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';

/** Typed reads of procedural parameters. */
describe('ProceduralParametersRead', () => {
  it('reads points and numbers, and stores points as lists', () => {
    const point = new THREE.Vector3(1.5, -2, 3.25);
    const parameters = { end: ProceduralParametersRead.vector3Value(point), width: 2.4 };
    expect(ProceduralParametersRead.vector3(parameters, 'end').equals(point)).toBe(true);
    expect(ProceduralParametersRead.number(parameters, 'width')).toBe(2.4);
  });

  it('reads missing or mistyped parameters as zero', () => {
    const parameters = { end: 'far', width: [1, 2, 3] };
    expect(ProceduralParametersRead.vector3(parameters, 'end').equals(new THREE.Vector3())).toBe(true);
    expect(ProceduralParametersRead.vector3(parameters, 'missing').equals(new THREE.Vector3())).toBe(true);
    expect(ProceduralParametersRead.number(parameters, 'width')).toBe(0);
  });
});
