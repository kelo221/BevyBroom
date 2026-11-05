import type * as THREE from 'three';
import { Theme } from '@/theme.js';
import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { panelPropertiesRowCaptionPaint } from '@/ui/properties/panel_properties_row.js';
import type { UserVisGroup } from '@/visgroup/visgroup_types.js';
import type { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { CommandVisGroupMembershipAdd } from '@/visgroup/commands/command_visgroup_membership_add.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { CommandVisGroupMembershipRemove } from '@/visgroup/commands/command_visgroup_membership_remove.js';

/**
 * Membership section of the VisGroup tab: one checkbox per user VisGroup that
 * shows whether the edited objects belong to it and toggles that membership for
 * all of them as one undoable edit.
 */
export class ObjectPropertiesVisGroupSectionMembership extends ObjectPropertiesTabSection {
  private readonly store: VisGroupStore;
  private readonly list: HTMLElement;
  private objects: readonly THREE.Object3D[];

  /**
   * Creates the membership section.
   *
   * @param context Tab context the membership edits are pushed through.
   * @param store VisGroup store whose user groups are listed.
   */
  constructor(context: ObjectPropertiesTabContext, store: VisGroupStore) {
    super(context, 'Member of');
    this.store = store;
    this.objects = [];
    this.list = document.createElement('div');
    this.element.appendChild(this.list);
  }

  /**
   * Lists every user VisGroup with the membership of the edited objects.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    this.objects = objects;
    const groups = this.store.userGroupsList();
    this.list.replaceChildren(...groups.map((group) => this.groupRowCreate(group)));
    if (groups.length === 0) {
      this.list.appendChild(this.emptyNoteCreate());
    }
  }

  /**
   * Creates the checkbox row of one VisGroup.
   *
   * @param group User VisGroup.
   * @returns Row element.
   */
  private groupRowCreate(group: UserVisGroup): HTMLElement {
    const checkbox = new InputCheckbox(group.name);
    checkbox.setSharedValues(this.objects.map((object) => this.store.objectGroupIdsRead(object).includes(group.id)));
    checkbox.bindCommit(() => this.membershipCommit(group.id, checkbox.getValue()));
    const row = document.createElement('label');
    row.dataset['visgroupId'] = group.id;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.padding = '2px 0';
    const caption = document.createElement('span');
    caption.textContent = group.name;
    panelPropertiesRowCaptionPaint(caption, Theme.uiFontFamily);
    row.append(checkbox.getElement(), caption);
    return row;
  }

  /**
   * Adds the edited objects to, or removes them from, one VisGroup.
   *
   * @param groupId User VisGroup id.
   * @param isMember True to add, false to remove.
   */
  private membershipCommit(groupId: string, isMember: boolean): void {
    this.commandPush(
      isMember
        ? new CommandVisGroupMembershipAdd(this.store, this.objects, groupId)
        : new CommandVisGroupMembershipRemove(this.store, this.objects, groupId),
    );
    this.refresh(this.objects);
  }

  /**
   * Creates the note shown when no user VisGroup exists.
   *
   * @returns Note element.
   */
  private emptyNoteCreate(): HTMLElement {
    const note = document.createElement('div');
    note.textContent = 'No VisGroups. Create one in the VisGroups panel.';
    note.style.color = Theme.statusBarTextColor;
    note.style.fontSize = '11px';
    return note;
  }
}
