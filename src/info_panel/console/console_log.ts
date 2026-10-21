import type {
  ConsoleLogChange,
  ConsoleLogChangeListener,
  ConsoleLogEntry,
  ConsoleLogLevel,
} from '@/info_panel/console/console_log_entry.js';

/** Most lines a console log keeps; older lines are dropped. */
export const CONSOLE_LOG_CAPACITY_DEFAULT = 1000;

/**
 * Ordered store of console lines capped to the newest lines, with change
 * listeners. One shared log collects the messages of every editor system.
 */
export class ConsoleLog {
  private static sharedInstance: ConsoleLog | null = null;
  private readonly capacity: number;
  private readonly clock: () => number;
  private readonly entries: ConsoleLogEntry[] = [];
  private readonly changeListeners = new Set<ConsoleLogChangeListener>();
  private nextSequence = 1;

  /**
   * Creates an empty log.
   *
   * @param capacity Most lines kept; at least one.
   * @param clock Returns the current time in milliseconds since the Unix epoch.
   */
  constructor(capacity: number = CONSOLE_LOG_CAPACITY_DEFAULT, clock: () => number = () => Date.now()) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.clock = clock;
  }

  /**
   * Returns the log every editor system writes to, creating it on first use.
   *
   * @returns The shared log.
   */
  static shared(): ConsoleLog {
    ConsoleLog.sharedInstance ??= new ConsoleLog();
    return ConsoleLog.sharedInstance;
  }

  /** Replaces the shared log with a new empty one so tests start clean. */
  static resetForTests(): void {
    ConsoleLog.sharedInstance = null;
  }

  /**
   * Writes an informational line.
   *
   * @param text Message text.
   */
  entryAppendInfo(text: string): void {
    this.entryAppend('info', text);
  }

  /**
   * Writes a warning line.
   *
   * @param text Message text.
   */
  entryAppendWarning(text: string): void {
    this.entryAppend('warning', text);
  }

  /**
   * Writes an error line.
   *
   * @param text Message text.
   */
  entryAppendError(text: string): void {
    this.entryAppend('error', text);
  }

  /**
   * Writes a line, dropping the oldest lines beyond the capacity.
   *
   * @param level Importance of the line.
   * @param text Message text.
   */
  entryAppend(level: ConsoleLogLevel, text: string): void {
    const entry: ConsoleLogEntry = {
      sequence: this.nextSequence,
      level,
      timestampMilliseconds: this.clock(),
      text,
    };
    this.nextSequence += 1;
    this.entries.push(entry);
    const droppedCount = this.entriesOverCapacityDrop();
    this.changeNotify({ kind: 'append', entry, droppedCount });
  }

  /**
   * Returns every kept line, oldest first.
   *
   * @returns Read-only view of the lines; do not keep it across writes.
   */
  entriesRead(): readonly ConsoleLogEntry[] {
    return this.entries;
  }

  /**
   * Returns the newest lines, oldest first.
   *
   * @param limit Most lines returned; zero or less returns none.
   * @returns Independent list of the newest lines.
   */
  entriesRecentRead(limit: number): ConsoleLogEntry[] {
    const count = Math.max(0, Math.floor(limit));
    if (count === 0) {
      return [];
    }
    return this.entries.slice(-count);
  }

  /** Removes every line. */
  clear(): void {
    this.entries.length = 0;
    this.changeNotify({ kind: 'clear' });
  }

  /**
   * Registers a callback run after every write and clear.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: ConsoleLogChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Drops the oldest lines beyond the capacity.
   *
   * @returns How many lines were dropped.
   */
  private entriesOverCapacityDrop(): number {
    const droppedCount = Math.max(0, this.entries.length - this.capacity);
    if (droppedCount > 0) {
      this.entries.splice(0, droppedCount);
    }
    return droppedCount;
  }

  /**
   * Runs every change listener.
   *
   * @param change What changed.
   */
  private changeNotify(change: ConsoleLogChange): void {
    this.changeListeners.forEach((listener) => listener(change));
  }
}
