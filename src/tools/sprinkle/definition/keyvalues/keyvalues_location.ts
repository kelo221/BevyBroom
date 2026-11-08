/**
 * Formats a message about one line of a KeyValues file.
 *
 * @param sourcePath Path of the file the message is about.
 * @param line One-based line number.
 * @param message What is wrong on that line.
 * @returns Message prefixed with "path:line: ".
 */
export function keyValuesLocationDescribe(sourcePath: string, line: number, message: string): string {
  return `${sourcePath}:${line}: ${message}`;
}
