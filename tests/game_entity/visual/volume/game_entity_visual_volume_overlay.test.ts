import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY } from '@/entity/visual/entity_visual_text_plane.js';
import { shouldOmitFromExport } from '@/io/scene/export_object_omission.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualVolumeFollower } from '@/game_entity/visual/volume/game_entity_visual_volume_follower.js';
import { GameEntityVisualVolumeOverlay } from '@/game_entity/visual/volume/game_entity_visual_volume_overlay.js';
import {
  GAME_ENTITY_VOLUME_BAND_INDEX_KEY,
  GAME_ENTITY_VOLUME_PART_ROLE_KEY,
  type GameEntityVolumePartRole,
} from '@/game_entity/visual/volume/game_entity_visual_volume_overlay_builder.js';
import { GAME_ENTITY_VOLUME_LABEL_SEPARATOR } from '@/game_entity/visual/volume/game_entity_visual_volume_spec.js';
import { testClassesInstall } from '../../game_entity_test_classes.js';
import {
  TEST_AISLE_BLOCKED_PATH,
  TEST_AISLE_CATEGORIES_PATH,
  TEST_AISLE_CEREAL_LABEL,
  testAisleBrushCreate,
  testAisleClassListCreate,
  testAisleOverridesWrite,
} from './game_entity_visual_volume_test_support.js';

/** Three categories in a deliberately unsorted order. */
const THREE_CATEGORIES = ['tins', 'cereal', 'bottles'];

/**
 * Returns the parts of one role in one plan drawing of a volume, sorted by band
 * index when they carry one.
 *
 * @param volume Volume mesh.
 * @param role Part role.
 * @returns Parts of the floor drawing then the roof drawing.
 */
function partsOf(volume: THREE.Object3D, role: GameEntityVolumePartRole): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [];
  GameEntityVisualVolumeOverlay.find(volume)?.traverse((part) => {
    if (part.userData[GAME_ENTITY_VOLUME_PART_ROLE_KEY] === role) {
      parts.push(part);
    }
  });
  return parts;
}

/**
 * Returns the bands of a volume's floor drawing (the ones below its middle), in
 * band order, with their centers in the volume's local space.
 *
 * @param volume Volume mesh.
 * @returns Band index and local center of each floor band.
 */
function floorBandsOf(volume: THREE.Mesh): { index: number; center: THREE.Vector3 }[] {
  volume.updateMatrixWorld(true);
  const bands = partsOf(volume, 'band').map((band) => ({
    index: band.userData[GAME_ENTITY_VOLUME_BAND_INDEX_KEY] as number,
    center: volume.worldToLocal(band.getWorldPosition(new THREE.Vector3())),
  }));
  const middleHeight = volume.geometry.boundingBox?.getCenter(new THREE.Vector3()).y ?? 0;
  return bands.filter((band) => band.center.y < middleHeight).sort((first, second) => first.index - second.index);
}

/**
 * Creates an aisle brush placed and turned away from the world axes.
 *
 * @param size Local edge lengths.
 * @param overrides Aisle field overrides.
 * @returns Brush mesh with its volume marker drawn.
 */
function aisleVolumeCreate(size: THREE.Vector3, overrides: Record<string, unknown>): THREE.Mesh {
  const brush = testAisleBrushCreate(size, overrides);
  brush.position.set(4, 1, -7);
  brush.rotation.set(0, Math.PI / 3, 0);
  GameEntityVisualVolumeOverlay.refresh(brush);
  return brush;
}

/**
 * The volume marker draws its runs as equal floor bands along the volume's
 * longer local horizontal axis, labels them and the volume, hatches it while
 * blocked, follows edits and never leaves the editor.
 */
