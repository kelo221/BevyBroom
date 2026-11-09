import { keyValuesLocationDescribe } from '@/tools/sprinkle/definition/keyvalues/keyvalues_location.js';

/**
 * Collects the problems found in one sprinkle definition file into a shared
 * list.
 */
export class SprinkleDefinitionFileProblems {
  /** Path of the file the problems are about. */
  readonly sourcePath: string;
  private readonly sink: string[];

  /**
   * Creates a collector for one file.
   *
   * @param sourcePath Path of the file the problems are about.
   * @param sink List the problem descriptions are appended to.
   */
  constructor(sourcePath: string, sink: string[]) {
    this.sourcePath = sourcePath;
    this.sink = sink;
  }

  /**
   * Records a problem on one line of the file.
   *
   * @param line One-based line.
   * @param message What is wrong and what happens instead.
   */
  report(line: number, message: string): void {
    this.sink.push(keyValuesLocationDescribe(this.sourcePath, line, message));
  }

  /**
   * Records a problem that already names its location.
   *
   * @param message Complete problem description.
   */
  messageAdd(message: string): void {
    this.sink.push(message);
  }
}
