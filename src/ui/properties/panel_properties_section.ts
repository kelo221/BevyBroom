import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';

/** Element factories that give inspector sections the panel's look. */
export interface PanelPropertiesSectionChrome {
  /** Creates an empty section container. */
  createSectionContainer: () => HTMLElement;
  /** Creates a section header with the given title. */
  createSectionHeader: (title: string) => HTMLElement;
}

/** Inspector section that shows and edits data of the selected objects. */
export interface PanelPropertiesSection {
  /** Returns the section root element. */
  getElement(): HTMLElement;
  /** Sets the undo stack edits are pushed to, or null to apply them directly. */
  setCommandStack(stack: CommandStack | null): void;
  /** Shows, hides and fills the section for the current inspector selection. */
  updateFromObjects(objects: readonly THREE.Object3D[]): void;
}

/** Creates one inspector section with the panel's chrome. */
export type PanelPropertiesSectionFactory = (chrome: PanelPropertiesSectionChrome) => PanelPropertiesSection;
