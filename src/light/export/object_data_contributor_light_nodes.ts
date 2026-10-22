import type * as THREE from 'three';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { LightExportNodeBuilder } from '@/light/export/light_export_node_builder.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';

/** Exports lights as DynLight light nodes when the export asks for them. */
export class ObjectDataContributorLightNodes extends ObjectDataContributor {
  readonly contributorName = 'light_nodes';

  /**
   * Returns the DynLight light node of a light owner.
   *
   * @param owner Entity owner.
   * @param options Export behavior switches.
   * @returns The light node, or null for other owners, disabled lights or when
   *   the export leaves lights out.
   */
  override exportEntityChildrenCreate(owner: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D[] | null {
    if (options.includeLightNodes !== true) {
      return null;
    }
    const node = LightExportNodeBuilder.lightNodeCreate(owner);
    return node === null ? null : [node];
  }
}
