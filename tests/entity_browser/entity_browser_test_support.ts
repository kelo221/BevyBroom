import * as THREE from 'three';
import { vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { HandlerPrimitiveCreation } from '@/tools/creation/handler_primitive_creation.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';

/** A map built through the editor's own creation handler. */
export interface EntityBrowserTestEditor {
  /** Map root that receives new objects. */
  readonly world: THREE.Group;
  /** Creation handler the Add actions call. */
  readonly handler: HandlerPrimitiveCreation;
  /** Add menu actions wired to the handler; terrain and solid models are spies. */
  readonly actions: AddMenuActions;
  /** Camera the handler spawns in front of. */
  readonly camera: THREE.PerspectiveCamera;
}

/**
 * Builds a map root, a creation handler looking at it and Add menu actions
 * wired the way the editor wires them.
 *
 * @returns Test editor.
 */
export function entityBrowserTestEditorCreate(): EntityBrowserTestEditor {
  const world = new THREE.Group();
  const handler = new HandlerPrimitiveCreation(
    new ToolPrimitiveCreation(world),
    world,
    new CommandStack(16),
    new ManagerSelection(),
  );
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 2, 10);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld(true);
  handler.setActiveCameraProvider(() => camera);
  handler.setGridIntervalProvider(() => 0);
  return { world, handler, actions: entityBrowserTestActionsCreate(handler), camera };
}

/**
 * Creates Add menu actions that call a creation handler.
 *
 * @param handler Creation handler.
 * @returns Add menu actions.
 */
function entityBrowserTestActionsCreate(handler: HandlerPrimitiveCreation): AddMenuActions {
  return {
    onAddCube: () => handler.createCube(),
    onAddSphere: () => handler.createSphere(),
    onAddCylinder: () => handler.createCylinder(),
    onAddPlane: () => handler.createPlane(),
    onAddTerrain: vi.fn(),
    onAddSolidModel: vi.fn(),
    onAddBevelVolume: () => handler.createBevelVolume(),
    onAddPointLight: () => handler.createPointLight(),
    onAddSpotLight: () => handler.createSpotLight(),
    onAddRoom: () => handler.createRoom(),
    onAddPortal: () => handler.createPortal(),
    onAddEntityPlaced: (factory, objectRadius) => handler.entityCreatePlaced(factory, objectRadius),
  };
}

/**
 * Creates Add menu actions that only record their calls.
 *
 * @returns Spy actions.
 */
export function entityBrowserTestActionSpiesCreate(): AddMenuActions {
  return {
    onAddCube: vi.fn(),
    onAddSphere: vi.fn(),
    onAddCylinder: vi.fn(),
    onAddPlane: vi.fn(),
    onAddTerrain: vi.fn(),
    onAddSolidModel: vi.fn(),
    onAddBevelVolume: vi.fn(),
    onAddPointLight: vi.fn(),
    onAddSpotLight: vi.fn(),
    onAddRoom: vi.fn(),
    onAddPortal: vi.fn(),
    onAddEntityPlaced: vi.fn(),
  };
}

/**
 * Creates a catalog entry for view tests.
 *
 * @param id Entry id.
 * @param label Visible name.
 * @param category Category path.
 * @param categoryIndex Category order.
 * @param catalogIndex Entry order.
 * @returns Catalog entry whose activation does nothing.
 */
export function entityBrowserTestEntryCreate(
  id: string,
  label: string,
  category: string,
  categoryIndex: number,
  catalogIndex: number,
): EntityBrowserCatalogEntry {
  return {
    id,
    label,
    category,
    categoryIndex,
    catalogIndex,
    iconName: null,
    iconColor: null,
    tooltip: '',
    objectMatches: null,
    activate: vi.fn(),
  };
}

/**
 * Returns the direct children of a map root that are not in a given list.
 *
 * @param world Map root.
 * @param before Children that existed before.
 * @returns New children.
 */
export function entityBrowserTestNewChildren(
  world: THREE.Object3D,
  before: readonly THREE.Object3D[],
): THREE.Object3D[] {
  return world.children.filter((child) => !before.includes(child));
}
