import { afterEach, describe, expect, it } from 'vitest';
import { GameEntityClassCache } from '@/game_entity/class/game_entity_class_cache.js';
import { GameEntityClassProviderPreview } from '@/game_entity/class/game_entity_class_provider_preview.js';
import { gameEntityClassListEmpty } from '@/game_entity/class/game_entity_class_schema.js';
import { testClassListCreate } from '../game_entity_test_classes.js';

/**
 * The preview provider caches every list the game reports per project and shows
 * the cached list when a project's game connects again.
 */
describe('GameEntityClassProviderPreview', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('caches reported classes per project and restores them for that project only', () => {
    const reporting = new GameEntityClassProviderPreview();
    reporting.projectAdopt('project-a');
    reporting.listWrite(testClassListCreate());
    expect(GameEntityClassCache.read('project-a')).toEqual(testClassListCreate());
    const restarted = new GameEntityClassProviderPreview();
    restarted.projectAdopt('project-b');
    expect(restarted.listRead()).toEqual(gameEntityClassListEmpty());
    restarted.projectAdopt('project-a');
    expect(restarted.listRead()).toEqual(testClassListCreate());
  });

  it('ignores unreadable cache entries', () => {
    const provider = new GameEntityClassProviderPreview();
    provider.projectAdopt('project-a');
    provider.listWrite(testClassListCreate());
    const key = Object.keys(globalThis.localStorage).find((candidate) => candidate.endsWith('project-a')) ?? '';
    globalThis.localStorage.setItem(key, '{not json');
    expect(GameEntityClassCache.read('project-a')).toBeNull();
  });
});
