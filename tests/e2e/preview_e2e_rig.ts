import * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { previewGeometryEncodeGlb } from '@/preview/geometry/preview_geometry_encoder_glb.js';
import { PREVIEW_METHOD, type PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import type { PreviewCatalogEntries } from '@/preview/catalog/preview_catalog_entries.js';
import { PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT, previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';

/** Type path of Bevy's transform component in the remote protocol. */
const PREVIEW_E2E_TRANSFORM_COMPONENT = 'bevy_transform::components::transform::Transform';

/** Interval between two editor link updates, like the editor's own timer. */
const PREVIEW_E2E_TICK_MILLISECONDS = 33;

/** Interval between two checks of the game while waiting for a condition. */
const PREVIEW_E2E_CHECK_MILLISECONDS = 250;

/** Distance in meters within which a game light matches an editor light. */
export const PREVIEW_E2E_POSITION_TOLERANCE = 1e-3;

/** Base64 of a file that starts like a binary glTF but cannot be loaded. */
const PREVIEW_E2E_UNLOADABLE_GLB_BASE64 = btoa('glTF this is not a loadable binary gltf file');

/** What the game shows, read straight from the game. */
export interface PreviewE2eGameView {
  status: PreviewBridgeStatus;
  lightPositions: THREE.Vector3[];
}

/**
 * Waits for a number of milliseconds.
 *
 * @param milliseconds Time to wait.
 * @returns Promise resolved after the wait.
 */
export function previewE2eSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Drives the editor's real preview link against a running game: an editor
 * world, a controller ticked like the editor ticks it, and direct reads of the
 * game's status and light entities for checks.
 */
export class PreviewE2eRig {
  readonly world: THREE.Group;
  readonly controller: PreviewLinkController;
  readonly transport: PreviewLinkTransportHttp;
  readonly loadedCatalogs: PreviewCatalogEntries[] = [];
  /** Level name geometry is published under; may change between publications. */
  levelName: string;
  /**
   * Number of upcoming geometry publications that send an unloadable file
   * instead.
   */
  unloadableGeometryPublicationsRemaining = 0;

  /**
   * Creates a connected rig.
   *
   * @param world Editor world mirrored into the game.
   * @param endpoint Game bridge endpoint.
   * @param levelName Level name geometry is published under.
   */
  constructor(world: THREE.Group, endpoint: string, levelName: string) {
    this.world = world;
    this.levelName = levelName;
    this.transport = new PreviewLinkTransportHttp(endpoint);
    this.controller = new PreviewLinkController({
      worldGroup: world,
      transport: this.transport,
      geometryEncoder: (isGameMaterial) => this.geometryEncode(isGameMaterial),
      onCatalogLoaded: (catalog) => this.loadedCatalogs.push(catalog),
      clock: () => performance.now(),
      isEditInProgress: () => false,
      levelNameProvider: () => this.levelName,
    });
    this.controller.connect();
  }

  /**
   * Runs editor link updates for a while.
   *
   * @param milliseconds Time to keep updating.
   */
  async run(milliseconds: number): Promise<void> {
    const end = performance.now() + milliseconds;
    while (performance.now() < end) {
      this.world.updateMatrixWorld(true);
      await Promise.all(this.controller.tick());
      await previewE2eSleep(PREVIEW_E2E_TICK_MILLISECONDS);
    }
  }

  /**
   * Keeps updating until the game view satisfies a condition.
   *
   * @param description What is waited for, used in the timeout error.
   * @param condition Condition on the game view.
   * @param timeoutMilliseconds Longest wait.
   * @returns The game view that satisfied the condition.
   */
  async until(
    description: string,
    condition: (view: PreviewE2eGameView) => boolean,
    timeoutMilliseconds: number,
  ): Promise<PreviewE2eGameView> {
    const end = performance.now() + timeoutMilliseconds;
    let lastView: PreviewE2eGameView | null = null;
    while (performance.now() < end) {
      await this.run(PREVIEW_E2E_CHECK_MILLISECONDS);
      lastView = await this.gameViewRead().catch(() => null);
      if (lastView && condition(lastView)) {
        return lastView;
      }
    }
    throw new Error(
      `Timed out waiting for ${description}; last status: ${JSON.stringify(lastView?.status ?? null)}; link error: ${this.controller.lastErrorRead()}`,
    );
  }

  /**
   * Reads the game's status and light positions.
   *
   * @returns Current game view.
   */
  async gameViewRead(): Promise<PreviewE2eGameView> {
    const status = await this.transport.call<PreviewBridgeStatus>(PREVIEW_METHOD.status, {}, 5000);
    return { status, lightPositions: await this.gameLightPositionsRead() };
  }

  /**
   * Returns whether the game applied the newest state and geometry this rig
   * sent.
   *
   * @param view Game view.
   * @returns True when both revisions are applied and nothing is loading.
   */
  isCaughtUp(view: PreviewE2eGameView): boolean {
    const sent = this.controller.revisionsRead();
    const status = view.status;
    return (
      sent.state > 0 &&
      sent.geometry > 0 &&
      status.state_revision_applied === sent.state &&
      status.geometry_revision_applied === sent.geometry &&
      !status.geometry_loading
    );
  }

  /**
   * Returns whether the game's lights are exactly the given editor lights, by
   * world position.
   *
   * @param view Game view.
   * @param owners Editor light owners expected in the game.
   * @returns True when counts match and every owner has a game light at its
   *   position.
   */
  isShowingLights(view: PreviewE2eGameView, owners: readonly THREE.Object3D[]): boolean {
    this.world.updateMatrixWorld(true);
    const expected = owners.map((owner) => owner.getWorldPosition(new THREE.Vector3()));
    const remaining = [...view.lightPositions];
    for (const position of expected) {
      const index = remaining.findIndex((candidate) => candidate.distanceTo(position) < PREVIEW_E2E_POSITION_TOLERANCE);
      if (index < 0) {
        return false;
      }
      remaining.splice(index, 1);
    }
    return remaining.length === 0;
  }

  /**
   * Encodes the editor geometry, or an unloadable file while unloadable
   * publications are requested.
   *
   * @param isGameMaterial Tells whether the game draws a material id itself.
   * @returns Base64 of the file to publish.
   */
  private geometryEncode(isGameMaterial: (materialIdentifier: string) => boolean): Promise<string> {
    if (this.unloadableGeometryPublicationsRemaining > 0) {
      this.unloadableGeometryPublicationsRemaining -= 1;
      return Promise.resolve(PREVIEW_E2E_UNLOADABLE_GLB_BASE64);
    }
    return previewGeometryEncodeGlb(this.world, isGameMaterial);
  }

  /**
   * Queries the positions of every DynLight light entity in the game.
   *
   * @returns World positions.
   */
  private async gameLightPositionsRead(): Promise<THREE.Vector3[]> {
    const rows = await previewE2eEntityRowsQuery(this.transport, [
      PREVIEW_E2E_TRANSFORM_COMPONENT,
      PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
    ]);
    return rows.map((row) => {
      const transform = row.components[PREVIEW_E2E_TRANSFORM_COMPONENT] as { translation?: number[] } | undefined;
      const translation = transform?.translation ?? [Number.NaN, Number.NaN, Number.NaN];
      return new THREE.Vector3(translation[0], translation[1], translation[2]);
    });
  }
}
