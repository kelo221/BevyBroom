import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { PanelLayers, type PanelLayersDependencies } from '@/layer/ui/panel_layers.js';
import { InfoPanelSources } from '@/info_panel/info_panel_sources.js';
import type { InfoPanelView } from '@/info_panel/info_panel_view.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import type { ShellInspector } from '@/layout/shell/inspector/shell_inspector.js';
import type { ShellInfoPanel } from '@/layout/shell/info_panel/shell_info_panel.js';

/** Docks and editor systems the docked layers, console and issues panels use. */
export interface ShellDockPanelsMountOptions {
  /** Inspector whose Map tab receives the layers panel. */
  inspector: ShellInspector;
  /** Info panel whose tabs receive the console and issues views. */
  infoPanel: ShellInfoPanel;
  /** Editor systems the layers panel works with. */
  layerDependencies: PanelLayersDependencies;
  /** World root that is validated. */
  worldGroup: THREE.Object3D;
  /** Command history whose changes make the map be validated again. */
  commandStack: Pick<CommandStack, 'onStackChanged' | 'offStackChanged'>;
  /** Runs with the issue of a clicked issues row. */
  onIssueActivate: (issue: Issue) => void;
}

/**
 * Mounts the layers panel into the inspector's Map tab and the console and
 * issues views into the info panel, and disposes them together.
 */
export class ShellDockPanelsMount {
  private readonly layersPanel: PanelLayers;
  private readonly infoPanelSources: InfoPanelSources;
  private readonly infoPanelViews: InfoPanelView[];

  /**
   * Creates and mounts the docked panels.
   *
   * @param options Docks and editor systems.
   */
  constructor(options: ShellDockPanelsMountOptions) {
    this.layersPanel = new PanelLayers(options.inspector.slotRead('map_layers'), options.layerDependencies);
    this.infoPanelSources = new InfoPanelSources({
      worldGroup: options.worldGroup,
      commandStack: options.commandStack,
    });
    this.infoPanelViews = [
      this.infoPanelViewMount(options.infoPanel.slotRead('console'), this.infoPanelSources.consoleViewCreate()),
      this.infoPanelViewMount(
        options.infoPanel.slotRead('issues'),
        this.infoPanelSources.issuesViewCreate((issue) => options.onIssueActivate(issue)),
      ),
    ];
  }

  /**
   * Returns the docked layers panel.
   *
   * @returns Layers panel.
   */
  layersPanelRead(): PanelLayers {
    return this.layersPanel;
  }

  /**
   * Validates the map at once and returns the found issues.
   *
   * @returns Issues of the map.
   */
  issuesValidateNow(): readonly Issue[] {
    return this.infoPanelSources.issuesScheduler.validationRunNow();
  }

  /** Disposes the layers panel, the info panel views and the issues validation. */
  dispose(): void {
    this.layersPanel.dispose();
    for (const infoPanelView of this.infoPanelViews) {
      infoPanelView.dispose();
    }
    this.infoPanelSources.dispose();
  }

  /**
   * Appends an info panel view to its tab slot.
   *
   * @param slot Tab slot that receives the view.
   * @param infoPanelView View to mount.
   * @returns The mounted view.
   */
  private infoPanelViewMount(slot: HTMLElement, infoPanelView: InfoPanelView): InfoPanelView {
    slot.appendChild(infoPanelView.getElement());
    return infoPanelView;
  }
}
