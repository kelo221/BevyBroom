import type * as THREE from 'three';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidModel } from '@/solid/model/solid_model.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';

/** Scene object an issue about a solid model or brush points at. */
export interface IssueProviderSolidTarget {
  /** Uuid of the object to select. */
  readonly objectUuid: string;
  /** Display name of the object. */
  readonly objectName: string;
}

/** Base of the providers that check solid models and their brushes. */
export abstract class IssueProviderSolid extends IssueProvider {
  /**
   * Lists the solid models under the world.
   *
   * @param worldGroup Editor world root.
   * @returns Solid models in scene order.
   */
  protected solidModelsList(worldGroup: THREE.Object3D): SolidModel[] {
    return Array.from(SolidModelRegistry.collectUnder(worldGroup));
  }

  /**
   * Returns the object to select for a problem of a model or one of its
   * brushes: the brush mesh when there is one, otherwise the model root.
   *
   * @param model Solid model.
   * @param brush Brush the problem is about, or null for the whole model.
   * @returns Target object.
   */
  protected solidTargetRead(model: SolidModel, brush: SolidBrushInstance | null): IssueProviderSolidTarget {
    if (brush === null) {
      return { objectUuid: model.root.uuid, objectName: model.root.name };
    }
    return { objectUuid: brush.mesh?.uuid ?? model.root.uuid, objectName: brush.name };
  }
}
