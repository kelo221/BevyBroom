import type {
  RunConfiguration,
  RunConfigurationFieldValue,
  RunConfigurationStep,
} from '@/project/run_configuration/model/run_configuration_types.js';
import { RunConfigurationStepKindRegistry } from '@/project/run_configuration/steps/run_configuration_step_kind_registry.js';

/** Name of a configuration the editor adds. */
const RUN_CONFIGURATION_EDITOR_NEW_NAME = 'New Configuration';

/**
 * Working copy of run configurations the Run Configurations dialog edits: the
 * list, which configuration and step are selected, and which configuration is
 * active. Nothing reaches the project until the dialog saves the copy.
 */
export class RunConfigurationEditorModel {
  private configurations: RunConfiguration[];
  private selectedConfigurationIndex: number;
  private selectedStepIndex: number;
  private activeId: string | null;

  /**
   * Creates the working copy.
   *
   * @param configurations Configurations to edit; they are copied.
   * @param activeId Active configuration id, or null.
   */
  constructor(configurations: readonly RunConfiguration[], activeId: string | null) {
    this.configurations = configurations.map((configuration) =>
      RunConfigurationEditorModel.configurationCopy(configuration),
    );
    const activeIndex = this.configurations.findIndex((configuration) => configuration.id === activeId);
    this.selectedConfigurationIndex = Math.max(0, activeIndex);
    this.selectedStepIndex = 0;
    this.activeId = activeId;
  }

  /**
   * Returns every configuration of the copy.
   *
   * @returns Configurations in order.
   */
  configurationsRead(): readonly RunConfiguration[] {
    return this.configurations;
  }

  /**
   * Returns the selected configuration.
   *
   * @returns Configuration, or null when the list is empty.
   */
  selectedConfigurationRead(): RunConfiguration | null {
    return this.configurations[this.selectedConfigurationIndex] ?? null;
  }

  /**
   * Returns the position of the selected configuration.
   *
   * @returns Index into the list.
   */
  selectedConfigurationIndexRead(): number {
    return this.selectedConfigurationIndex;
  }

  /**
   * Returns the selected step of the selected configuration.
   *
   * @returns Step, or null when the configuration has none.
   */
  selectedStepRead(): RunConfigurationStep | null {
    return this.selectedConfigurationRead()?.steps[this.selectedStepIndex] ?? null;
  }

  /**
   * Returns the position of the selected step.
   *
   * @returns Index into the selected configuration's steps.
   */
  selectedStepIndexRead(): number {
    return this.selectedStepIndex;
  }

  /**
   * Returns the id of the active configuration.
   *
   * @returns Active id, the first configuration's id when the active one is
   *   gone, or null for an empty list.
   */
  activeIdRead(): string | null {
    const isPresent = this.configurations.some((configuration) => configuration.id === this.activeId);
    return isPresent ? this.activeId : (this.configurations[0]?.id ?? null);
  }

  /**
   * Selects a configuration and its first step.
   *
   * @param index Position in the list; clamped into it.
   */
  configurationSelect(index: number): void {
    this.selectedConfigurationIndex = RunConfigurationEditorModel.indexClamp(index, this.configurations.length);
    this.selectedStepIndex = 0;
  }

  /** Adds an empty configuration with a unique id and selects it. */
  configurationAdd(): void {
    const id = this.identifierUniqueCreate(RUN_CONFIGURATION_EDITOR_NEW_NAME);
    this.configurations.push({ id, name: RUN_CONFIGURATION_EDITOR_NEW_NAME, steps: [] });
    this.configurationSelect(this.configurations.length - 1);
  }

  /** Adds a copy of the selected configuration after it and selects the copy. */
  configurationDuplicate(): void {
    const source = this.selectedConfigurationRead();
    if (source === null) {
      return;
    }
    const name = `${source.name} Copy`;
    const copy = {
      ...RunConfigurationEditorModel.configurationCopy(source),
      id: this.identifierUniqueCreate(name),
      name,
    };
    this.configurations.splice(this.selectedConfigurationIndex + 1, 0, copy);
    this.configurationSelect(this.selectedConfigurationIndex + 1);
  }

