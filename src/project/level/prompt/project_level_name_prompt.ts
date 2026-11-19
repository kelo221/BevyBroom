import { showPromptFields, type DialogPromptShow } from '@/ui/dialog/dialog_prompt_fields.js';
import { projectLevelDocumentFromName } from '@/project/model/project_level_entry.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';

/** Name a new level is offered before the designer types one. */
export const PROJECT_LEVEL_NAME_DEFAULT = 'Untitled Level';

/** Field id of the level name. */
const PROJECT_LEVEL_NAME_PROMPT_FIELD = 'name';

/** What the name prompt shows. */
export interface ProjectLevelNamePromptRequest {
  /** Element the prompt is shown over. */
  readonly host: HTMLElement;
  /** Dialog title. */
  readonly title: string;
  /** Label of the confirming button. */
  readonly confirmLabel: string;
  /** Levels the project already has; their names are not offered. */
  readonly levels: readonly ProjectLevelSummary[];
}

/**
 * Asks for the name of a new project level, offering a name no level of the
 * project uses yet.
 */
export class ProjectLevelNamePrompt {
  private readonly promptShow: DialogPromptShow;

  /**
   * Creates the prompt.
   *
   * @param promptShow Shows a prompt; the modal prompt dialog when omitted.
   */
  constructor(promptShow: DialogPromptShow = showPromptFields) {
    this.promptShow = promptShow;
  }

  /**
   * Shows the prompt.
   *
   * @param request Host, title, button label and existing levels.
   * @returns The typed name, or null when cancelled.
   */
  async nameAsk(request: ProjectLevelNamePromptRequest): Promise<string | null> {
    const answer = await this.promptShow({
      host: request.host,
      title: request.title,
      confirmLabel: request.confirmLabel,
      fields: [
        {
          id: PROJECT_LEVEL_NAME_PROMPT_FIELD,
          label: 'Level name',
          value: ProjectLevelNamePrompt.nameUnusedPick(request.levels),
          placeholder: PROJECT_LEVEL_NAME_DEFAULT,
          isRequired: true,
          suggestions: [],
        },
      ],
    });
    return answer?.[PROJECT_LEVEL_NAME_PROMPT_FIELD]?.trim() || null;
  }

  /**
   * Returns the default level name, numbered when levels already use it.
   *
   * @param levels Existing levels of the project.
   * @returns Untitled Level , or "Untitled Level 2", 3 and so on.
   */
  static nameUnusedPick(levels: readonly ProjectLevelSummary[]): string {
    let candidate = PROJECT_LEVEL_NAME_DEFAULT;
    for (let number = 2; ProjectLevelNamePrompt.nameTakenIs(levels, candidate); number++) {
      candidate = `${PROJECT_LEVEL_NAME_DEFAULT} ${number}`;
    }
    return candidate;
  }

  /**
   * Returns whether a new level of this name would collide with an existing
   * level's name or document.
   *
   * @param levels Existing levels of the project.
   * @param name Candidate level name.
   * @returns True when the name or its document is already in use.
   */
  static nameTakenIs(levels: readonly ProjectLevelSummary[], name: string): boolean {
    const document = projectLevelDocumentFromName(name);
    const lowerName = name.trim().toLowerCase();
    return levels.some((level) => level.document === document || level.name.toLowerCase() === lowerName);
  }
}
