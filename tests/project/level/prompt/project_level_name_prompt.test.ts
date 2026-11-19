import { describe, expect, it, vi } from 'vitest';
import {
  PROJECT_LEVEL_NAME_DEFAULT,
  ProjectLevelNamePrompt,
} from '@/project/level/prompt/project_level_name_prompt.js';
import { projectLevelDocumentFromName } from '@/project/model/project_level_entry.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';
import type { DialogPromptFieldsOptions, DialogPromptShow } from '@/ui/dialog/dialog_prompt_fields.js';

/**
 * Builds the summary of an existing level named like a new level of that name.
 *
 * @param name Level name.
 * @returns Level summary.
 */
function levelSummaryCreate(name: string): ProjectLevelSummary {
  const document = projectLevelDocumentFromName(name);
  return { id: document, name, document, modifiedMilliseconds: 1, isListed: false };
}

/**
 * Asks for a level name through a prompt that answers with a fixed text and
 * records what it was shown.
 *
 * @param answerText Text the prompt answers with, or null to cancel.
 * @param levels Existing levels.
 * @returns Name returned by the prompt and the options it was shown with.
 */
async function nameAskWithAnswer(
  answerText: string | null,
  levels: readonly ProjectLevelSummary[],
): Promise<{ name: string | null; shown: DialogPromptFieldsOptions | undefined }> {
  const promptShow = vi.fn<DialogPromptShow>(async (options) =>
    answerText === null ? null : { [options.fields[0]?.id ?? '']: answerText },
  );
  const host = document.createElement('div');
  const name = await new ProjectLevelNamePrompt(promptShow).nameAsk({
    host,
    title: 'New Level',
    confirmLabel: 'Create',
    levels,
  });
  return { name, shown: promptShow.mock.calls[0]?.[0] };
}

/** New project levels are named through a prompt that offers an unused name. */
describe('ProjectLevelNamePrompt', () => {
  it('offers the default name, numbered past the names levels already use', () => {
    expect(ProjectLevelNamePrompt.nameUnusedPick([])).toBe(PROJECT_LEVEL_NAME_DEFAULT);
    const taken = [
      levelSummaryCreate(PROJECT_LEVEL_NAME_DEFAULT),
      levelSummaryCreate(`${PROJECT_LEVEL_NAME_DEFAULT} 2`),
    ];
    const offered = ProjectLevelNamePrompt.nameUnusedPick(taken);
    expect(ProjectLevelNamePrompt.nameTakenIs(taken, offered)).toBe(false);
    expect(offered.startsWith(PROJECT_LEVEL_NAME_DEFAULT)).toBe(true);
  });

  it('counts a name as taken when its document or its name, ignoring case, is in use', () => {
    const levels = [levelSummaryCreate('Store')];
    expect(ProjectLevelNamePrompt.nameTakenIs(levels, 'store')).toBe(true);
    expect(ProjectLevelNamePrompt.nameTakenIs(levels, 'Lobby')).toBe(false);
  });

  it('shows the unused name and returns the trimmed answer, or null when cancelled', async () => {
    const levels = [levelSummaryCreate(PROJECT_LEVEL_NAME_DEFAULT)];
    const answered = await nameAskWithAnswer('  Rooftop  ', levels);
    expect(answered.name).toBe('Rooftop');
    expect(answered.shown?.fields[0]?.value).toBe(ProjectLevelNamePrompt.nameUnusedPick(levels));
    expect(answered.shown?.title).toBe('New Level');
    expect((await nameAskWithAnswer(null, levels)).name).toBeNull();
    expect((await nameAskWithAnswer('   ', levels)).name).toBeNull();
  });
});