  /** Removes the selected configuration. */
  configurationRemove(): void {
    if (this.selectedConfigurationRead() === null) {
      return;
    }
    this.configurations.splice(this.selectedConfigurationIndex, 1);
    this.configurationSelect(this.selectedConfigurationIndex);
  }

  /**
   * Renames the selected configuration; blank names are ignored.
   *
   * @param name New name.
   */
  configurationRename(name: string): void {
    const configuration = this.selectedConfigurationRead();
    if (configuration !== null && name.trim() !== '') {
      configuration.name = name.trim();
    }
  }

  /** Makes the selected configuration the one F9 runs. */
  configurationActivate(): void {
    this.activeId = this.selectedConfigurationRead()?.id ?? this.activeId;
  }

  /**
   * Selects a step of the selected configuration.
   *
   * @param index Position in its steps; clamped into them.
   */
  stepSelect(index: number): void {
    const stepCount = this.selectedConfigurationRead()?.steps.length ?? 0;
    this.selectedStepIndex = RunConfigurationEditorModel.indexClamp(index, stepCount);
  }

  /**
   * Adds a new step of a kind after the selected step and selects it.
   *
   * @param kindId Step kind identifier; unknown kinds are ignored.
   */
  stepAdd(kindId: string): void {
    const configuration = this.selectedConfigurationRead();
    const kind = RunConfigurationStepKindRegistry.find(kindId);
    if (configuration === null || kind === null) {
      return;
    }
    const insertIndex = configuration.steps.length === 0 ? 0 : this.selectedStepIndex + 1;
    configuration.steps.splice(insertIndex, 0, kind.stepCreate());
    this.stepSelect(insertIndex);
  }

  /** Removes the selected step. */
  stepRemove(): void {
    const configuration = this.selectedConfigurationRead();
    if (configuration === null || this.selectedStepRead() === null) {
      return;
    }
    configuration.steps.splice(this.selectedStepIndex, 1);
    this.stepSelect(this.selectedStepIndex);
  }

  /**
   * Moves the selected step up or down and keeps it selected.
   *
   * @param offset -1 to move it up, 1 to move it down.
   */
  stepMove(offset: number): void {
    const steps = this.selectedConfigurationRead()?.steps ?? [];
    const targetIndex = this.selectedStepIndex + offset;
    const step = steps[this.selectedStepIndex];
    if (step === undefined || targetIndex < 0 || targetIndex >= steps.length) {
      return;
    }
    steps.splice(this.selectedStepIndex, 1);
    steps.splice(targetIndex, 0, step);
    this.selectedStepIndex = targetIndex;
  }

  /** Switches the selected step between enabled and skipped. */
  stepEnabledToggle(): void {
    const step = this.selectedStepRead();
    if (step !== null) {
      step.enabled = !step.enabled;
    }
  }

  /**
   * Writes one field of the selected step.
   *
   * @param key Field key.
   * @param value New value.
   */
  stepFieldWrite(key: string, value: RunConfigurationFieldValue): void {
    const step = this.selectedStepRead();
    if (step !== null) {
      step.fields[key] = Array.isArray(value) ? [...value] : value;
    }
  }

  /**
   * Creates an id from a name that no configuration of the copy uses.
   *
   * @param name Name the id is made from.
   * @returns Unique lowercase id.
   */
  private identifierUniqueCreate(name: string): string {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'configuration';
    const used = new Set(this.configurations.map((configuration) => configuration.id));
    let candidate = base;
    for (let suffix = 2; used.has(candidate); suffix += 1) {
      candidate = `${base}_${suffix}`;
    }
    return candidate;
  }

  /**
   * Clamps an index into a list.
   *
   * @param index Requested index.
   * @param length List length.
   * @returns Index inside the list, or 0 for an empty list.
   */
  private static indexClamp(index: number, length: number): number {
    return length === 0 ? 0 : Math.min(Math.max(index, 0), length - 1);
  }

  /**
   * Copies a configuration deeply.
   *
   * @param configuration Configuration to copy.
   * @returns Independent copy.
   */
  private static configurationCopy(configuration: RunConfiguration): RunConfiguration {
    return {
      ...configuration,
      steps: configuration.steps.map((step) => ({ ...step, fields: structuredClone(step.fields) })),
    };
  }
}
