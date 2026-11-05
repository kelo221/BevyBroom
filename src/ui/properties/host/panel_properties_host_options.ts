import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { PanelPropertiesSection } from '@/ui/properties/panel_properties_section.js';

/** Opt-in changes a host makes to the properties panel while it holds it. */
export interface PanelPropertiesHostOptions {
  /** Objects the panel edits while hosted instead of following the selection. */
  readonly pinnedObjects?: readonly THREE.Object3D[];
  /** Returns false for registered sections the host does not show. */
  readonly sectionShown?: (section: PanelPropertiesSection) => boolean;
  /** Stack the panel pushes its edits onto while hosted. */
  readonly commandStack?: CommandStack;
}
