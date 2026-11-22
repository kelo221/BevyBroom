import { type PreviewLaunchCommand, previewLaunchCommandFromSection } from '@/preview/launch/preview_launch_command.js';
import { RunConfigurationParser } from '@/project/run_configuration/model/run_configuration_parser.js';
import type {
  GameProcessCommandStartResult,
  GameProcessCommandStatus,
  RunConfiguration,
  RunConfigurationCommandSection,
  RunConfigurationsWriteResult,
} from '@/project/run_configuration/model/run_configuration_types.js';
import { RunConfigurationProjectFileWriter } from '@/desktop/bun/run_configuration/run_configuration_project_file_writer.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import { ProjectDefinitionValidator } from '@/project/model/project_definition_validator.js';
import type {
  GameProcessAction,
  GameProcessLevelTarget,
  GameProcessPhase,
  GameProcessStatus,
  ProjectOpenResult,
  ProjectSummary,
} from '@/project/process/game_process_types.js';
import type { GameProcessHandle, GameProcessSpawner } from '@/desktop/bun/game_process/game_process_spawner.js';
import type { GameProcessProjectReader } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { GAME_PROCESS_LOG_EDITOR_PREFIX, GameProcessLog } from '@/desktop/bun/game_process/game_process_log.js';
import { GameProcessLaunchPlaceholders } from '@/project/process/launch_level/game_process_launch_placeholders.js';

/** Why the game of a project without a preview section cannot be started. */
export const GAME_PROCESS_NO_PREVIEW_REFUSAL =
  'The project file has no "preview" section, so the editor cannot build or start its game. Levels, textures, classes and prefabs still work.';

/** Why a game whose arguments name the open level cannot start without one. */
export const GAME_PROCESS_NO_LEVEL_REFUSAL =
  'The game starts in the open level ({level_id} in its arguments), so open or save a project level first.';

