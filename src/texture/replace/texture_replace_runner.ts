import {
  HandlerTextureReplace,
  type HandlerTextureReplaceDeps,
  type TextureReplaceScope,
} from './handler_texture_replace.js';

/** Editor parts a texture replace runner acts on and reports to. */
export interface TextureReplaceRunnerDeps extends HandlerTextureReplaceDeps {
  /** Shows the result message of a replacement, or null to stay silent. */
  readonly resultReport: ((message: string) => void) | null;
}

/** Outcome of one material replacement. */
export interface TextureReplaceRunResult {
  /** Number of repainted faces. */
  readonly faceCount: number;
  /** User-facing description of the replacement. */
  readonly message: string;
}

/**
 * Runs material replacements over the editor world and reports how many faces
 * each one repainted.
 */
export class TextureReplaceRunner {
  private readonly textureReplace: HandlerTextureReplace;
  private readonly deps: TextureReplaceRunnerDeps;

  /**
   * Creates the runner over a new material replacement.
   *
   * @param deps Undo stack, scene root, selection, refresh and report
   *   callbacks.
   */
  constructor(deps: TextureReplaceRunnerDeps) {
    this.deps = deps;
    this.textureReplace = new HandlerTextureReplace(deps);
  }

  /**
   * Formats the message describing a replacement.
   *
   * @param faceCount Number of repainted faces.
   * @returns User-facing message.
   */
  static messageFormat(faceCount: number): string {
    return `Replaced the material of ${faceCount} face(s)`;
  }

  /**
   * Replaces one material with another in a scope and reports the result.
   *
   * @param findTextureId Material to replace.
   * @param replaceTextureId Material painted instead.
   * @param scope Every brush or only the selected ones.
   * @returns Face count and message of the replacement.
   */
  run(findTextureId: string, replaceTextureId: string, scope: TextureReplaceScope): TextureReplaceRunResult {
    const faceCount = this.textureReplace.replace(findTextureId, replaceTextureId, scope);
    const message = TextureReplaceRunner.messageFormat(faceCount);
    this.deps.resultReport?.(message);
    return { faceCount, message };
  }

  /**
   * Replaces one material with another in the selected objects when anything is
   * selected and everywhere otherwise, and reports the result.
   *
   * @param findTextureId Material to replace.
   * @param replaceTextureId Material painted instead.
   * @returns Face count and message of the replacement.
   */
  runInSelectionOrEverywhere(findTextureId: string, replaceTextureId: string): TextureReplaceRunResult {
    return this.run(findTextureId, replaceTextureId, this.scopeForSelectionRead());
  }

  /**
   * Returns the scope matching the current selection.
   *
   * @returns Selection when any object is selected, otherwise everything.
   */
  scopeForSelectionRead(): TextureReplaceScope {
    return this.deps.selectionManager.getSelectedObjectCount() > 0 ? 'selection' : 'all';
  }
}
