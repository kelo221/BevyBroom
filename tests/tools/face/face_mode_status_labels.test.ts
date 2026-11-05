import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { SelectionMode } from '@/types/selection_mode.js';
import {
  faceModeStatusLabelExtrude,
  faceModeStatusLabelSelectionMode,
  faceModeStatusLabelUvTransform,
} from '@/tools/face/face_mode_status_labels.js';

/**
 * Creates a brush preview mesh through a solid model.
 *
 * @returns Brush preview mesh.
 */
function statusLabelBrushMeshCreate(): THREE.Mesh {
  const model = new SolidModel('StatusLabels');
  const mesh = model.addBoxBrush(1, SolidOperation.Additive, model.root, false).mesh;
  if (!mesh) throw new Error('brush has no mesh');
  return mesh;
}

/** Status texts of face mode. */
describe('face mode status labels', () => {
  it('names a single extrude product by kind and counts mixed products', () => {
    const brushMesh = statusLabelBrushMeshCreate();
    const plainMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    plainMesh.name = 'Plain';
    expect(faceModeStatusLabelExtrude([plainMesh])).toBe('Created mesh Plain');
    expect(faceModeStatusLabelExtrude([brushMesh])).toBe(`Created brush ${brushMesh.name}`);
    expect(faceModeStatusLabelExtrude([brushMesh, plainMesh])).toBe('Created 1 brush(es) and 1 mesh(es)');
    expect(faceModeStatusLabelExtrude([plainMesh, plainMesh.clone()])).toBe('Created 2 convex solids');
  });

  it('names selection modes and UV transform modes', () => {
    expect(faceModeStatusLabelSelectionMode(SelectionMode.FACE)).toBe('Face');
    expect(faceModeStatusLabelSelectionMode(SelectionMode.OBJECT)).toBe('Object');
    expect(faceModeStatusLabelUvTransform('move')).toContain('UV Move');
    expect(faceModeStatusLabelUvTransform('rotate')).toContain('UV Rotate');
    expect(faceModeStatusLabelUvTransform('scale')).toContain('UV Scale');
  });
});
