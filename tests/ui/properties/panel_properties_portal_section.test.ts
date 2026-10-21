import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import type { PanelPropertiesEntitySection } from '@/ui/properties/panel_properties_entity_section.js';
import { PanelPropertiesPortalSection } from '@/ui/properties/panel_properties_portal_section.js';
import { PanelPropertiesRoomSection } from '@/ui/properties/panel_properties_room_section.js';

/**
 * Returns the plain section chrome factories.
 *
 * @returns Container and header factories.
 */
function chromeFactories(): [() => HTMLElement, (title: string) => HTMLElement] {
  return [
    () => document.createElement('div'),
    (title) => {
      const header = document.createElement('h3');
      header.textContent = title;
      return header;
    },
  ];
}

/**
 * Types a value into a field found by its accessible name and commits it.
 *
 * @param section Inspector section.
 * @param ariaLabel Accessible name.
 * @param value New value text.
 */
function fieldCommit(section: PanelPropertiesEntitySection<object>, ariaLabel: string, value: string): void {
  const field = section.getElement().querySelector(`[aria-label="${ariaLabel}"]`);
  if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
    throw new Error(`missing field ${ariaLabel}`);
  }
  field.value = value;
  field.dispatchEvent(new Event('change'));
}

/**
 * The room and portal inspectors edit their owners with undo and ignore other
 * kinds.
 */
describe('room and portal inspector sections', () => {
  it('shows the room section only for rooms and the portal section only for portals', () => {
    const roomSection = new PanelPropertiesRoomSection(...chromeFactories());
    const portalSection = new PanelPropertiesPortalSection(...chromeFactories());
    const room = RoomOwner.createDefault('Hall');
    const portal = PortalOwner.createDefault('Door');
    roomSection.updateFromObjects([room]);
    portalSection.updateFromObjects([room]);
    expect(roomSection.getElement().style.display).toBe('block');
    expect(portalSection.getElement().style.display).toBe('none');
    portalSection.updateFromObjects([portal, LightOwner.createDefault('Lamp', 'point')]);
    expect(portalSection.getElement().style.display).toBe('none');
  });

  it('edits room half sizes through undo', () => {
    const stack = new CommandStack(8);
    const section = new PanelPropertiesRoomSection(...chromeFactories());
    const room = RoomOwner.createDefault('Hall');
    const before = RoomOwner.settingsRead(room);
    section.setCommandStack(stack);
    section.updateFromObjects([room]);
    fieldCommit(section, 'Room half size Y', '4.5');
    expect(RoomOwner.settingsRead(room)?.halfSizeY).toBe(4.5);
    stack.undo();
    expect(RoomOwner.settingsRead(room)).toEqual(before);
  });

  it('closes, reopens and resizes several portals at once', () => {
    const section = new PanelPropertiesPortalSection(...chromeFactories());
    const portals = [PortalOwner.createDefault('Door A'), PortalOwner.createDefault('Door B')];
    section.updateFromObjects(portals);
    fieldCommit(section, 'Portal closed', 'on');
    expect(portals.every((portal) => PortalOwner.settingsRead(portal)?.closed === true)).toBe(true);
    fieldCommit(section, 'Portal width', '2.25');
    expect(portals.map((portal) => PortalOwner.settingsRead(portal)?.width)).toEqual([2.25, 2.25]);
    fieldCommit(section, 'Portal closed', 'off');
    expect(PortalOwner.settingsRead(portals[0] ?? PortalOwner.createDefault('x'))?.closed).toBe(false);
  });
});
