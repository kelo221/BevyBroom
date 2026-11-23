import { gameEntityNumberListIs } from '@/game_entity/component/game_entity_component_value.js';
import * as THREE from 'three';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';

/** Reads typed values out of sanitized procedural parameters. */
export class ProceduralParametersRead {
  /**
   * Returns a vector3 parameter as a vector.
   *
   * @param parameters Sanitized parameters.
   * @param path Field path of a vector3 field.
   * @returns The point, or the origin when the parameter is not a vector3.
   */
  static vector3(parameters: ProceduralParameters, path: string): THREE.Vector3 {
    const value = parameters[path];
    if (!Array.isArray(value) || value.length !== 3 || !gameEntityNumberListIs(value)) {
      return new THREE.Vector3();
    }
    return new THREE.Vector3(value[0], value[1], value[2]);
  }

  /**
   * Returns a number parameter.
   *
   * @param parameters Sanitized parameters.
   * @param path Field path of a number field.
   * @returns The number, or zero when the parameter is not a number.
   */
  static number(parameters: ProceduralParameters, path: string): number {
    const value = parameters[path];
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Returns a text or enum parameter.
   *
   * @param parameters Sanitized parameters.
   * @param path Field path of a text or enum field.
   * @returns The text, or an empty text when the parameter is not text.
   */
  static text(parameters: Readonly<Record<string, unknown>>, path: string): string {
    const value = parameters[path];
    return typeof value === 'string' ? value : '';
  }

  /**
   * Returns a vector as the list a vector3 parameter stores.
   *
   * @param point Point to store.
   * @returns Its three coordinates.
   */
  static vector3Value(point: THREE.Vector3): number[] {
    return [point.x, point.y, point.z];
  }
}
