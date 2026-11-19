import type * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Turns the bytes of a binary glTF file into a three.js scene. */
export class GlbSceneParser {
  /**
   * Parses binary glTF bytes.
   *
   * @param source Binary glTF buffer or typed view over one.
   * @returns Promise resolving to the file's default scene.
   */
  static parse(source: ArrayBuffer | ArrayBufferView): Promise<THREE.Group> {
    const buffer = GlbSceneParser.realmArrayBufferCopy(source);
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(buffer, '', (gltf) => resolve(gltf.scene), reject);
    });
  }

  /**
   * Copies bytes into an ArrayBuffer of the current realm, which the loader
   * needs when the bytes come from another realm such as a Node buffer.
   *
   * @param source Buffer or typed view to copy.
   * @returns Fresh ArrayBuffer with the same bytes.
   */
  private static realmArrayBufferCopy(source: ArrayBuffer | ArrayBufferView): ArrayBuffer {
    const bytes =
      source instanceof ArrayBuffer
        ? new Uint8Array(source)
        : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
  }
}
