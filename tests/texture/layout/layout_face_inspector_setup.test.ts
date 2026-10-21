import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { faceInspectorSetup, type FaceInspectorSetupResult } from '@/texture/layout/layout_face_inspector_setup.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { createContentMaterial } from '@/materials/factory_content_material.js';
import { buildTargetsFromFaceSelection, initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { createDefaultFaceTextureMapping, type FaceTextureMappingTrs } from '@/texture/uv/face_texture_mapping.js';
import { CommandTextureFaceApply } from '@/texture/commands/command_texture_face_apply.js';
import { readContentMeshTextureId } from '@/texture/uv/content_mesh_texture.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import { createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { setTextureMapCacheForTests, TextureMapCache } from '@/texture/library/texture_map_cache.js';
import { mockObjectUrlApis } from '../library/utils_object_url_test.js';

/**
 * Proves the Face tab end to end inside the editor: the attribute fields show
 * the selected face's mapping, typing a field pushes an undoable UV command,
 * and choosing a filtered material assigns it to the selection.
 */
describe('faceInspectorSetup', () => {
  let host: HTMLElement;
  let selection: ManagerSelection;
  let faceController: ControllerFaceExtrusion;
  let commandStack: CommandStack;
  let afterSurfaceChange: ReturnType<typeof vi.fn<() => void>>;
  let result: FaceInspectorSetupResult;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    mockObjectUrlApis('blob:face-inspector');
    setStateTexturePaintForTests(new StateTexturePaint());
    setTextureMapCacheForTests(new TextureMapCache());
    const world = new THREE.Group();
    selection = new ManagerSelection();
    commandStack = new CommandStack(64);
    faceController = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), world);
    afterSurfaceChange = vi.fn<() => void>();
    mesh = createTexturedBox(world);
    result = faceInspectorSetup({
      selectionManager: selection,
      faceController,
      commandStack,
      statusBar: null,
      afterSurfaceChange,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(result.faceInspector.getElement());
  });

  afterEach(() => {
    result.faceInspector.dispose();
    result.textureBrowserController.dispose();
    host.remove();
    setStateTexturePaintForTests(null);
    setTextureMapCacheForTests(null);
    vi.restoreAllMocks();
  });

  it('shows the selected face mapping in the attribute fields', () => {
    selectFirstFace();
    const appliedTrs: Partial<FaceTextureMappingTrs> = { scaleU: 2, offsetV: 0.25, rotationDeg: 30 };
    commandStack.push(
      new CommandTextureFaceApply(
        buildTargetsFromFaceSelection(faceController.getSelectedFaces()),
        createDefaultFaceTextureMapping(),
        {
          partialTrs: appliedTrs,
        },
      ),
    );
    result.faceInspector.refreshFromSelection();
    expect(fieldNumber('X Scale')).toBeCloseTo(appliedTrs.scaleU ?? Number.NaN, 4);
    expect(fieldNumber('Y Offset')).toBeCloseTo(appliedTrs.offsetV ?? Number.NaN, 4);
    expect(fieldNumber('Rotation')).toBeCloseTo(appliedTrs.rotationDeg ?? Number.NaN, 3);
    expect(host.textContent).toContain('1 face region(s)');
  });

  it('refreshes the fields when the face selection changes', () => {
    expect(host.textContent).toContain('No surfaces selected');
    selectFirstFace();
    expect(host.textContent).toContain('1 face region(s)');
  });

  it('pushes an undoable command when a field is edited', () => {
    selectFirstFace();
    const offsetBefore = fieldNumber('X Offset');
    const typedOffset = offsetBefore + 0.5;
    const undoCountBefore = commandStack.getUndoCount();
    commitFieldText('X Offset', String(typedOffset));
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    expect(afterSurfaceChange).toHaveBeenCalled();
    expect(fieldNumber('X Offset')).toBeCloseTo(typedOffset, 4);
    commandStack.undo();
    result.faceInspector.refreshFromSelection();
    expect(fieldNumber('X Offset')).toBeCloseTo(offsetBefore, 4);
  });

  it('applies a filtered material to the selected object with undo', () => {
    selection.selectObject(mesh);
    faceController.setSelectionMode(SelectionMode.OBJECT);
    const rock = createTextureBrowserEntry(new File(['r'], 'rock.png', { type: 'image/png' }), 'cave/rock.png');
    const metal = createTextureBrowserEntry(new File(['m'], 'metal.png', { type: 'image/png' }), 'base/metal.png');
    result.textureBrowserController.applyEntries('Pack', [rock, metal]);
    result.faceInspector.getMaterialBrowser().setFilterText('rock');
    expect(listedEntryIds()).toEqual([rock.id]);
    tile(rock.id).click();
    expect(readContentMeshTextureId(mesh)).toBe(rock.id);
    expect(commandStack.getUndoCount()).toBe(1);
    expect(afterSurfaceChange).toHaveBeenCalled();
    expect(host.querySelector('[data-material-name="true"]')?.textContent).toBe(rock.displayName);
    commandStack.undo();
    expect(readContentMeshTextureId(mesh)).toBe(DEFAULT_CHECKER_TEXTURE_ID);
  });

  /** Enters face mode on the box and selects its first triangle. */
  function selectFirstFace(): void {
    faceController.setAvailableMeshes([mesh]);
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, 0, false);
  }

  /**
   * Returns the field with an accessible name.
   *
   * @param ariaLabel Field accessible name.
   * @returns Input element.
   */
  function field(ariaLabel: string): HTMLInputElement {
    const input = host.querySelector(`input[aria-label="${ariaLabel}"]`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Missing field ${ariaLabel}`);
    return input;
  }

  /**
   * Parses the number shown in a field.
   *
   * @param ariaLabel Field accessible name.
   * @returns Shown number.
   */
  function fieldNumber(ariaLabel: string): number {
    return Number(field(ariaLabel).value);
  }

  /**
   * Types text into a field and commits it with a change event.
   *
   * @param ariaLabel Field accessible name.
   * @param text Typed text.
   */
  function commitFieldText(ariaLabel: string, text: string): void {
    const input = field(ariaLabel);
    input.value = text;
    input.dispatchEvent(new Event('change'));
  }

  /**
   * Returns the ids of the listed material tiles.
   *
   * @returns Entry ids in grid order.
   */
  function listedEntryIds(): string[] {
    return Array.from(host.querySelectorAll<HTMLElement>('[data-entry-id]')).map(
      (element) => element.dataset['entryId'] ?? '',
    );
  }

  /**
   * Returns the tile of a material.
   *
   * @param entryId Entry id.
   * @returns Tile element.
   */
  function tile(entryId: string): HTMLElement {
    const element = host.querySelector(`[data-entry-id="${entryId}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing tile ${entryId}`);
    return element;
  }
});

/**
 * Creates a checker-textured unit box in the world.
 *
 * @param world World group that owns the box.
 * @returns Box mesh.
 */
function createTexturedBox(world: THREE.Group): THREE.Mesh {
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createContentMaterial(0x888888));
  box.updateMatrixWorld(true);
  initializeMeshTextureUVs(box, DEFAULT_CHECKER_TEXTURE_ID);
  world.add(box);
  return box;
}
