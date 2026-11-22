import { PreviewLaunchCommandError, previewLaunchIsRecord } from '@/preview/launch/preview_launch_command.js';
import {
  RUN_CONFIGURATIONS_PROJECT_KEY,
  type RunConfiguration,
  type RunConfigurationFieldValue,
  type RunConfigurationStep,
} from '@/project/run_configuration/model/run_configuration_types.js';

/** Step keys that are not step fields. */
const RUN_CONFIGURATION_STEP_RESERVED_KEYS: readonly string[] = ['kind', 'enabled'];

/**
 * Reads run configurations from the project file and writes them back in the
 * same form: a list of `{ id, name, steps }` whose steps hold `kind`, an
 * optional `enabled: false` and the fields of their kind.
 */
export class RunConfigurationParser {
  /**
   * Reads the run configuration list of a project.
   *
   * @param project Parsed project file.
   * @returns Configurations in file order; none when the key is missing.
   * @throws PreviewLaunchCommandError when the list is malformed.
   */
  static projectRead(project: Record<string, unknown>): RunConfiguration[] {
    const value = project[RUN_CONFIGURATIONS_PROJECT_KEY];
    return value === undefined ? [] : RunConfigurationParser.listRead(value);
  }

  /**
   * Reads a run configuration list from untrusted data.
   *
   * @param value Any value.
   * @returns Configurations in order.
   * @throws PreviewLaunchCommandError when the list is malformed or ids repeat.
   */
  static listRead(value: unknown): RunConfiguration[] {
    if (!Array.isArray(value)) {
      throw new PreviewLaunchCommandError(`project.${RUN_CONFIGURATIONS_PROJECT_KEY} must be a list`);
    }
    const configurations = value.map((entry, index) => RunConfigurationParser.configurationRead(entry, index));
    RunConfigurationParser.identifiersUniqueAssert(configurations);
    return configurations;
  }

  /**
   * Turns configurations into the plain values the project file stores.
   *
   * @param configurations Configurations to write.
   * @returns JSON-ready list.
   */
  static listWrite(configurations: readonly RunConfiguration[]): Record<string, unknown>[] {
    return configurations.map((configuration) => ({
      id: configuration.id,
      name: configuration.name,
      steps: configuration.steps.map((step) => RunConfigurationParser.stepWrite(step)),
    }));
  }

  /**
   * Reads one configuration.
   *
   * @param entry Untrusted entry.
   * @param index Position in the list, for messages.
   * @returns Configuration.
   */
  private static configurationRead(entry: unknown, index: number): RunConfiguration {
    const path = `project.${RUN_CONFIGURATIONS_PROJECT_KEY}[${index}]`;
    if (!previewLaunchIsRecord(entry)) {
      throw new PreviewLaunchCommandError(`${path} must be an object`);
    }
    const steps = entry['steps'] ?? [];
    if (!Array.isArray(steps)) {
      throw new PreviewLaunchCommandError(`${path}.steps must be a list`);
    }
    return {
      id: RunConfigurationParser.textRead(entry, 'id', path),
      name: RunConfigurationParser.textRead(entry, 'name', path),
      steps: steps.map((step, stepIndex) => RunConfigurationParser.stepRead(step, `${path}.steps[${stepIndex}]`)),
    };
  }

  /**
   * Reads one step.
   *
   * @param entry Untrusted step.
   * @param path Location for messages.
   * @returns Step.
   */
  private static stepRead(entry: unknown, path: string): RunConfigurationStep {
    if (!previewLaunchIsRecord(entry)) {
      throw new PreviewLaunchCommandError(`${path} must be an object`);
    }
    const enabled = entry['enabled'] ?? true;
    if (typeof enabled !== 'boolean') {
      throw new PreviewLaunchCommandError(`${path}.enabled must be true or false`);
    }
    return {
      kind: RunConfigurationParser.textRead(entry, 'kind', path),
      enabled,
      fields: RunConfigurationParser.fieldsRead(entry, path),
    };
  }

  /**
   * Reads the fields of a step: every key but kind and enabled.
   *
   * @param entry Step object.
   * @param path Location for messages.
   * @returns Fields by key.
   */
  private static fieldsRead(entry: Record<string, unknown>, path: string): Record<string, RunConfigurationFieldValue> {
    const fields: Record<string, RunConfigurationFieldValue> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (RUN_CONFIGURATION_STEP_RESERVED_KEYS.includes(key)) {
        continue;
      }
      if (!RunConfigurationParser.fieldValueIs(value)) {
        throw new PreviewLaunchCommandError(`${path}.${key} must be a text or a list of texts`);
      }
      fields[key] = Array.isArray(value) ? [...value] : value;
    }
    return fields;
  }

  /**
   * Returns whether a value can be a step field.
   *
   * @param value Any value.
   * @returns True for texts and lists of texts.
   */
  private static fieldValueIs(value: unknown): value is RunConfigurationFieldValue {
    return typeof value === 'string' || (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));
  }

  /**
   * Reads a required non-empty text.
   *
   * @param entry Object holding the text.
   * @param key Key of the text.
   * @param path Location for messages.
   * @returns Trimmed text.
   */
  private static textRead(entry: Record<string, unknown>, key: string, path: string): string {
    const value = entry[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new PreviewLaunchCommandError(`${path}.${key} must be a non-empty text`);
    }
    return value.trim();
  }

  /**
   * Turns one step into its stored form.
   *
   * @param step Step to write.
   * @returns JSON-ready step.
   */
  private static stepWrite(step: RunConfigurationStep): Record<string, unknown> {
    const enabledPart = step.enabled ? {} : { enabled: false };
    return { kind: step.kind, ...enabledPart, ...step.fields };
  }

  /**
   * Fails when two configurations share an id.
   *
   * @param configurations Configurations read.
   */
  private static identifiersUniqueAssert(configurations: readonly RunConfiguration[]): void {
    const seen = new Set<string>();
    for (const configuration of configurations) {
      if (seen.has(configuration.id)) {
        throw new PreviewLaunchCommandError(`run configuration id "${configuration.id}" is used twice`);
      }
      seen.add(configuration.id);
    }
  }
}
