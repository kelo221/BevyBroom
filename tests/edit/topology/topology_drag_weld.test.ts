import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { EditSession } from '@/edit/session/edit_session.js';
import { TopologyDragWeld } from '@/edit/topology/topology_drag_weld.js';
import { HandlerComponentTransform } from '@/edit/transform/handler_component_transform.js';
import { expandComponentSelectionToTransformVertices } from '@/edit/transform/component_transform_selection.js';
import type { ComponentSelectionEntry } from '@/edit/component/component_selection_entry.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TransformMode } from '@/types/transform_mode.js';
import { TransformModalAxis } from '@/transform/modal/transform_modal_axis.js';

/** Edge length of the test box. */
const BOX_SIZE = 2;

/** One edit session on a box brush with a drag handler using the weld. */
interface DragWeldFixture {
  session: EditSession;
  model: SolidModel;
  brushId: string;
  stack: CommandStack;
  handler: HandlerComponentTransform;
}

/**
 * Opens Edit Mode on a box with the drag weld wired into a drag handler.
 *
 * @returns Fixture.
 */
function fixtureCreate(): DragWeldFixture {
  const model = new SolidModel('DragWeld');
  const instance = model.addBoxBrush(BOX_SIZE, SolidOperation.Additive);
  const session = new EditSession();
  if (!session.enter([model.root])) {
    throw new Error('edit session did not open');
  }
  const stack = new CommandStack(32);
  const weld = new TopologyDragWeld({
    getSession: () => session,
    getCommandStack: () => stack,
    refreshPresentation: () => undefined,
    showStatusMessage: () => undefined,
  });
  const handler = new HandlerComponentTransform(new GridSnap(false, 0.25), stack);
  handler.setCommitCleanup(weld);
  return { session, model, brushId: instance.id, stack, handler };
}

/**
 * Reads the live brush of the fixture.
 *
 * @param fixture Fixture.
 * @returns Live brush.
 */
function brushRead(fixture: DragWeldFixture): SolidBrush {
  const instance = fixture.model.findBrush(fixture.brushId);
  if (!instance) {
    throw new Error('brush vanished');
  }
  return instance.brush;
}

/**
 * Selects the vertices of the box's top edge at its +X side.
 *
 * @param fixture Fixture.
 * @returns Selection entries.
 */
function topPositiveXEdgeSelect(fixture: DragWeldFixture): ComponentSelectionEntry[] {
  const vertices = brushRead(fixture).vertices;
  const maxX = Math.max(...vertices.map((vertex) => vertex.x));
  const maxY = Math.max(...vertices.map((vertex) => vertex.y));
  const domainTarget = fixture.session.getDomain()[0];
  return vertices
    .map((vertex, index) => ({ vertex, index }))
    .filter(({ vertex }) => Math.abs(vertex.x - maxX) < 1e-6 && Math.abs(vertex.y - maxY) < 1e-6)
    .map(({ index }) => ({ targetId: domainTarget?.targetId ?? '', kind: 'vertex', componentKey: String(index) }));
}

/**
 * Drags the selection by a numeric offset along Y, the way typing a distance
 * does.
 *
 * @param fixture Fixture.
 * @param selected Selection to drag.
 * @param offsetY World Y offset.
 */
function dragDown(fixture: DragWeldFixture, selected: ComponentSelectionEntry[], offsetY: number): void {
  const vertices = expandComponentSelectionToTransformVertices(selected, fixture.session.getDomain());
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const element = document.createElement('div');
  fixture.handler.beginSingleUseDrag(TransformMode.TRANSLATE, vertices, new THREE.Vector3(), camera, element, 0, 0);
  expect(fixture.handler.applyNumericValue(offsetY, TransformModalAxis.Y)).toBe(true);
  fixture.handler.commitIfNeeded();
}

/**
 * Proves dragging a box edge onto the opposite edge leaves a clean wedge in one
 * undo step.
 */
describe('TopologyDragWeld', () => {
  it('turns a box into a valid wedge when its top edge is dropped onto the bottom', () => {
    const fixture = fixtureCreate();
    dragDown(fixture, topPositiveXEdgeSelect(fixture), -BOX_SIZE);
    const wedge = brushRead(fixture);
    expect(wedge.vertices).toHaveLength(6);
    expect(wedge.faces).toHaveLength(5);
    expect(SolidBrushValidator.validate(wedge).valid).toBe(true);
  });

  it('undoes the drag and the weld together', () => {
    const fixture = fixtureCreate();
    dragDown(fixture, topPositiveXEdgeSelect(fixture), -BOX_SIZE);
    expect(fixture.stack.getUndoCount()).toBe(1);
    fixture.stack.undo();
    expect(brushRead(fixture).vertices).toHaveLength(8);
    expect(brushRead(fixture).faces).toHaveLength(6);
  });

  it('keeps a plain position step when nothing lands on another vertex', () => {
    const fixture = fixtureCreate();
    dragDown(fixture, topPositiveXEdgeSelect(fixture), -BOX_SIZE / 2);
    expect(brushRead(fixture).vertices).toHaveLength(8);
    expect(fixture.stack.getUndoCount()).toBe(1);
  });
});
