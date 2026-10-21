import * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SolidModelCodec, type SerializedSolidModel } from '@/solid/io/solid_model_codec.js';
import { solidSerializedTransformAssignFromMatrix } from '@/solid/io/solid_model_codec_transform.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { selectionRootsClassify } from '@/selection/object/selection_roots_classify.js';
import { sortObjectsBySceneOrder } from '@/utils/utils_hierarchy.js';
import { clipboardBoundsMeasure, clipboardBoundsToPayload } from '@/clipboard/payload/clipboard_payload_bounds.js';
import {
  CLIPBOARD_PAYLOAD_FORMAT,
  CLIPBOARD_PAYLOAD_VERSION,
  type ClipboardPayload,
} from '@/clipboard/payload/clipboard_payload_types.js';

/** Copied hierarchy roots split by how the payload stores them. */
interface ClipboardEncoderRoots {
  /** Solid models, entity owners, meshes and plain groups. */
  readonly objectRoots: THREE.Object3D[];
  /** Brush meshes and solid CSG groups inside solid models. */
  readonly brushNodes: THREE.Object3D[];
}

/** Writes selected hierarchy roots into a clipboard payload. */
export class ClipboardPayloadEncoder {
  /**
   * Encodes hierarchy roots. Solid result meshes are skipped; brushes and solid
   * CSG groups are copied out of their solid models.
   *
   * @param roots Outermost selected hierarchy roots.
   * @returns The payload, or null when nothing copyable was given.
   */
  static encode(roots: readonly THREE.Object3D[]): ClipboardPayload | null {
    const split = this.rootsSplit(roots);
    if (split.objectRoots.length === 0 && split.brushNodes.length === 0) {
      return null;
    }
    return {
      format: CLIPBOARD_PAYLOAD_FORMAT,
      version: CLIPBOARD_PAYLOAD_VERSION,
      objects: this.objectsEncode(split.objectRoots),
      brushes: this.brushNodesEncode(split.brushNodes),
      bounds: clipboardBoundsToPayload(clipboardBoundsMeasure([...split.objectRoots, ...split.brushNodes])),
    };
  }

  /**
   * Splits roots into object roots and brush nodes in scene order.
   *
   * @param roots Outermost selected hierarchy roots.
   * @returns Object roots and brush nodes.
   */
  private static rootsSplit(roots: readonly THREE.Object3D[]): ClipboardEncoderRoots {
    const classification = selectionRootsClassify(sortObjectsBySceneOrder(roots));
    const solidModelRoots = classification.solidNodes.filter((node) => SolidModel.isSolidModelObject(node));
    const brushNodes = classification.solidNodes.filter((node) => !SolidModel.isSolidModelObject(node));
    const regularMeshes = classification.regularMeshes.filter((mesh) => !SolidModel.isResultMesh(mesh));
    const objectRoots = [
      ...classification.entityOwners,
      ...solidModelRoots,
      ...regularMeshes,
      ...classification.plainGroups,
    ];
    return { objectRoots: sortObjectsBySceneOrder(objectRoots), brushNodes };
  }

  /**
   * Writes scene entries of object roots with world-space root transforms.
   *
   * @param objectRoots Solid models, entity owners, meshes and plain groups.
   * @returns Entries, each root followed by its descendants.
   */
  private static objectsEncode(objectRoots: readonly THREE.Object3D[]): ObjectEntry[] {
    const entries = new SceneSerializer().serializeRoots(objectRoots);
    const rootByUuid = new Map(objectRoots.map((root) => [root.uuid, root] as const));
    entries.forEach((entry) => {
      const root = entry.parentId === null ? rootByUuid.get(entry.uuid) : undefined;
      if (root) {
        root.updateWorldMatrix(true, false);
        solidSerializedTransformAssignFromMatrix(entry, root.matrixWorld);
      }
    });
    return entries;
  }

  /**
   * Writes brush nodes grouped by their solid model with world-space node
   * transforms.
   *
   * @param brushNodes Brush meshes and solid CSG groups.
   * @returns Brushes and hierarchy of every node.
   */
  private static brushNodesEncode(brushNodes: readonly THREE.Object3D[]): SerializedSolidModel {
    const payload: SerializedSolidModel = { brushes: [], hierarchy: [] };
    this.brushNodesGroupByModel(brushNodes).forEach((nodes, model) => {
      const encoded = SolidModelCodec.encodeNodesWorldSpace(model, nodes);
      payload.brushes.push(...encoded.brushes);
      payload.hierarchy?.push(...(encoded.hierarchy ?? []));
    });
    return payload;
  }

  /**
   * Groups brush nodes by the solid model owning them, keeping their order.
   *
   * @param brushNodes Brush meshes and solid CSG groups.
   * @returns Nodes keyed by solid model; nodes outside any model are dropped.
   */
  private static brushNodesGroupByModel(brushNodes: readonly THREE.Object3D[]): Map<SolidModel, THREE.Object3D[]> {
    const nodesByModel = new Map<SolidModel, THREE.Object3D[]>();
    brushNodes.forEach((node) => {
      const model = SolidModel.fromObject(node);
      if (model) {
        nodesByModel.set(model, [...(nodesByModel.get(model) ?? []), node]);
      }
    });
    return nodesByModel;
  }
}
