import type { ToolbarMenuAction } from '@/ui/menu/menu_types.js';
import type { NativeMenuBridge } from '@/native_menu/native_menu_bridge.js';
import { NativeMenuSerializer, type NativeMenuSource } from '@/native_menu/native_menu_serializer.js';
import { nativeMenuTextEditRun } from '@/native_menu/native_menu_text_edit.js';

/** Time between checks for changed menu labels, enablement and check marks. */
export const NATIVE_MENU_BAR_SYNC_REFRESH_INTERVAL_MS = 750;

/**
 * Keeps a native menu bar in step with page menus: sends a snapshot whenever
 * the live state of any row changed and runs the page action of chosen rows.
 */
export class NativeMenuBarSync {
  private readonly bridge: NativeMenuBridge;
  private readonly sources: readonly NativeMenuSource[];
  private readonly targetDocument: Document;
  private actions: ReadonlyMap<string, ToolbarMenuAction> = new Map();
  private lastSentSnapshot = '';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates the sync without sending anything yet.
   *
   * @param bridge Connection to the native menu bar.
   * @param sources Page menus in menu bar order.
   * @param targetDocument Document whose text fields receive text commands.
   */
  constructor(bridge: NativeMenuBridge, sources: readonly NativeMenuSource[], targetDocument: Document) {
    this.bridge = bridge;
    this.sources = sources;
    this.targetDocument = targetDocument;
  }

  /**
   * Listens for chosen rows and starts refreshing; the first snapshot is sent
   * on the next task so the editor finishes starting before any row is read.
   */
  start(): void {
    this.bridge.actionListenerSet((actionId) => this.actionRun(actionId));
    setTimeout(() => this.refreshSafe(), 0);
    this.refreshTimer = setInterval(() => this.refreshSafe(), NATIVE_MENU_BAR_SYNC_REFRESH_INTERVAL_MS);
  }

  /** Refreshes the native menu bar and reports a failure instead of throwing. */
  private refreshSafe(): void {
    try {
      this.refresh();
    } catch (error) {
      console.warn('[BevyBroom] Native menu bar refresh failed.', error);
    }
  }

  /** Stops refreshing the native menu bar. */
  dispose(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Sends a new snapshot when any row changed since the last one. */
  refresh(): void {
    const serialization = NativeMenuSerializer.serialize(this.sources);
    this.actions = serialization.actions;
    const snapshot = JSON.stringify(serialization.bar);
    if (snapshot === this.lastSentSnapshot) {
      return;
    }
    this.lastSentSnapshot = snapshot;
    this.bridge.menuBarSet(serialization.bar);
  }

  /**
   * Runs the page action of a chosen row, or its text command while a text
   * field has focus, then refreshes the menu bar.
   *
   * @param actionId Id of the chosen row.
   * @returns True when an enabled action or text command ran.
   */
  actionRun(actionId: string): boolean {
    const action = this.actions.get(actionId);
    if (!action || action.isEnabled?.() === false) {
      return false;
    }
    const textCommand = action.textEditCommand;
    if (!textCommand || !nativeMenuTextEditRun(textCommand, this.targetDocument)) {
      action.onClick();
    }
    this.refresh();
    return true;
  }
}
