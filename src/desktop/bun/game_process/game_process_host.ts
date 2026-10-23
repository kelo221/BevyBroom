import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import { ProjectDefinitionValidator } from '@/project/model/project_definition_validator.js';
import type {
  GameProcessAction,
  GameProcessPhase,
  GameProcessStatus,
  ProjectOpenResult,
  ProjectSummary,
} from '@/project/process/game_process_types.js';
import type { GameProcessHandle, GameProcessSpawner } from '@/desktop/bun/game_process/game_process_spawner.js';
import type { GameProcessProjectReader } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { GameProcessLog } from '@/desktop/bun/game_process/game_process_log.js';

/** Open project with everything the host needs to run it. */
interface GameProcessOpenProject {
  definition: ProjectDefinition;
  summary: ProjectSummary;
}

/**
 * Builds, starts, restarts and stops the game of the open project. It only ever
 * ends processes it started itself; actions run one after another.
 */
export class GameProcessHost {
  private readonly spawner: GameProcessSpawner;
  private readonly reader: GameProcessProjectReader;
  private readonly log = new GameProcessLog();
  private project: GameProcessOpenProject | null = null;
  private phase: GameProcessPhase = 'idle';
  private handle: GameProcessHandle | null = null;
  private exitCode: number | null = null;
  private message = 'No project is open.';
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();

  /**
   * Creates a host without a project.
   *
   * @param spawner Starts programs.
   * @param reader Reads project files.
   */
  constructor(spawner: GameProcessSpawner, reader: GameProcessProjectReader) {
    this.spawner = spawner;
    this.reader = reader;
  }

