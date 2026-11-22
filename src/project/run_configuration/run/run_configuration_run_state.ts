/** Where a run of a run configuration is. */
export type RunConfigurationRunPhase = 'running' | 'succeeded' | 'failed';

/** Progress of the last run of a run configuration. */
export interface RunConfigurationRunState {
  /** Identifier of the configuration. */
  readonly configurationId: string;
  /** Name of the configuration. */
  readonly configurationName: string;
  /** Where the run is. */
  readonly phase: RunConfigurationRunPhase;
  /**
   * Position of the step running now or the one that failed; the step count
   * once it succeeded.
   */
  readonly stepIndex: number;
  /** What happened last, for the user. */
  readonly message: string;
}
