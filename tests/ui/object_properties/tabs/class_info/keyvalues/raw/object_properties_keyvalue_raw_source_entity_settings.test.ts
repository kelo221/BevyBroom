import { describe, expect, it } from 'vitest';
import { LightOwner } from '@/light/model/light_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { objectPropertiesKeyvalueEntitySettingCaptionLookup } from '@/ui/object_properties/tabs/class_info/keyvalues/raw/object_properties_keyvalue_entity_setting_caption.js';
import { ObjectPropertiesKeyvalueRawSourceEntitySettings } from '@/ui/object_properties/tabs/class_info/keyvalues/raw/object_properties_keyvalue_raw_source_entity_settings.js';
import { objectPropertiesTestContextCreate } from '../../../../object_properties_test_support.js';

/**
 * Returns the entity-settings source bound to a test tab context.
 *
 * @returns Entity-settings raw source.
 */
function entitySettingsSourceCreate(): ObjectPropertiesKeyvalueRawSourceEntitySettings {
  return new ObjectPropertiesKeyvalueRawSourceEntitySettings(objectPropertiesTestContextCreate([]).context);
}

describe('ObjectPropertiesKeyvalueRawSourceEntitySettings captions', () => {
  it('uses SmartEdit captions for known light and room settings', () => {
    const source = entitySettingsSourceCreate();
    const light = LightOwner.createDefault('Lamp', 'point');
    const radiusRow = source.rowsCreate([light]).find((row) => row.key === 'radius');
    const intensityRow = source.rowsCreate([light]).find((row) => row.key === 'intensity');
    expect(radiusRow?.label).toBe('Radius');
    expect(radiusRow?.helpText.toLowerCase()).toContain('radius');
    expect(radiusRow?.helpText).not.toBe('Setting radius of the light kind.');
    expect(intensityRow?.label).toBe('Intensity');
    const room = RoomOwner.createDefault('Hall');
    const halfX = source.rowsCreate([room]).find((row) => row.key === 'halfSizeX');
    expect(halfX?.label).toBe('Half X');
    expect(halfX?.helpText.toLowerCase()).toContain('half size');
  });

  it('falls back to the key when a setting has no caption', () => {
    const caption = objectPropertiesKeyvalueEntitySettingCaptionLookup('light', 'unknownSetting');
    expect(caption.label).toBe('unknownSetting');
    expect(caption.helpText).toBe('Setting unknownSetting of the light kind.');
  });
});