  /**
   * Opens a project, stopping the game of the previous project first.
   *
   * @param projectFile Absolute path of broom.project.json.
   * @returns The new status, or why the project cannot be opened.
   */
  async projectOpen(projectFile: string): Promise<ProjectOpenResult> {
    let definition: ProjectDefinition;
    try {
      definition = ProjectDefinitionParser.parse(this.reader.textRead(projectFile), projectFile);
    } catch (error) {
      return {
        ok: false,
        message: `Cannot open ${projectFile}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    await this.enqueue(() => this.stopRun());
    this.project = { definition, summary: this.summaryCreate(definition) };
    this.phaseWrite('idle', `Opened project ${definition.name}.`);
    return { ok: true, status: this.statusRead() };
  }

  /**
   * Starts an action; it runs after every action started before it.
   *
   * @param action Action to run.
   * @returns Status right after the action was scheduled.
   */
  actionStart(action: GameProcessAction): GameProcessStatus {
    const refusal = this.actionRefusalDescribe(action);
    if (refusal !== null) {
      this.message = refusal;
      return this.statusRead();
    }
    void this.enqueue(() => this.actionRun(action));
    return this.statusRead();
  }

  /**
   * Waits until every scheduled action finished.
   *
   * @returns Status afterwards.
   */
  async idle(): Promise<GameProcessStatus> {
    await this.queue;
    return this.statusRead();
  }

  /**
   * Returns everything about the managed game.
   *
   * @returns Status snapshot.
   */
  statusRead(): GameProcessStatus {
    return {
      project: this.project?.summary ?? null,
      phase: this.phase,
      processId: this.handle?.processId ?? null,
      exitCode: this.exitCode,
      diagnostics: [...this.log.diagnosticsRead()],
      logTail: this.log.tailRead(),
      message: this.message,
      generation: this.generation,
    };
  }

  /** Stops the managed game, for example when the editor closes. */
  async dispose(): Promise<void> {
    await this.enqueue(() => this.stopRun());
  }

  /** Ends the managed game at once, for use while the editor process exits. */
  disposeNow(): void {
    this.handle?.terminateNow();
    this.handle = null;
  }

  /**
   * Explains why an action cannot run now.
   *
   * @param action Requested action.
   * @returns Reason, or null when the action may run.
   */
  private actionRefusalDescribe(action: GameProcessAction): string | null {
    if (action === 'stop') {
      return null;
    }
    if (!this.project) {
      return 'Open a project first.';
    }
    const blocking = this.project.summary.problems.find((problem) => problem.severity === 'error');
    if (blocking) {
      return `The project cannot start its game: ${blocking.message}`;
    }
    return action === 'rebuild' && !this.project.definition.build ? 'The project names no build command.' : null;
  }

  /**
   * Runs one action.
   *
   * @param action Action to run.
   */
  private async actionRun(action: GameProcessAction): Promise<void> {
    if (action !== 'launch') {
      await this.stopRun();
    }
    if (action === 'stop') {
      return;
    }
    if (action === 'launch' && this.handle) {
      this.message = 'The game is already running.';
      return;
    }
    const isBuilt = action === 'restart' ? true : await this.buildRun();
    if (isBuilt) {
      this.startRun();
    }
  }

  /**
   * Builds the game when the project has a build command.
   *
   * @returns True when there was nothing to build or the build succeeded.
   */
  private async buildRun(): Promise<boolean> {
    const build = this.project?.definition.build ?? null;
    if (!build) {
      return true;
    }
    this.log.buildBegin();
    this.phaseWrite('building', `Building with ${build.program} ${build.arguments.join(' ')}.`);
    const exitCode = await this.commandRunToEnd(build);
    const errors = this.log.buildEnd();
    if (exitCode === 0) {
      this.phaseWrite('idle', 'Build succeeded.');
      return true;
    }
    this.exitCode = exitCode;
    this.phaseWrite(
      'build_failed',
      `Build failed with ${errors} error${errors === 1 ? '' : 's'} (exit code ${exitCode}).`,
    );
    return false;
  }

  /**
   * Runs a command to its end, logging its output.
   *
   * @param command Command to run.
   * @returns Exit code; -1 when it could not be started.
   */
  private async commandRunToEnd(command: PreviewLaunchCommand): Promise<number> {
    try {
      return await this.spawner.spawn(command, (line) => this.log.lineAdd(line)).exited;
    } catch (error) {
      this.log.lineAdd(`could not start ${command.program}: ${error instanceof Error ? error.message : String(error)}`);
      return -1;
    }
  }

  /** Starts the game and watches it until it exits. */
  private startRun(): void {
    const launch = this.project?.definition.launch;
    if (!launch) {
      return;
    }
    this.phaseWrite('starting', `Starting ${launch.program}.`);
    try {
      this.handle = this.spawner.spawn(launch, (line) => this.log.lineAdd(line));
    } catch (error) {
      this.phaseWrite('exited', `The game could not start: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    this.exitCode = null;
    this.phaseWrite('running', `The game runs as process ${this.handle.processId}.`);
    void this.exitWatch(this.handle);
  }

  /**
   * Records the end of a managed game that ended on its own.
   *
   * @param handle Managed game.
   */
  private async exitWatch(handle: GameProcessHandle): Promise<void> {
    const exitCode = await handle.exited;
    if (this.handle !== handle) {
      return;
    }
    this.handle = null;
    this.exitCode = exitCode;
    this.phaseWrite('exited', `The game exited with code ${exitCode}.`);
  }

  /** Stops the managed game, if any. */
  private async stopRun(): Promise<void> {
    const handle = this.handle;
    if (!handle) {
      return;
    }
    this.handle = null;
    this.phaseWrite('stopping', `Stopping process ${handle.processId}.`);
    await handle.terminate();
    this.phaseWrite('stopped', 'The game was stopped.');
  }

  /**
   * Builds the summary of a project, including its problems.
   *
   * @param definition Parsed project.
   * @returns Summary.
   */
  private summaryCreate(definition: ProjectDefinition): ProjectSummary {
    return {
      projectFile: definition.projectFile,
      projectIdentifier: definition.projectIdentifier,
      name: definition.name,
      endpoint: definition.launch.endpoint,
      canBuild: definition.build !== null,
      problems: ProjectDefinitionValidator.validate(definition, this.reader),
    };
  }

  /**
   * Stores a phase and message and advances the generation.
   *
   * @param phase New phase.
   * @param message What happened.
   */
  private phaseWrite(phase: GameProcessPhase, message: string): void {
    this.phase = phase;
    this.message = message;
    this.generation += 1;
    this.log.lineAdd(`[editor] ${message}`);
  }

  /**
   * Runs work after everything scheduled before it.
   *
   * @param work Work to run.
   * @returns Promise settling after the work.
   */
  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.queue.then(work).catch((error: unknown) => {
      this.phaseWrite(this.phase, `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.queue = next;
    return next;
  }
}
