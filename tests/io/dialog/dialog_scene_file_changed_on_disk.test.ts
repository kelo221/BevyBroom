import { describe, expect, it, vi } from 'vitest';
import { dialogSceneFileChangedOnDiskConfirm } from '@/io/dialog/dialog_scene_file_changed_on_disk.js';
import type { MessageBoxOptions } from '@/ui/dialog/dialog_message_box.js';

/**
 * The changed-on-disk question names the file, offers Overwrite and Cancel, and
 * returns the user's choice.
 */
describe('dialogSceneFileChangedOnDiskConfirm', () => {
  it('names the file and returns whether the user chose to overwrite it', async () => {
    const host = document.createElement('div');
    const shown: MessageBoxOptions[] = [];
    const show = vi.fn(async (options: MessageBoxOptions) => {
      shown.push(options);
      return shown.length === 1;
    });
    expect(await dialogSceneFileChangedOnDiskConfirm(host, 'hall.json', show)).toBe(true);
    expect(await dialogSceneFileChangedOnDiskConfirm(host, 'hall.json', show)).toBe(false);
    expect(shown[0]?.message).toContain('hall.json');
    expect([shown[0]?.confirmLabel, shown[0]?.cancelLabel]).toEqual(['Overwrite', 'Cancel']);
    expect(shown[0]?.host).toBe(host);
  });
});
