import type * as THREE from 'three';
import {
  GAME_ENTITY_COMMENTS_USERDATA_KEY,
  GAME_ENTITY_LOGIC_OUTPUTS_USERDATA_KEY,
  type AuthoredLogicOutput,
} from './game_entity_logic_types.js';

/**
 * Reads, sanitizes, and writes authored entity I/O output connections and
 * comments on Three.js scene objects.
 */
export class GameEntityLogicStore {
  /**
   * Returns a cloned array of authored logic output rows on an object.
   *
   * @param object Scene object.
   * @returns Cloned list of authored output rows.
   */
  static read(object: THREE.Object3D): AuthoredLogicOutput[] {
    const raw: unknown = object.userData[GAME_ENTITY_LOGIC_OUTPUTS_USERDATA_KEY];
    return GameEntityLogicStore.fromUnknown(raw);
  }

  /**
   * Returns whether an object has at least one authored logic output row.
   *
   * @param object Scene object.
   * @returns True when non-empty.
   */
  static hasAny(object: THREE.Object3D): boolean {
    return GameEntityLogicStore.read(object).length > 0;
  }

  /**
   * Writes sanitized logic output rows onto an object, deleting the key when
   * empty.
   *
   * @param object Scene object.
   * @param rows Output rows to store.
   */
  static write(object: THREE.Object3D, rows: readonly AuthoredLogicOutput[]): void {
    const sanitized = rows.map((row) => GameEntityLogicStore.rowSanitize(row));
    if (sanitized.length === 0) {
      delete object.userData[GAME_ENTITY_LOGIC_OUTPUTS_USERDATA_KEY];
      return;
    }
    object.userData[GAME_ENTITY_LOGIC_OUTPUTS_USERDATA_KEY] = sanitized;
  }

  /**
   * Parses unknown JSON data into a valid list of AuthoredLogicOutput rows.
   *
   * @param value Candidate JSON array.
   * @returns Sanitized rows.
   */
  static fromUnknown(value: unknown): AuthoredLogicOutput[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => GameEntityLogicStore.rowFromRecord(item));
  }

  /**
   * Sanitizes a single authored output row, clamping negative delays to 0.
   *
   * @param row Input row.
   * @returns Cloned, sanitized row.
   */
  static rowSanitize(row: AuthoredLogicOutput): AuthoredLogicOutput {
    const delay = Number.isFinite(row.delay) && row.delay > 0 ? row.delay : 0;
    const times = Number.isFinite(row.times_to_fire) ? Math.trunc(row.times_to_fire) : -1;
    return {
      output: String(row.output ?? '').trim(),
      target: String(row.target ?? '').trim(),
      input: String(row.input ?? '').trim(),
      parameter: String(row.parameter ?? ''),
      delay,
      times_to_fire: times === 0 || times < -1 ? -1 : times,
    };
  }

  /**
   * Reads the designer comments string stored on an object.
   *
   * @param object Scene object.
   * @returns Comments string, or empty string.
   */
  static commentsRead(object: THREE.Object3D): string {
    const raw: unknown = object.userData[GAME_ENTITY_COMMENTS_USERDATA_KEY];
    return typeof raw === 'string' ? raw : '';
  }

  /**
   * Writes the designer comments string onto an object.
   *
   * @param object Scene object.
   * @param comments Comments text.
   */
  static commentsWrite(object: THREE.Object3D, comments: string): void {
    if (!comments) {
      delete object.userData[GAME_ENTITY_COMMENTS_USERDATA_KEY];
      return;
    }
    object.userData[GAME_ENTITY_COMMENTS_USERDATA_KEY] = comments;
  }

  /**
   * Converts an untyped record into a sanitized AuthoredLogicOutput.
   *
   * @param item Untyped record.
   * @returns Sanitized row.
   */
  private static rowFromRecord(item: Record<string, unknown>): AuthoredLogicOutput {
    return GameEntityLogicStore.rowSanitize({
      output: typeof item['output'] === 'string' ? item['output'] : '',
      target: typeof item['target'] === 'string' ? item['target'] : '',
      input: typeof item['input'] === 'string' ? item['input'] : '',
      parameter: typeof item['parameter'] === 'string' ? item['parameter'] : '',
      delay: typeof item['delay'] === 'number' ? item['delay'] : 0,
      times_to_fire: typeof item['times_to_fire'] === 'number' ? item['times_to_fire'] : -1,
    });
  }
}
