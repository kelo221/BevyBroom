import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import type { SprinkleDefinition, SprinkleDefinitionCase } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import {
  StateSprinkleDefinitionLibrary,
  setStateSprinkleDefinitionLibraryForTests,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import type { SprinkleStrokeServices } from '@/tools/sprinkle/stroke/sprinkle_stroke_factory.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall } from '../../game_entity/game_entity_test_classes.js';

/** Name of the sprinkle definition the test library holds. */
export const SPRINKLE_TEST_DEFINITION_NAME = 'test_doors';

/** Entity class id of the door test class, which the test definition places. */
export const SPRINKLE_TEST_DOOR_CLASS_ID = gameEntityClassIdOf(TEST_DOOR_TYPE_PATH);

/** Component overrides the test definition's case writes. */
export const SPRINKLE_TEST_CASE_COMPONENTS: GameEntityComponents = { [TEST_DOOR_TYPE_PATH]: { speed: 4.25 } };

/** World, floor, undo stack and stroke services of one sprinkle test. */
export interface SprinkleTestScene {
  world: THREE.Group;
  floor: THREE.Mesh;
  commandStack: CommandStack;
  services: SprinkleStrokeServices;
  statusMessages: string[];
  mutationCount: { value: number };
}

/**
 * Builds a world holding one flat box floor centered on a point.
 *
 * @param floorCenter World center of the floor's top face.
 * @param floorSize Side length of the floor along X and Z.
 * @returns Test scene with services that record status messages and refreshes.
 */
export function sprinkleTestSceneCreate(floorCenter: THREE.Vector3, floorSize: number): SprinkleTestScene {
  const world = new THREE.Group();
  const floorThickness = floorSize / 8;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorSize, floorThickness, floorSize));
  floor.position.copy(floorCenter).setY(floorCenter.y - floorThickness / 2);
  world.add(floor);
  world.updateMatrixWorld(true);
  const commandStack = new CommandStack(64);
  const statusMessages: string[] = [];
  const mutationCount = { value: 0 };
  const services: SprinkleStrokeServices = {
    commandStack,
    worldObject: world,
    statusShow: (message) => statusMessages.push(message),
    afterWorldMutation: () => {
      mutationCount.value += 1;
    },
  };
  return { world, floor, commandStack, services, statusMessages, mutationCount };
}

/** Side length, in pixels, of the fake viewport element. */
export const SPRINKLE_TEST_VIEW_SIZE_PX = 200;

/** Camera and element of a fake viewport whose center looks at a point. */
export interface SprinkleTestView {
  camera: THREE.PerspectiveCamera;
  pickElement: HTMLElement;
  /** Client X of the element center. */
  centerClientX: number;
  /** Client Y of the element center. */
  centerClientY: number;
  /** Returns the view as a viewport. */
  getCamera(): THREE.Camera;
  /** Returns the view element. */
  getContentElement(): HTMLElement;
}

/**
 * Builds a camera that looks at a point from along a direction and a fake
 * viewport element, so a pick ray through the element center passes through the
 * point.
 *
 * @param target World point the center ray must pass through.
 * @param from Direction from the target to the camera.
 * @param distance Camera distance from the target.
 * @returns Fake viewport.
 */
export function sprinkleTestViewCreate(target: THREE.Vector3, from: THREE.Vector3, distance: number): SprinkleTestView {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.copy(target).addScaledVector(from.clone().normalize(), distance);
  camera.up.set(0, 0, -1);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const pickElement = document.createElement('div');
  const size = SPRINKLE_TEST_VIEW_SIZE_PX;
  pickElement.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: size, bottom: size, width: size, height: size }) as DOMRect;
  return {
    camera,
    pickElement,
    centerClientX: size / 2,
    centerClientY: size / 2,
    getCamera: () => camera,
    getContentElement: () => pickElement,
  };
}

/**
 * Returns the world height of a mesh's top face.
 *
 * @param mesh Mesh.
 * @returns Largest world Y of the mesh bounds.
 */
export function sprinkleTestTopHeightRead(mesh: THREE.Mesh): number {
  return new THREE.Box3().setFromObject(mesh).max.y;
}

/**
 * Builds a definition case.
 *
 * @param className Entity class id.
 * @param weight Relative chance.
 * @param components Component overrides.
 * @returns Case.
 */
export function sprinkleTestCaseCreate(
  className: string,
  weight: number = 1,
  components: GameEntityComponents = SPRINKLE_TEST_CASE_COMPONENTS,
): SprinkleDefinitionCase {
  return { weight, className, components };
}

/**
 * Builds a definition.
 *
 * @param cases Weighted cases.
 * @param gridSize Cell size along both axes, or null for no definition grid.
 * @param name Definition name.
 * @returns Definition.
 */
export function sprinkleTestDefinitionCreate(
  cases: readonly SprinkleDefinitionCase[] = [sprinkleTestCaseCreate(SPRINKLE_TEST_DOOR_CLASS_ID)],
  gridSize: number | null = 1,
  name: string = SPRINKLE_TEST_DEFINITION_NAME,
): SprinkleDefinition {
  const grid = gridSize === null ? null : { sizeU: gridSize, sizeV: gridSize };
  return { name, sourcePath: `sprinkle/${name}.txt`, grid, cases };
}

/**
 * Installs the door game classes and a definition library holding the given
 * definitions as the shared ones.
 *
 * @param definitions Definitions the library holds.
 * @returns Function that removes both again.
 */
export function sprinkleTestLibraryInstall(
  definitions: readonly SprinkleDefinition[] = [sprinkleTestDefinitionCreate()],
): () => void {
  const classes = testClassesInstall();
  const library = new StateSprinkleDefinitionLibrary();
  library.contentsWrite({ definitions, problems: [] });
  setStateSprinkleDefinitionLibraryForTests(library);
  return () => {
    setStateSprinkleDefinitionLibraryForTests(null);
    classes.uninstall();
  };
}
