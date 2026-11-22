import {
  type ProjectFileSystem,
  projectFileSystemNodeCreate,
} from '@/desktop/bun/project_files/project_file_system_node.js';
import { previewLaunchProjectParse } from '@/preview/launch/preview_launch_command.js';
import { RunConfigurationParser } from '@/project/run_configuration/model/run_configuration_parser.js';
import {
  RUN_CONFIGURATIONS_PROJECT_KEY,
  type RunConfiguration,
} from '@/project/run_configuration/model/run_configuration_types.js';

/** Suffix of the file written before it replaces the project file. */
const RUN_CONFIGURATION_PROJECT_FILE_TEMPORARY_SUFFIX = '.run-configurations.tmp';

/**
 * Stores run configurations in a project file, leaving every other key of the
 * file as it was. The file is written next to itself first and then moved over
 * the old one, so a failed write never leaves half a project file.
 */
export class RunConfigurationProjectFileWriter {
  private readonly fileSystem: ProjectFileSystem;

  /**
   * Creates the writer.
   *
   * @param fileSystem File access; the disk by default.
   */
  constructor(fileSystem: ProjectFileSystem = projectFileSystemNodeCreate()) {
    this.fileSystem = fileSystem;
  }

  /**
   * Writes the configurations into the project file; an empty list removes the
   * key.
   *
   * @param projectFile Absolute path of broom.project.json.
   * @param configurations Configurations to store.
   */
  write(projectFile: string, configurations: readonly RunConfiguration[]): void {
    const project = previewLaunchProjectParse(new TextDecoder().decode(this.fileSystem.fileRead(projectFile)));
    RunConfigurationProjectFileWriter.projectKeyWrite(project, configurations);
    const temporaryFile = `${projectFile}${RUN_CONFIGURATION_PROJECT_FILE_TEMPORARY_SUFFIX}`;
    const text = `${JSON.stringify(project, null, 2)}\n`;
    this.fileSystem.fileWriteFlushed(temporaryFile, new TextEncoder().encode(text));
    this.fileSystem.fileRename(temporaryFile, projectFile);
  }

  /**
   * Sets or removes the run configuration key of a parsed project.
   *
   * @param project Parsed project file, changed in place.
   * @param configurations Configurations to store.
   */
  private static projectKeyWrite(project: Record<string, unknown>, configurations: readonly RunConfiguration[]): void {
    if (configurations.length === 0) {
      delete project[RUN_CONFIGURATIONS_PROJECT_KEY];
      return;
    }
    project[RUN_CONFIGURATIONS_PROJECT_KEY] = RunConfigurationParser.listWrite(configurations);
  }
}
