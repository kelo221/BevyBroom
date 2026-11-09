import { keyValuesLocationDescribe } from './keyvalues_location.js';

/** A KeyValues text that cannot be read, with the file and line at fault. */
export class KeyValuesParseError extends Error {
  /** Path of the file that cannot be read. */
  readonly sourcePath: string;
  /** One-based line the problem was found on. */
  readonly line: number;
  /** What is wrong, without the location. */
  readonly reason: string;

  /**
   * Creates the error with a message of the form "path:line: reason".
   *
   * @param sourcePath Path of the file that cannot be read.
   * @param line One-based line the problem was found on.
   * @param reason What is wrong, without the location.
   */
  constructor(sourcePath: string, line: number, reason: string) {
    super(keyValuesLocationDescribe(sourcePath, line, reason));
    this.name = 'KeyValuesParseError';
    this.sourcePath = sourcePath;
    this.line = line;
    this.reason = reason;
  }
}
