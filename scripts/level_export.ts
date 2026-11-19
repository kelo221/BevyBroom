/**
 * Exports one level of a game project without the editor:
 *
 * Bun scripts/level_export.ts --project <broom.project.json> --level <id>
 * [--out <dir>] [--check]
 *
 * Writes `geometry.glb`, `level.broom.json` and `collision.json` into the
 * project's level directory (or `--out`). With `--check` it writes nothing and
 * exits with 1, naming the files, when the package on disk differs from what
 * the document produces now.
 */
import { LevelExportHeadlessEnvironment } from '@/level_export/cli/level_export_headless_environment.js';

LevelExportHeadlessEnvironment.install();
const { LevelExportCliArgumentsParser } = await import('@/level_export/cli/level_export_cli_arguments.js');
const { LevelExportRunner } = await import('@/level_export/cli/level_export_runner.js');

try {
  const result = await LevelExportRunner.run(LevelExportCliArgumentsParser.parse(process.argv.slice(2)));
  console.log(result.message);
  result.differences.forEach((name) => console.log(`  differs: ${name}`));
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