/** Why a command whose arguments name the open level cannot run without one. */
export const GAME_PROCESS_COMMAND_NO_LEVEL_REFUSAL =
  'The command names the open level ({level_id} or another level placeholder), so open or save a project level first.';

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
  private pendingWorkCount = 0;
  private command: GameProcessCommandStatus | null = null;
  private commandIdentifierNext = 1;
  private readonly runConfigurationWriter: RunConfigurationProjectFileWriter;

  /**
   * Creates a host without a project.
   *
   * @param spawner Starts programs.
   * @param reader Reads project files.
   * @param runConfigurationWriter Stores run configurations in project files.
   */
  constructor(
    spawner: GameProcessSpawner,
    reader: GameProcessProjectReader,
    runConfigurationWriter: RunConfigurationProjectFileWriter = new RunConfigurationProjectFileWriter(),
  ) {
    this.spawner = spawner;
    this.reader = reader;
    this.runConfigurationWriter = runConfigurationWriter;
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
   * @param level Level the game starts in, or null for none.
   * @returns Status right after the action was scheduled.
   */
  actionStart(action: GameProcessAction, level: GameProcessLevelTarget | null = null): GameProcessStatus {
    const refusal = this.actionRefusalDescribe(action) ?? this.levelRefusalDescribe(action, level);
    if (refusal !== null) {
      this.message = refusal;
      return this.statusRead();
    }
    void this.enqueue(() => this.actionRun(action, level));
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
   * Returns the definition of the open project.
   *
   * @returns Project definition, or null when no project is open.
   */
  projectDefinitionRead(): ProjectDefinition | null {
    return this.project?.definition ?? null;
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
      gameNotices: [...this.log.gameNoticesRead()],
      logTail: this.log.tailRead(),
      message: this.message,
      generation: this.generation,
      isBusy: this.pendingWorkCount > 0,
      command: this.command === null ? null : { ...this.command },
    };
  }

  /**
   * Schedules a command a run configuration asked for; it runs to its end after
   * everything scheduled before it.
   *
   * @param section Program, arguments and folder of the command.
   * @param level Open level for level placeholders, or null for none.
   * @returns Identifier of the command, or null with the reason in the status.
   */
  commandStart(
    section: RunConfigurationCommandSection,
    level: GameProcessLevelTarget | null,
  ): GameProcessCommandStartResult {
    const resolved = this.commandResolve(section, level);
    if (typeof resolved === 'string') {
      this.message = resolved;
      return { identifier: null, status: this.statusRead() };
    }
    const identifier = this.commandIdentifierNext;
    this.commandIdentifierNext += 1;
    this.command = { identifier, state: 'queued', exitCode: null };
    void this.enqueue(() => this.commandRun(identifier, resolved));
    return { identifier, status: this.statusRead() };
  }

  /**
   * Stores run configurations in the open project's file and uses them at once.
   *
   * @param configurations Configurations to store.
   * @returns The stored configurations, or why they were not stored.
   */
  runConfigurationsWrite(configurations: readonly RunConfiguration[]): RunConfigurationsWriteResult {
    const project = this.project;
    if (project === null) {
      return { ok: false, message: 'Open a project first.' };
    }
    try {
      const normalized = RunConfigurationParser.listRead(RunConfigurationParser.listWrite(configurations));
      this.runConfigurationWriter.write(project.definition.projectFile, normalized);
      project.definition = { ...project.definition, runConfigurations: normalized };
      project.summary = { ...project.summary, runConfigurations: normalized };
      return { ok: true, configurations: normalized };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
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
    if (!this.project.definition.launch) {
      return GAME_PROCESS_NO_PREVIEW_REFUSAL;
    }
    const blocking = this.project.summary.problems.find((problem) => problem.severity === 'error');
    if (blocking) {
      return `The project cannot start its game: ${blocking.message}`;
    }
    return action === 'rebuild' && !this.project.definition.build ? 'The project names no build command.' : null;
  }

  /**
   * Explains why a game whose arguments name the open level cannot start.
   *
   * @param action Requested action.
   * @param level Level the game starts in, or null for none.
   * @returns Reason, or null when the action may run.
   */
  private levelRefusalDescribe(action: GameProcessAction, level: GameProcessLevelTarget | null): string | null {
    const isLevelNeeded = action !== 'stop' && this.project?.summary.isLevelLaunch === true;
    return isLevelNeeded && level === null ? GAME_PROCESS_NO_LEVEL_REFUSAL : null;
  }

  /**
   * Runs one action.
   *
   * @param action Action to run.
   * @param level Level the game starts in, or null for none.
   */
  private async actionRun(action: GameProcessAction, level: GameProcessLevelTarget | null): Promise<void> {
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
      this.startRun(level);
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

  /**
   * Starts the game and watches it until it exits.
   *
   * @param level Level the game starts in, or null for none.
   */
  private startRun(level: GameProcessLevelTarget | null): void {
    const launch = this.launchCommandResolve(level);
    if (!launch) {
      return;
    }
    this.phaseWrite('starting', `Starting ${launch.program}${level === null ? '' : ` in level ${level.levelId}`}.`);
    this.log.gameBegin();
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
   * Returns the command that starts the game with the level placeholders
   * replaced.
   *
   * @param level Level the game starts in, or null for none.
   * @returns Command, or null when the project starts no game.
   */
  private launchCommandResolve(level: GameProcessLevelTarget | null): PreviewLaunchCommand | null {
    const definition = this.project?.definition ?? null;
    if (definition === null || definition.launch === null) {
      return null;
    }
    if (level === null) {
      return definition.launch;
    }
    const values = GameProcessLaunchPlaceholders.valuesCreate(definition, level);
    return GameProcessLaunchPlaceholders.commandResolve(definition.launch, values);
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
    this.phaseWrite('exited', this.exitMessageCreate(exitCode));
  }

  /**
   * Describes the end of a game; a failing game also names the last line it
   * printed, which usually says why it stopped.
   *
   * @param exitCode Exit code of the game.
   * @returns Message for the user.
   */
  private exitMessageCreate(exitCode: number): string {
    const lastLine = exitCode === 0 ? null : this.log.programLineNewestRead();
    return lastLine === null
      ? `The game exited with code ${exitCode}.`
      : `The game exited with code ${exitCode}: ${lastLine}`;
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
   * Turns a command section into the command to run, with placeholders
   * replaced.
   *
   * @param section Program, arguments and folder of the command.
   * @param level Open level for level placeholders, or null for none.
   * @returns Command, or why it cannot run.
   */
  private commandResolve(
    section: RunConfigurationCommandSection,
    level: GameProcessLevelTarget | null,
  ): PreviewLaunchCommand | string {
    const definition = this.project?.definition ?? null;
    if (definition === null) {
      return 'Open a project first.';
    }
    try {
      const command = previewLaunchCommandFromSection({ ...section }, definition.projectDirectory, 'command');
      if (level === null && GameProcessLaunchPlaceholders.isLevelNeeded(command)) {
        return GAME_PROCESS_COMMAND_NO_LEVEL_REFUSAL;
      }
      const values =
        level === null
          ? GameProcessLaunchPlaceholders.projectValuesCreate(definition)
          : GameProcessLaunchPlaceholders.valuesCreate(definition, level);
      return GameProcessLaunchPlaceholders.commandResolve(command, values);
    } catch (error) {
      return `The command cannot run: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Runs a scheduled command to its end and records how it ended.
   *
   * @param identifier Identifier of the command.
   * @param command Command with placeholders replaced.
   */
  private async commandRun(identifier: number, command: PreviewLaunchCommand): Promise<void> {
    this.commandStateWrite(identifier, 'running', null);
    this.phaseWrite(this.phase, `Running ${command.program} ${command.arguments.join(' ')}.`);
    const exitCode = await this.commandRunToEnd(command);
    this.commandStateWrite(identifier, exitCode === 0 ? 'succeeded' : 'failed', exitCode);
    const lastLine = exitCode === 0 ? null : this.log.programLineNewestRead();
    const ending = exitCode === 0 ? 'finished' : `failed with exit code ${exitCode}`;
    this.phaseWrite(this.phase, `${command.program} ${ending}${lastLine === null ? '.' : `: ${lastLine}`}`);
  }

  /**
   * Records the state of a command when it is still the last one asked for.
   *
   * @param identifier Identifier of the command.
   * @param state New state.
   * @param exitCode Exit code once it ended, or null before.
   */
  private commandStateWrite(
    identifier: number,
    state: GameProcessCommandStatus['state'],
    exitCode: number | null,
  ): void {
    if (this.command?.identifier === identifier) {
      this.command = { identifier, state, exitCode };
    }
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
      endpoint: definition.launch?.endpoint ?? '',
      canLaunch: definition.launch !== null,
      canBuild: definition.build !== null,
      isLevelLaunch: GameProcessLaunchPlaceholders.isLevelNeeded(definition.launch),
      isLevelExportLaunch: GameProcessLaunchPlaceholders.isLevelExportNeeded(definition.launch),
      toolTextures: definition.toolTextures,
      runConfigurations: definition.runConfigurations,
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
    this.log.lineAdd(`${GAME_PROCESS_LOG_EDITOR_PREFIX}${message}`);
  }

  /**
   * Runs work after everything scheduled before it.
   *
   * @param work Work to run.
   * @returns Promise settling after the work.
   */
  private enqueue(work: () => Promise<void>): Promise<void> {
    this.pendingWorkCount += 1;
    const next = this.queue
      .then(work)
      .catch((error: unknown) => {
        this.phaseWrite(this.phase, `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        this.pendingWorkCount -= 1;
      });
    this.queue = next;
    return next;
  }
}
