import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import {
  surfaceUvFullTileShift,
  surfaceUvVectors2x3Read,
  surfaceUvVectors2x3Write,
} from '@/texture/uv_matrix/surface_uv_matrix_vectors.js';
import { FaceUvOperationFit } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { createDefaultFaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import { createCombinedWorldPolygonTargetContextFactory } from '@/texture/uv/operations/face_uv_operation_context_combined.js';
import { DialogFaceEditSheet } from '@/texture/ui/face_edit_sheet/dialog_face_edit_sheet.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';
import { FACE_ATTRIBUTES_ROW_SCALE } from '@/texture/ui/face_attributes/face_attributes_field_specs.js';
import {
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestSelectionCreate,
  faceEditSheetTestStateReset,
  type FaceEditSheetTestHandlers,
} from './face_edit_sheet_test_support.js';

describe('Wave 2C: Face Edit Sheet, 2x3 UV Vectors, Full-Tile Shift, and Treat as One', () => {
  it('reads and writes 2x3 UV axis vectors while preserving scale and shifts by full tiles', () => {
    const base = new SurfaceUvMatrix(new THREE.Vector4(2, 0, 0, 0.25), new THREE.Vector4(0, 4, 0, -0.5));
    const vectors = surfaceUvVectors2x3Read(base);
    expect(vectors.uAxis).toEqual([1, 0, 0]);
    expect(vectors.vAxis).toEqual([0, 1, 0]);

    const rotated = surfaceUvVectors2x3Write(base, {
      uAxis: [0, 0, -1],
      vAxis: [0, 1, 0],
    });
    expect(Math.hypot(rotated.u.x, rotated.u.y, rotated.u.z)).toBeCloseTo(2, 5);
    expect(rotated.u.z).toBeCloseTo(-2, 5);
    expect(rotated.u.w).toBeCloseTo(0.25, 5);

    const shifted = surfaceUvFullTileShift(rotated, 1, -2);
    expect(shifted.u.w).toBeCloseTo(1.25, 5);
    expect(shifted.v.w).toBeCloseTo(-2.5, 5);
  });

  it('fits multiple faces across their combined world bounds when Treat as one is enabled', () => {
    const geomA = new THREE.PlaneGeometry(2, 2);
    geomA.translate(-1, 0, 0);
    const meshA = new THREE.Mesh(geomA);
    const geomB = new THREE.PlaneGeometry(2, 2);
    geomB.translate(1, 0, 0);
    const meshB = new THREE.Mesh(geomB);

    const firstTarget = { mesh: meshA, triangleIndices: [0, 1], previousMapping: createDefaultFaceTextureMapping() };
    const secondTarget = { mesh: meshB, triangleIndices: [0, 1], previousMapping: createDefaultFaceTextureMapping() };
    const targets = [firstTarget, secondTarget];
    const factory = createCombinedWorldPolygonTargetContextFactory(targets, null);
    const ctxA = factory(firstTarget);
    expect(ctxA).not.toBeNull();
    if (ctxA) {
      const fitOp = new FaceUvOperationFit({ axis: 'both' });
      const fitted = fitOp.apply(SurfaceUvMatrix.identity(), ctxA);
      expect(fitted.u.x).toBeCloseTo(0.25, 4);
      expect(fitted.v.y).toBeCloseTo(0.5, 4);
    }
  });
});

describe('DialogFaceEditSheet', () => {
  let host: HTMLElement;
  let handlers: FaceEditSheetTestHandlers;
  let sheet: DialogFaceEditSheet;

  beforeEach(() => {
    faceEditSheetTestStateReset();
    FloatingPanelStack.resetForTests();
    host = document.createElement('div');
    document.body.appendChild(host);
    handlers = faceEditSheetTestHandlersCreate();
    sheet = new DialogFaceEditSheet(host, faceEditSheetTestHandlersAsSheetHandlers(handlers));
  });

  afterEach(() => {
    sheet.dispose();
    host.remove();
    FloatingPanelStack.resetForTests();
    faceEditSheetTestStateReset();
  });

  it('opens and closes with the session and writes the session when closed', () => {
    const session = getStateFaceEditSession();
    session.sheetOpenWrite(true);
    expect(sheet.isOpen()).toBe(true);
    sheet.hide();
    expect(session.sheetOpenRead()).toBe(false);
    session.sheetOpenWrite(true);
    session.sheetOpenWrite(false);
    expect(sheet.isOpen()).toBe(false);
  });

  it('shows the Hammer Material layout with the extra tools collapsed', () => {
    getStateFaceEditSession().sheetOpenWrite(true);
    const text = host.textContent ?? '';
    [
      'Texture scale:',
      'Texture shift:',
      'Rotation:',
      'UV vectors (X Y Z):',
      'Justify',
      'Align',
      'Treat as one',
    ].forEach((caption) => expect(text).toContain(caption));
    const moreToolsBody = host.querySelector<HTMLElement>('.face-edit-sheet-more-tools-body');
    expect(moreToolsBody?.style.display).toBe('none');
    expect(host.querySelector('.face-edit-sheet-full-tile-shift-row')).not.toBeNull();
  });

  it('shows the current texture in the texture list and follows changes', () => {
    const textureId = `test/brick_${Math.random().toString(36).slice(2)}`;
    getStateFaceEditSession().sheetOpenWrite(true);
    getStateTexturePaint().setLastTextureId(textureId);
    const select = host.querySelector<HTMLSelectElement>('select.face-edit-sheet-texture-select');
    expect(select?.value).toBe(textureId);
  });

  it('passes the selection to the Material tab fields', () => {
    const scaleXSpec = FACE_ATTRIBUTES_ROW_SCALE.fields[0];
    if (!scaleXSpec) throw new Error('missing scale X spec');
    const shownScale = 3.25;
    sheet.selectionWrite(faceEditSheetTestSelectionCreate({ [scaleXSpec.key]: shownScale }));
    const sheetInput = sheet
      .getRootElement()
      .querySelector<HTMLInputElement>(`input[aria-label="${scaleXSpec.ariaLabel}"]`);
    expect(sheetInput).not.toBeNull();
    expect(Number.parseFloat(sheetInput?.value ?? '')).toBeCloseTo(shownScale, 6);
  });

  it('opens centered without a backdrop and keeps a moved position when reopened', () => {
    getStateFaceEditSession().sheetOpenWrite(true);
    expect(sheet.getBackdropElement()).toBeNull();
    const root = sheet.getRootElement();
    const movedLeft = `${parseFloat(root.style.left) + 41}px`;
    root.style.left = movedLeft;
    getStateFaceEditSession().sheetOpenWrite(false);
    getStateFaceEditSession().sheetOpenWrite(true);
    expect(root.style.left).toBe(movedLeft);
  });

  it('keeps the Displacement tab body available for its panel', () => {
    const displacementPanel = document.createElement('div');
    sheet.displacementTabBodyRead().appendChild(displacementPanel);
    getStateFaceEditSession().activeTabIdWrite('displacement');
    getStateFaceEditSession().sheetOpenWrite(true);
    expect(sheet.getRootElement().contains(displacementPanel)).toBe(true);
  });
});
