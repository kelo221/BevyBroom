import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildExportScene, type ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import type { GameProfile } from '@/settings/store/settings_types.js';
import { buildExportRootTransform } from '@/io/coordinates/coordinate_space_transform.js';

/**
 * Exports a Three.js scene group to binary GLB format. Filters out solid brush
 * helpers, selection overlays, and other editor internals so the file contains
 * only final content geometry. When a profile is supplied, its unit scale and
 * coordinate space conversion are applied to a temporary export root before
 * invoking GLTFExporter.
 */
export class GlbExporter {
  /**
   * Exports the given group to a GLB binary buffer.
   *
   * @param worldGroup The live editor world root to export.
   * @param profile Active game profile, or null to skip the conversion.
   * @param options Export scene behavior switches.
   * @returns A promise resolving to the GLB ArrayBuffer.
   */
  export(
    worldGroup: THREE.Group,
    profile: GameProfile | null = null,
    options: ExportSceneOptions = {},
  ): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const exportRoot = this.wrapForExport(worldGroup, profile, options);
      this.executeExport(exportRoot, options.includeHiddenObjects !== true, resolve, reject);
    });
  }

  /**
   * Exports the given group the way File > Export GLB writes it for games: with
   * lightmap UVs, light, room and portal nodes and game components in node
   * extras.
   *
   * @param worldGroup The live editor world root to export.
   * @param profile Active game profile, or null to skip the conversion.
   * @returns A promise resolving to the GLB ArrayBuffer.
   */
  exportForFile(worldGroup: THREE.Group, profile: GameProfile | null = null): Promise<ArrayBuffer> {
    return this.export(worldGroup, profile, {
      includeLightmapUvs: true,
      includeRoomAndPortalNodes: true,
      includeLightNodes: true,
      includeGameComponents: true,
    });
  }

  /**
   * Builds a filtered export graph and applies the optional profile transform.
   * The original world group remains untouched.
   *
   * @param worldGroup The original scene root.
   * @param profile Active game profile, or null.
   * @param options Export scene behavior switches.
   * @returns A wrapped group ready for GLTFExporter.
   */
  private wrapForExport(
    worldGroup: THREE.Group,
    profile: GameProfile | null,
    options: ExportSceneOptions,
  ): THREE.Group {
    const exportScene = buildExportScene(worldGroup, options);
    const transform = buildExportRootTransform(profile);
    if (transform.equals(new THREE.Matrix4())) {
      return exportScene;
    }
    const wrapper = new THREE.Group();
    wrapper.name = 'ExportRoot';
    wrapper.matrixAutoUpdate = false;
    wrapper.matrix.copy(transform);
    wrapper.add(exportScene);
    return wrapper;
  }

  /**
   * Executes the GLTFExporter callback and resolves the promise.
   *
   * @param exportRoot The group to export.
   * @param onlyVisible True to leave hidden objects out of the file.
   * @param resolve The promise resolve function.
   * @param reject The promise reject function.
   */
  private executeExport(
    exportRoot: THREE.Group,
    onlyVisible: boolean,
    resolve: (buffer: ArrayBuffer) => void,
    reject: (error: Error) => void,
  ): void {
    const exporter = new GLTFExporter();
    exporter.parse(
      exportRoot,
      (result) => this.onExportSuccess(result, resolve),
      (error) => this.onExportError(error, reject),
      { binary: true, onlyVisible },
    );
  }

  /**
   * Handles successful export by resolving with the result buffer.
   *
   * @param result The export result, expected to be an ArrayBuffer.
   * @param resolve The promise resolve function.
   */
  private onExportSuccess(result: ArrayBuffer | object, resolve: (buffer: ArrayBuffer) => void): void {
    if (result instanceof ArrayBuffer) {
      resolve(result);
      return;
    }
    resolve(new ArrayBuffer(0));
  }

  /**
   * Handles export errors by rejecting with the error message.
   *
   * @param error The error thrown by GLTFExporter.
   * @param reject The promise reject function.
   */
  private onExportError(error: unknown, reject: (error: Error) => void): void {
    if (error instanceof Error) {
      reject(error);
      return;
    }
    reject(new Error(String(error)));
  }
}
