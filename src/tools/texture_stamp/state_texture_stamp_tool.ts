/**
 * Whether the Apply Current Texture tool is the active viewport tool. While it
 * is, a left click on a face stamps the current texture instead of selecting.
 */
export class StateTextureStampTool {
  private toolActive: boolean;

  /** Creates inactive stamp tool state. */
  constructor() {
    this.toolActive = false;
  }

  /**
   * Returns whether the stamp tool is active.
   *
   * @returns True while left clicks stamp the current texture.
   */
  toolActiveRead(): boolean {
    return this.toolActive;
  }

  /**
   * Sets whether the stamp tool is active.
   *
   * @param active True while the stamp tool is the active tool.
   */
  toolActiveWrite(active: boolean): void {
    this.toolActive = active;
  }
}

let sharedTextureStampTool: StateTextureStampTool | null = null;

/**
 * Returns the process-wide stamp tool state singleton.
 *
 * @returns Shared StateTextureStampTool.
 */
export function getStateTextureStampTool(): StateTextureStampTool {
  if (!sharedTextureStampTool) {
    sharedTextureStampTool = new StateTextureStampTool();
  }
  return sharedTextureStampTool;
}

/**
 * Replaces the shared stamp tool state for tests.
 *
 * @param state State to install, or null to clear.
 */
export function setStateTextureStampToolForTests(state: StateTextureStampTool | null): void {
  sharedTextureStampTool = state;
}
