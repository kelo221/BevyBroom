import * as THREE from 'three';
import { exportContentMaterialResolve, shouldOmitFromExport } from '@/io/scene/builder_export_scene.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CLIP_PREVIEW_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview.js';

/**
 * Builds a cheap text signature of everything that ends up inside exported
 * level geometry: which nodes exist, their nesting, mesh buffers and material
 * assignments. Transforms and visibility are excluded because they travel in
 * the authored state instead. Equal signatures mean an export would not
 * change.
 */
export class PreviewGeometrySignature {
  /**
   * Computes the signature of an editor world.
   *
   * @param worldGroup Editor world root.
   * @returns Signature text.
   */
  static compute(worldGroup: THREE.Object3D): string {
    const parts: string[] = [];
    for (const child of worldGroup.children) {
      PreviewGeometrySignature.objectAppend(child, parts);
    }
    return parts.join('|');
  }

  /**
   * Appends the signature of one object and its exported descendants.
   *
   * @param object Scene object.
   * @param parts Output signature parts.
   */
  private static objectAppend(object: THREE.Object3D, parts: string[]): void {
    if (object.userData[CLIP_PREVIEW_USERDATA_KEY] === true || shouldOmitFromExport(object)) {
      return;
    }
    if (SolidModel.isSolidModelObject(object)) {
      PreviewGeometrySignature.solidAppend(object, parts);
      return;
    }
    if (object instanceof THREE.Mesh) {
      PreviewGeometrySignature.meshAppend(object, parts);
      return;
    }
    if (object instanceof THREE.Group) {
      parts.push(`g:${object.uuid}[`);
      object.children.forEach((child) => PreviewGeometrySignature.objectAppend(child, parts));
      parts.push(']');
    }
  }

  /**
   * Appends a solid model and its compiled result mesh.
   *
   * @param solidRoot Solid model root.
   * @param parts Output signature parts.
   */
  private static solidAppend(solidRoot: THREE.Object3D, parts: string[]): void {
    parts.push(`s:${solidRoot.uuid}[`);
    for (const child of solidRoot.children) {
      if (child instanceof THREE.Mesh && SolidModel.isResultMesh(child)) {
        PreviewGeometrySignature.meshAppend(child, parts);
      }
    }
    parts.push(']');
  }

  /**
   * Appends a mesh's buffers and materials.
   *
   * @param mesh Content or result mesh.
   * @param parts Output signature parts.
   */
  private static meshAppend(mesh: THREE.Mesh, parts: string[]): void {
    parts.push(`m:${mesh.uuid}:${PreviewGeometrySignature.geometryDescribe(mesh.geometry)}`);
    const materials = exportContentMaterialResolve(mesh);
    const materialList = Array.isArray(materials) ? materials : [materials];
    parts.push(materialList.map((material) => PreviewGeometrySignature.materialDescribe(material)).join(','));
  }

  /**
   * Describes a geometry by identity, buffer versions and draw groups.
   *
   * @param geometry Mesh geometry.
   * @returns Geometry description.
   */
  private static geometryDescribe(geometry: THREE.BufferGeometry): string {
    const attributeVersions = Object.entries(geometry.attributes)
      .map(([name, attribute]) => `${name}${'version' in attribute ? attribute.version : 0}`)
      .join('/');
    const indexVersion = geometry.index?.version ?? -1;
    const groups = geometry.groups
      .map((group) => `${group.start}+${group.count}@${group.materialIndex ?? 0}`)
      .join(';');
    return `${geometry.uuid}:${attributeVersions}:${indexVersion}:${groups}`;
  }

  /**
   * Describes a material by identity, tint and diffuse map.
   *
   * @param material Content material.
   * @returns Material description.
   */
  private static materialDescribe(material: THREE.Material): string {
    const host = material as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null };
    const colorText = host.color ? host.color.getHexString() : '-';
    const mapText = host.map ? `${host.map.uuid}${host.map.version}` : '-';
    return `${material.uuid}:${colorText}:${mapText}`;
  }
}
