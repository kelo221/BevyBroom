import { clipboardPayloadTextRead } from '@/clipboard/payload/clipboard_payload_text.js';
import { PREFAB_CATEGORY_DEFAULT, type PrefabTemplate } from '@/prefab/prefab_types.js';

/** Format marker of a prefab file. */
export const PREFAB_FILE_FORMAT = 'bevybroom.prefab';

/** Newest prefab file version the editor writes and reads. */
export const PREFAB_FILE_VERSION = 1;

/** File name extension of prefab files. */
export const PREFAB_FILE_EXTENSION = '.json';

/** Reads and writes prefab files: plain JSON holding one prefab. */
export class PrefabFileCodec {
  /**
   * Writes a prefab as file text.
   *
   * @param template Prefab to write.
   * @returns Indented JSON text ending in a newline.
   */
  static textWrite(template: PrefabTemplate): string {
    const file = {
      format: PREFAB_FILE_FORMAT,
      version: PREFAB_FILE_VERSION,
      name: template.name,
      category: template.category,
      payload: template.payload,
    };
    return `${JSON.stringify(file, null, 2)}\n`;
  }

  /**
   * Reads a prefab file.
   *
   * @param fileName File name; its stem becomes the prefab id.
   * @param text File text.
   * @returns The prefab.
   * @throws Error naming the file when it is not a prefab file.
   */
  static textRead(fileName: string, text: string): PrefabTemplate {
    const file = PrefabFileCodec.jsonParse(fileName, text);
    const payload = clipboardPayloadTextRead(JSON.stringify(file['payload'] ?? null));
    if (file['format'] !== PREFAB_FILE_FORMAT || file['version'] !== PREFAB_FILE_VERSION || payload === null) {
      throw new Error(`${fileName} is not a version ${PREFAB_FILE_VERSION} prefab file`);
    }
    const id = PrefabFileCodec.idFromFileName(fileName);
    const name = typeof file['name'] === 'string' && file['name'].trim() !== '' ? file['name'] : id;
    const category =
      typeof file['category'] === 'string' && file['category'].trim() !== ''
        ? file['category']
        : PREFAB_CATEGORY_DEFAULT;
    return { id, name, category, payload };
  }

  /**
   * Returns the file name a prefab is saved under.
   *
   * @param id Prefab id.
   * @returns File name.
   */
  static fileNameFromId(id: string): string {
    return `${id}${PREFAB_FILE_EXTENSION}`;
  }

  /**
   * Returns the prefab id of a file name.
   *
   * @param fileName File name.
   * @returns File name without its ".json" extension.
   */
  static idFromFileName(fileName: string): string {
    return fileName.toLowerCase().endsWith(PREFAB_FILE_EXTENSION)
      ? fileName.slice(0, -PREFAB_FILE_EXTENSION.length)
      : fileName;
  }

  /**
   * Parses file text into an object.
   *
   * @param fileName File name used in messages.
   * @param text File text.
   * @returns Parsed object.
   * @throws Error naming the file when the text is not a JSON object.
   */
  private static jsonParse(fileName: string, text: string): Record<string, unknown> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`${fileName} is not valid JSON: ${String(error)}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${fileName} must hold a JSON object`);
    }
    return parsed as Record<string, unknown>;
  }
}