describe('GameEntityVisualVolumeOverlay', () => {
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = testClassesInstall(testAisleClassListCreate()).uninstall;
  });

  afterEach(() => uninstall());

  it('draws one band per category in list order from the negative end of the longer local axis', () => {
    const size = new THREE.Vector3(9, 2.5, 3);
    const volume = aisleVolumeCreate(size, { [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES });
    const bands = floorBandsOf(volume);
    expect(bands.map((band) => band.index)).toEqual([0, 1, 2]);
    expect(partsOf(volume, 'band')).toHaveLength(THREE_CATEGORIES.length * 2);
    bands.forEach((band) => {
      expect(band.center.x).toBeCloseTo(-size.x / 2 + (size.x / 3) * (band.index + 0.5));
      expect(band.center.z).toBeCloseTo(0);
    });
  });

  it('follows local Z when the volume is deeper than it is wide', () => {
    const size = new THREE.Vector3(2, 1, 8);
    const volume = aisleVolumeCreate(size, { [TEST_AISLE_CATEGORIES_PATH]: ['cereal', 'tins'] });
    const centers = floorBandsOf(volume).map((band) => band.center);
    expect(centers.map((center) => center.z)).toEqual([expect.closeTo(-2), expect.closeTo(2)]);
    centers.forEach((center) => expect(center.x).toBeCloseTo(0));
  });

  it('labels each band with its number and variant label, and the volume with every label', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(9, 2, 3), { [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES });
    const bandTexts = partsOf(volume, 'band_label').map((label) =>
      String(label.userData[ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY]),
    );
    expect(bandTexts).toContain(`2  ${TEST_AISLE_CEREAL_LABEL}`);
    expect(bandTexts.filter((text) => text.startsWith('1 '))).toHaveLength(2);
    const labelTexts = partsOf(volume, 'label').map((label) =>
      String(label.userData[ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY]),
    );
    expect(labelTexts[0]?.split(GAME_ENTITY_VOLUME_LABEL_SEPARATOR)).toHaveLength(THREE_CATEGORIES.length);
    expect(labelTexts[0]).toContain(TEST_AISLE_CEREAL_LABEL);
  });

  it('hatches the volume only while it is blocked and follows the change', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(6, 2, 2), { [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES });
    expect(partsOf(volume, 'hatch')).toHaveLength(0);
    testAisleOverridesWrite(volume, {
      [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES,
      [TEST_AISLE_BLOCKED_PATH]: true,
    });
    GameEntityVisualVolumeOverlay.refresh(volume);
    expect(partsOf(volume, 'hatch').length).toBeGreaterThan(0);
  });

  it('draws the bands again when categories are added, removed or reordered', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(6, 2, 2), { [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES });
    const reordered = [...THREE_CATEGORIES].reverse().slice(1);
    testAisleOverridesWrite(volume, { [TEST_AISLE_CATEGORIES_PATH]: reordered });
    GameEntityVisualVolumeOverlay.refresh(volume);
    expect(floorBandsOf(volume)).toHaveLength(reordered.length);
    const labels = partsOf(volume, 'band_label').map((label) =>
      String(label.userData[ENTITY_VISUAL_TEXT_PLANE_TEXT_KEY]),
    );
    expect(labels).toContain(`1  ${TEST_AISLE_CEREAL_LABEL}`);
  });

  it('follows a new shape of the volume', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(6, 2, 2), { [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES });
    volume.geometry = new THREE.BoxGeometry(2, 2, 12);
    GameEntityVisualVolumeOverlay.refresh(volume);
    const centers = floorBandsOf(volume).map((band) => band.center);
    expect(centers[0]?.z).toBeCloseTo(-4);
    expect(centers[0]?.x).toBeCloseTo(0);
  });

  it('removes the drawing when the component goes', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(6, 2, 2), {});
    expect(GameEntityVisualVolumeOverlay.find(volume)).not.toBeNull();
    GameEntityComponentStore.write(volume, {});
    GameEntityVisualVolumeOverlay.refresh(volume);
    expect(
      volume.children.filter((child) => child.name === GameEntityVisualVolumeOverlay.find(volume)?.name),
    ).toHaveLength(0);
    expect(GameEntityVisualVolumeOverlay.find(volume)).toBeNull();
  });

  it('keeps every part of the drawing out of exports and picking', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(6, 2, 2), { [TEST_AISLE_BLOCKED_PATH]: true });
    const overlay = GameEntityVisualVolumeOverlay.find(volume);
    const parts: THREE.Object3D[] = [];
    overlay?.traverse((part) => parts.push(part));
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part) => expect(shouldOmitFromExport(part)).toBe(true));
    const hits: THREE.Intersection[] = [];
    const raycaster = new THREE.Raycaster(new THREE.Vector3(4, 50, -7), new THREE.Vector3(0, -1, 0));
    parts.forEach((part) => part.raycast(raycaster, hits));
    expect(hits).toEqual([]);
  });

  it('gives a copy of a volume its own drawing instead of the copied one', () => {
    const volume = aisleVolumeCreate(new THREE.Vector3(6, 2, 2), {});
    const copy = volume.clone();
    GameEntityVisualVolumeOverlay.refresh(copy);
    const overlays = copy.children.filter((child) => child.name === GameEntityVisualVolumeOverlay.find(copy)?.name);
    expect(overlays).toHaveLength(1);
    expect(GameEntityVisualVolumeOverlay.find(copy)).not.toBeNull();
  });

  it('draws volumes in the scene whenever the undo history changes', () => {
    const world = new THREE.Group();
    const commandStack = new CommandStack(10);
    const stopFollowing = new GameEntityVisualVolumeFollower(world).follow(commandStack);
    const brush = testAisleBrushCreate(new THREE.Vector3(6, 2, 2), { [TEST_AISLE_CATEGORIES_PATH]: THREE_CATEGORIES });
    world.add(brush);
    expect(GameEntityVisualVolumeOverlay.find(brush)).toBeNull();
    commandStack.notifyChanged();
    expect(floorBandsOf(brush)).toHaveLength(THREE_CATEGORIES.length);
    stopFollowing();
  });
});
