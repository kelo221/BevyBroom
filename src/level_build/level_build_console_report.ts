import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { LevelBuildResult } from '@/level_build/controller_level_build.js';

/**
 * Writes the outcome of Build Level to the console: where the package went, or
 * the reason and every problem that stopped it.
 *
 * @param result Build outcome.
 * @param consoleLog Log to write to; the shared console by default.
 */
export function levelBuildConsoleReport(result: LevelBuildResult, consoleLog: ConsoleLog = ConsoleLog.shared()): void {
  if (result.ok) {
    consoleLog.entryAppendInfo(
      `Built level ${result.levelName}: ${result.objectCount} object(s), ${result.materials.length} material(s) in ${result.levelDirectory}/${result.geometryFile}`,
    );
    return;
  }
  consoleLog.entryAppendError(`Build Level: ${result.message}`);
  result.problems.forEach((problem) =>
    consoleLog.entryAppendError(`Build Level: ${problem.objectName}: ${problem.description}`),
  );
}
