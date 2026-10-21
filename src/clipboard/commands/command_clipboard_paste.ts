import * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { layerIdStoredWrite } from '@/layer/model/layer_membership.js';
import { modifierBevelRefreshScene } from '@/modifier/compile/modifier_bevel_scene_refresh.js';
import { ModifierVolumeBevel } from '@/modifier/volume/modifier_volume_bevel.js';
import { SolidModelCodec, type SerializedSolidModel } from '@/solid/io/solid_model_codec.js';
import { solidSerializedTransformSpaceChange } from '@/solid/io/solid_model_codec_transform.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import type { SolidModel } from '@/solid/model/solid_model.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Undoable paste of a clipboard payload. Top-level objects join the world root
 * in its current layer; brushes and solid CSG groups join a target solid model.
 * The payload must already carry fresh identities and its final placement.
 * Pasted objects are the same across undo and redo, and pasted brushes and
 * groups keep their ids.
 */
export class CommandClipboardPaste implements UndoCommand {
  private readonly worldObject: THREE.Object3D;
  private readonly targetModel: SolidModel | null;
  private readonly brushes: SerializedSolidModel;
  private readonly objects: THREE.Object3D[];
  private brushNodes: THREE.Object3D[];
  private brushGroupUuids: string[];

  /**
   * Builds the pasted objects without adding anything to the scene yet.
   *
   * @param payload Payload with fresh identities at its final placement.
   * @param worldObject World root receiving top-level objects.
   * @param targetModel Solid model receiving brushes, or null when the payload
   *   holds no brushes.
   */
  constructor(payload: ClipboardPayload, worldObject: THREE.Object3D, targetModel: SolidModel | null) {
    this.worldObject = worldObject;
    this.brushes = payload.brushes;
    this.targetModel = payload.brushes.brushes.length > 0 ? targetModel : null;
    this.objects = CommandClipboardPaste.objectsCreate(payload.objects, worldObject);
    this.brushNodes = [];
    this.brushGroupUuids = [];
  }

  /** Adds the pasted objects, brushes and groups to the scene. */
  execute(): void {
    this.objects.forEach((object) => this.worldObject.add(object));
    this.bevelVolumesRefreshWhenPasted();
    this.brushNodesCreate();
  }

  /** Removes the pasted objects, brushes and groups from the scene. */
  undo(): void {
    this.brushNodesRemove();
    this.objects.forEach((object) => object.removeFromParent());
    this.bevelVolumesRefreshWhenPasted();
  }

  /**
   * Returns the pasted top-level objects followed by the pasted top-level brush
   * meshes and solid CSG groups.
   *
   * @returns Pasted hierarchy roots while executed.
   */
  pastedRootsRead(): THREE.Object3D[] {
    return [...this.objects, ...this.brushNodes];
  }

  /**
   * Returns the ids tools use for the pasted roots: object uuids, brush ids of
   * brush meshes and uuids of solid CSG groups.
   *
   * @returns Ids in the order of {@link pastedRootsRead}.
   */
  pastedIdsRead(): string[] {
    return this.pastedRootsRead().map((root) => SolidBrushVisual.getBrushId(root) ?? root.uuid);
  }

  /**
   * Creates the top-level objects of entries, converting world-space top-level
   * transforms into the world root's space and dropping stored layers so the
   * objects join the current layer.
   *
   * @param entries Entries with world-space top-level transforms.
   * @param worldObject World root the objects will join.
   * @returns Parentless top-level objects.
   */
  private static objectsCreate(entries: readonly ObjectEntry[], worldObject: THREE.Object3D): THREE.Object3D[] {
    const localEntries = JSON.parse(JSON.stringify(entries)) as ObjectEntry[];
    worldObject.updateWorldMatrix(true, false);
    const worldToRoot = worldObject.matrixWorld.clone().invert();
    localEntries
      .filter((entry) => entry.parentId === null)
      .forEach((entry) => solidSerializedTransformSpaceChange(entry, worldToRoot));
    const objects = new SceneDeserializer().objectsCreateFromEntries(localEntries);
    objects.forEach((object) => layerIdStoredWrite(object, null));
    return objects;
  }

  /** Decodes the pasted brushes and groups into the target model. */
  private brushNodesCreate(): void {
    if (this.targetModel === null) {
      return;
    }
    this.brushNodes = SolidModelCodec.decodeNodesInto(this.targetModel, this.brushes);
    const groups = this.brushGroupsCollect();
    if (this.brushGroupUuids.length === 0) {
      this.brushGroupUuids = groups.map((group) => group.uuid);
      return;
    }
    groups.forEach((group, index) => {
      group.uuid = this.brushGroupUuids[index] ?? group.uuid;
    });
  }

  /** Removes the pasted brushes and groups from the target model. */
  private brushNodesRemove(): void {
    const model = this.targetModel;
    if (model === null) {
      return;
    }
    this.brushes.brushes.forEach((brush) => model.removeBrush(brush.id, true, false));
    this.brushNodes.filter((node) => node instanceof THREE.Group).forEach((group) => group.removeFromParent());
    this.brushNodes = [];
    model.syncBrushOrderFromScene();
    model.rebuild(true);
  }

  /**
   * Collects every group at or under the pasted brush nodes in scene order.
   *
   * @returns Pasted solid CSG groups.
   */
  private brushGroupsCollect(): THREE.Group[] {
    const groups: THREE.Group[] = [];
    this.brushNodes.forEach((node) =>
      node.traverse((object) => {
        if (object instanceof THREE.Group) groups.push(object);
      }),
    );
    return groups;
  }

  /** Recompiles bevel volumes of the world when a pasted object is one. */
  private bevelVolumesRefreshWhenPasted(): void {
    const pastesVolume = this.objects.some((object) => {
      let found = false;
      object.traverse((descendant) => {
        found = found || ModifierVolumeBevel.isVolume(descendant);
      });
      return found;
    });
    if (pastesVolume) {
      modifierBevelRefreshScene(this.worldObject);
    }
  }
}
