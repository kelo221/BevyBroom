import * as THREE from 'three';
import { shouldOmitFromExport } from '@/io/scene/builder_export_scene.js';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CLIP_PREVIEW_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview.js';
import type { PreviewAuthoredObject, PreviewObjectKind } from '@/preview/protocol/preview_protocol_types.js';
import { previewLightFromSettings } from '@/preview/state/preview_state_light_converter.js';
import { previewPortalFromSettings, previewRoomFromSettings } from '@/preview/state/preview_state_portal_converter.js';

/**
 * Collects the authored hierarchy of an editor world as preview objects:
 * groups, meshes, solid model roots, lights, rooms and portals with their local
 * transforms. Children of solid models and entities are not listed.
 */
export class PreviewStateObjectCollector {
  /**
   * Collects every authored object under the world root in hierarchy order.
   *
   * @param worldGroup Editor world root; its direct children have no parent id.
   * @returns Preview objects.
   */
  static collect(worldGroup: THREE.Object3D): PreviewAuthoredObject[] {
    const objects: PreviewAuthoredObject[] = [];
    for (const child of worldGroup.children) {
      PreviewStateObjectCollector.collectInto(child, null, objects);
    }
    return objects;
  }

  /**
   * Appends one object and, for plain groups and meshes, its children.
   *
   * @param object Scene object.
   * @param parentIdentifier Identifier of the authored parent, or null at the
   *   top level.
   * @param objects Output list.
   */
  private static collectInto(
    object: THREE.Object3D,
    parentIdentifier: string | null,
    objects: PreviewAuthoredObject[],
  ): void {
    const kind = PreviewStateObjectCollector.kindResolve(object);
    if (kind === null) {
      return;
    }
    objects.push(PreviewStateObjectCollector.objectCreate(object, parentIdentifier, kind));
    if (kind !== 'group' && kind !== 'mesh') {
      return;
    }
    for (const child of object.children) {
      PreviewStateObjectCollector.collectInto(child, object.uuid, objects);
    }
  }

  /**
   * Classifies a scene object.
   *
   * @param object Scene object.
   * @returns The authored kind, or null for editor helpers and other
   *   non-content objects.
   */
  private static kindResolve(object: THREE.Object3D): PreviewObjectKind | null {
    const entityKind = entityKindRead(object);
    if (entityKind !== null) {
      return entityKind;
    }
    if (object.userData[CLIP_PREVIEW_USERDATA_KEY] === true || shouldOmitFromExport(object)) {
      return null;
    }
    if (SolidModel.isSolidModelObject(object)) {
      return 'solid';
    }
    if (object instanceof THREE.Mesh) {
      return 'mesh';
    }
    return object instanceof THREE.Group ? 'group' : null;
  }

  /**
   * Builds the preview object of one scene object.
   *
   * @param object Scene object.
   * @param parentIdentifier Identifier of the authored parent, or null.
   * @param kind Authored kind.
   * @returns Preview object with its local transform.
   */
  private static objectCreate(
    object: THREE.Object3D,
    parentIdentifier: string | null,
    kind: PreviewObjectKind,
  ): PreviewAuthoredObject {
    const authored: PreviewAuthoredObject = {
      id: object.uuid,
      parent_id: parentIdentifier,
      name: object.name,
      kind,
      visible: object.visible,
      translation: [object.position.x, object.position.y, object.position.z],
      rotation: [object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    };
    PreviewStateObjectCollector.entityPayloadAttach(object, authored);
    return authored;
  }

  /**
   * Attaches the light, room or portal definition of an entity owner.
   *
   * @param object Scene object.
   * @param authored Preview object to complete.
   */
  private static entityPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    const light = LightOwner.settingsRead(object);
    if (light) {
      authored.light = previewLightFromSettings(light);
    }
    const room = RoomOwner.settingsRead(object);
    if (room) {
      authored.room = previewRoomFromSettings(room);
    }
    const portal = PortalOwner.settingsRead(object);
    if (portal) {
      authored.portal = previewPortalFromSettings(portal);
    }
  }
}
