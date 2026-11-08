import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { DialogSprinkle, type DialogSprinkleServices } from '@/tools/sprinkle/ui/dialog_sprinkle.js';

/**
 * Mounts the Entity Sprinkle window and keeps it open exactly while the
 * Sprinkle tool is active.
 */
export class SprinkleDialogMount {
  /** Entity Sprinkle window. */
  readonly dialog: DialogSprinkle;
  private readonly unsubscribeTool: () => void;

  /**
   * Creates the window and opens it when the Sprinkle tool is already active.
   *
   * @param host Parent element hosting floating panels.
   * @param services Grid interval, status reporting and tool exit.
   */
  constructor(host: HTMLElement, services: DialogSprinkleServices) {
    this.dialog = new DialogSprinkle(host, services);
    this.unsubscribeTool = getStateSprinkleTool().changeListenerAdd(() => this.visibilitySync());
    this.visibilitySync();
  }

  /** Stops following the tool and disposes the window. */
  dispose(): void {
    this.unsubscribeTool();
    this.dialog.dispose();
  }

  /**
   * Opens the window while the Sprinkle tool is active and closes it otherwise,
   * reloading the sprinkle definitions each time the window opens.
   */
  private visibilitySync(): void {
    const isToolActive = getStateSprinkleTool().toolActiveRead();
    const isOpening = isToolActive && !this.dialog.isOpen();
    this.dialog.visibilityWrite(isToolActive);
    if (isOpening) {
      this.definitionLibraryRefresh();
    }
  }

  /** Reloads the sprinkle definitions so values follow the current game classes. */
  private definitionLibraryRefresh(): void {
    void getStateSprinkleDefinitionLibrary().refresh();
  }
}
