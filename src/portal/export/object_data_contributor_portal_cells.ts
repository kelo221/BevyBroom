import type * as THREE from 'three';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import { PortalExportCellBuilder } from '@/portal/export/portal_export_cell_builder.js';

/**
 * Exports rooms and portals as DynLight cell nodes when the export asks for
 * them.
 */
export class ObjectDataContributorPortalCells extends ObjectDataContributor {
  readonly contributorName = 'portal_cells';

  /**
   * Returns the DynLight cell node of a room or portal owner.
   *
   * @param owner Entity owner.
   * @param options Export behavior switches.
   * @returns The cell node, or null for other owners or when the export leaves
   *   rooms and portals out.
   */
  override exportEntityChildrenCreate(owner: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D[] | null {
    if (options.includeRoomAndPortalNodes !== true) {
      return null;
    }
    const cell = PortalExportCellBuilder.cellCreate(owner);
    return cell === null ? null : [cell];
  }
}
