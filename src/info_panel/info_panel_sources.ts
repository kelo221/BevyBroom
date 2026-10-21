import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ConsoleView } from '@/info_panel/console/console_view.js';
import {
  IssuesScheduler,
  type IssuesSchedulerChangeSubscribe,
  type IssuesSchedulerTimerSource,
} from '@/info_panel/issues/issues_scheduler.js';
import { IssuesView, type IssuesViewActivateCallback } from '@/info_panel/issues/issues_view.js';

/** Collaborators of the info panel sources. */
export interface InfoPanelSourcesOptions {
  /** Editor world root that is validated. */
  worldGroup: THREE.Object3D;
  /** Command history whose changes make the map be validated again. */
  commandStack: Pick<CommandStack, 'onStackChanged' | 'offStackChanged'>;
  /** Timer used for the validation delay; defaults to the global timers. */
  timerSource?: IssuesSchedulerTimerSource;
  /** Log the console view shows; defaults to the shared log. */
  consoleLog?: ConsoleLog;
}

/**
 * Builds a change subscription on a command history.
 *
 * @param commandStack Command history.
 * @returns Subscribe function running its listener after every history change.
 */
export function infoPanelCommandStackSubscribeCreate(
  commandStack: Pick<CommandStack, 'onStackChanged' | 'offStackChanged'>,
): IssuesSchedulerChangeSubscribe {
  return (listener) => {
    const callback = (): void => listener();
    commandStack.onStackChanged(callback);
    return () => commandStack.offStackChanged(callback);
  };
}

/**
 * The data behind the bottom info panel: the console log and the issues
 * scheduler that validates the map after edits and when the game classes
 * change. Creates the views that show them.
 */
export class InfoPanelSources {
  /** Log shown by the console view. */
  readonly consoleLog: ConsoleLog;
  /** Scheduler holding the newest issues. */
  readonly issuesScheduler: IssuesScheduler;

  /**
   * Creates the sources and schedules the first validation.
   *
   * @param options Collaborators.
   */
  constructor(options: InfoPanelSourcesOptions) {
    this.consoleLog = options.consoleLog ?? ConsoleLog.shared();
    const schedulerOptions = {
      worldGroup: options.worldGroup,
      changeSubscribes: [
        infoPanelCommandStackSubscribeCreate(options.commandStack),
        (listener: () => void) => GameEntityClassRegistry.changeListenerAdd(listener),
      ],
    };
    this.issuesScheduler = new IssuesScheduler(
      options.timerSource ? { ...schedulerOptions, timerSource: options.timerSource } : schedulerOptions,
    );
  }

  /**
   * Creates a console view of the log.
   *
   * @returns New view; dispose it when its tab closes.
   */
  consoleViewCreate(): ConsoleView {
    return new ConsoleView(this.consoleLog);
  }

  /**
   * Creates an issues view of the scheduler.
   *
   * @param onIssueActivate Runs with the issue of a clicked row.
   * @returns New view; dispose it when its tab closes.
   */
  issuesViewCreate(onIssueActivate: IssuesViewActivateCallback): IssuesView {
    return new IssuesView(this.issuesScheduler, onIssueActivate);
  }

  /** Stops validating. */
  dispose(): void {
    this.issuesScheduler.dispose();
  }
}
