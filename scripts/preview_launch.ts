import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { previewLaunchCommandFromProject } from '../src/preview/launch/preview_launch_command.js';

/**
 * Starts the game preview described by a broom.project.json and waits for it to
 * exit. Usage: bun scripts/preview_launch.ts <path to broom.project.json>
 */
async function previewLaunchMain(): Promise<void> {
  const projectArgument = process.argv[2];
  if (!projectArgument) {
    console.error('Usage: bun scripts/preview_launch.ts <path to broom.project.json>');
    process.exit(2);
  }
  const projectFile = resolve(projectArgument);
  const command = previewLaunchCommandFromProject(readFileSync(projectFile, 'utf8'), dirname(projectFile));
  console.log(
    `Starting game preview in ${command.workingDirectory}: ${command.program} ${command.arguments.join(' ')}`,
  );
  console.log(`Connect the editor (Game > Game Preview…) to ${command.endpoint || 'the endpoint the preview prints'}`);
  const child = Bun.spawn([command.program, ...command.arguments], {
    cwd: command.workingDirectory,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });
  process.exit(await child.exited);
}

await previewLaunchMain();
