/** Project file field marking textures with a meaning for the game's tools. */
export const PROJECT_TOOL_TEXTURES_FIELD = 'tool_textures';

/** Textures the project marks for the level export. */
export interface ProjectToolTextures {
  /**
   * Texture ids whose faces keep their collision but are left out of the render
   * geometry.
   */
  nodraw: string[];
}

/**
 * Reads the `tool_textures` field of a project file: `{ "nodraw": [ids] }`,
 * where each id is a texture id such as `textures/tools/nodraw.png`.
 */
export class ProjectToolTexturesParser {
  /**
   * Reads the tool textures of a parsed project file.
   *
   * @param project Parsed project object.
   * @returns Tool textures; empty lists when the field is missing or malformed.
   */
  static read(project: Record<string, unknown>): ProjectToolTextures {
    const field = project[PROJECT_TOOL_TEXTURES_FIELD];
    const record =
      typeof field === 'object' && field !== null && !Array.isArray(field) ? (field as Record<string, unknown>) : {};
    return { nodraw: ProjectToolTexturesParser.idsRead(record['nodraw']) };
  }

  /**
   * Returns the non-empty texture ids of a list, sorted and without repeats.
   *
   * @param value Any value.
   * @returns Texture ids.
   */
  private static idsRead(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const ids = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
    return [...new Set(ids.map((id) => id.trim()))].sort();
  }
}
