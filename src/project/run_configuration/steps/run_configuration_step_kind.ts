import type {
  RunConfigurationCommandSection,
  RunConfigurationFieldValue,
  RunConfigurationStep,
} from '@/project/run_configuration/model/run_configuration_types.js';

/** How a step field is edited: one line of text, or one text per line. */
export type RunConfigurationStepFieldType = 'text' | 'text_list';

/** Field a step kind reads from its steps, as the editor dialog shows it. */
export interface RunConfigurationStepField {
  /** Key of the field in the step. */
  readonly key: string;
  /** Label in the dialog. */
  readonly label: string;
  /** How the field is edited. */
  readonly type: RunConfigurationStepFieldType;
  /** Value of a new step. */
  readonly defaultValue: RunConfigurationFieldValue;
}

/**
 * What steps can ask the editor and the desktop app to do. Every method
 * resolves once the work ended, with null on success or the reason it failed.
 */
export interface RunConfigurationRunContext {
  /** Saves the open level. */
  levelSave(): Promise<string | null>;
  /** Builds the open level's package into the project. */
  levelPackageBuild(): Promise<string | null>;
  /**
   * Starts the game in the open level, or builds and starts it again when it
   * runs.
   */
  gamePlay(): Promise<string | null>;
  /** Stops the game the editor started. */
  gameStop(): Promise<string | null>;
  /** Runs a command to its end in the desktop app. */
  commandRun(command: RunConfigurationCommandSection): Promise<string | null>;
}

/**
 * Kind of run configuration step: its id and label, the fields it reads and
 * what it does. New kinds derive from this class and join the registry.
 */
export abstract class RunConfigurationStepKind {
  /** Identifier stored in the project file. */
  abstract readonly id: string;
  /** Name shown in the Run Configurations dialog. */
  abstract readonly label: string;

  /**
   * Runs one step of this kind.
   *
   * @param step Step to run.
   * @param context What the step may ask for.
   * @returns Null on success, or the reason it failed.
   */
  abstract run(step: RunConfigurationStep, context: RunConfigurationRunContext): Promise<string | null>;

  /**
   * Returns the fields steps of this kind read; none by default.
   *
   * @returns Fields in dialog order.
   */
  fieldsDescribe(): readonly RunConfigurationStepField[] {
    return [];
  }

  /**
   * Creates a new enabled step of this kind with default fields.
   *
   * @returns New step.
   */
  stepCreate(): RunConfigurationStep {
    const fields = Object.fromEntries(this.fieldsDescribe().map((field) => [field.key, field.defaultValue]));
    return { kind: this.id, enabled: true, fields };
  }

  /**
   * Describes one step in a single line for lists; the kind label by default.
   *
   * @param step Step to describe.
   * @returns One line.
   */
  summaryDescribe(step: RunConfigurationStep): string {
    void step;
    return this.label;
  }

  /**
   * Reads a text field of a step.
   *
   * @param step Step holding the field.
   * @param key Field key.
   * @returns The text, or an empty text when missing or a list.
   */
  protected textFieldRead(step: RunConfigurationStep, key: string): string {
    const value = step.fields[key];
    return typeof value === 'string' ? value : '';
  }

  /**
   * Reads a list field of a step.
   *
   * @param step Step holding the field.
   * @param key Field key.
   * @returns The texts; a single text becomes a list of one.
   */
  protected textListFieldRead(step: RunConfigurationStep, key: string): string[] {
    const value = step.fields[key];
    if (value === undefined) {
      return [];
    }
    return typeof value === 'string' ? [value] : [...value];
  }
}
