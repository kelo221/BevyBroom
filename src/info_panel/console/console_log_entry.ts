import type { InfoPanelSeverity } from '@/info_panel/info_panel_severity.js';

/** Importance of one console line. */
export type ConsoleLogLevel = InfoPanelSeverity;

/** One line of the console. */
export interface ConsoleLogEntry {
  /** Increasing number of the line within its log, unique per log. */
  readonly sequence: number;
  /** Importance of the line. */
  readonly level: ConsoleLogLevel;
  /** Time the line was written, in milliseconds since the Unix epoch. */
  readonly timestampMilliseconds: number;
  /** Message text. */
  readonly text: string;
}

/** A line was written; the oldest lines may have been dropped to stay capped. */
export interface ConsoleLogChangeAppend {
  readonly kind: 'append';
  /** The new line. */
  readonly entry: ConsoleLogEntry;
  /** How many of the oldest lines were dropped by this write. */
  readonly droppedCount: number;
}

/** Every line was removed. */
export interface ConsoleLogChangeClear {
  readonly kind: 'clear';
}

/** What changed in a console log. */
export type ConsoleLogChange = ConsoleLogChangeAppend | ConsoleLogChangeClear;

/** Receives every change of a console log. */
export type ConsoleLogChangeListener = (change: ConsoleLogChange) => void;
