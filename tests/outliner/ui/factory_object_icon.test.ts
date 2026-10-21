import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FactoryObjectIcon } from '@/outliner/ui/factory_object_icon.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { markAsSolidCsgGroup, setSolidGroupOperation } from '@/solid/model/solid_group.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { roomSettingsCreateDefault } from '@/portal/model/room_settings.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { outlinerItemApplyIconFromObject } from '@/outliner/ui/outliner_item_icon.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { IconRegistry } from '@/ui/icons/icon_registry.js';
import { hexToRgb } from '@/utils/utils_color.js';

describe('ObjectIconFactory.getIcon', () => {
  it('should return group icon for THREE.Group', () => {
    const group = new THREE.Group();
    const icon = FactoryObjectIcon.getIcon(group);
    expect(icon.character).toBe('📁');
    expect(icon.color).toBe('#e67e22');
    expect(icon.badgeCharacter).toBeUndefined();
  });

  it('should return green/red/blue CSS dots for solid brush operations', () => {
    const additive = SolidBrushVisual.createBoxPreview('Add', 2, SolidOperation.Additive);
    const subtractive = SolidBrushVisual.createBoxPreview('Sub', 2, SolidOperation.Subtractive);
    const intersecting = SolidBrushVisual.createBoxPreview('Int', 2, SolidOperation.Intersecting);
    expect(FactoryObjectIcon.getIcon(additive)).toEqual({
      character: '',
      color: '#27ae60',
      cssDot: true,
      cssDotNudgeYPx: 0,
    });
    expect(FactoryObjectIcon.getIcon(subtractive)).toEqual({
      character: '',
      color: '#c0392b',
      cssDot: true,
      cssDotNudgeYPx: 1,
    });
    expect(FactoryObjectIcon.getIcon(intersecting)).toEqual({
      character: '',
      color: '#2980b9',
      cssDot: true,
      cssDotNudgeYPx: 0,
    });
  });

  it('should keep yellow folder for additive solid CSG groups', () => {
    const group = new THREE.Group();
    markAsSolidCsgGroup(group, SolidOperation.Additive);
    const icon = FactoryObjectIcon.getIcon(group);
    expect(icon.character).toBe('📁');
    expect(icon.color).toBe('#e67e22');
    expect(icon.badgeCharacter).toBeUndefined();
  });

  it('should badge solid CSG folders with red or blue for non-additive ops', () => {
    const subtractive = new THREE.Group();
    markAsSolidCsgGroup(subtractive, SolidOperation.Subtractive);
    const intersecting = new THREE.Group();
    markAsSolidCsgGroup(intersecting, SolidOperation.Intersecting);
    expect(FactoryObjectIcon.getIcon(subtractive)).toEqual({
      character: '📁',
      color: '#e67e22',
      badgeCssDot: true,
      badgeColor: '#c0392b',
    });
    expect(FactoryObjectIcon.getIcon(intersecting)).toEqual({
      character: '📁',
      color: '#e67e22',
      badgeCssDot: true,
      badgeColor: '#2980b9',
    });
    setSolidGroupOperation(subtractive, SolidOperation.Additive);
    expect(FactoryObjectIcon.getIcon(subtractive).badgeCssDot).toBeUndefined();
  });

  it('should return solid model root icon', () => {
    const model = new SolidModel('IconSolid');
    const icon = FactoryObjectIcon.getIcon(model.root);
    expect(icon.character).toBe('▣');
    expect(icon.color).toBe('#e86a17');
  });

  it('should return box icon for BoxGeometry mesh', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const icon = FactoryObjectIcon.getIcon(mesh);
    expect(icon.character).toBe('◼');
    expect(icon.color).toBe('#3498db');
  });

  it('should return sphere icon for SphereGeometry mesh', () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial());
    const icon = FactoryObjectIcon.getIcon(mesh);
    expect(icon.character).toBe('●');
    expect(icon.color).toBe('#2ecc71');
  });

  it('should return plane icon for PlaneGeometry mesh', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    const icon = FactoryObjectIcon.getIcon(mesh);
    expect(icon.character).toBe('▭');
    expect(icon.color).toBe('#9b59b6');
  });

  it('should return cylinder icon for CylinderGeometry mesh', () => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial());
    const icon = FactoryObjectIcon.getIcon(mesh);
    expect(icon.character).toBe('⬡');
    expect(icon.color).toBe('#1abc9c');
  });

  it('should return generic mesh icon for unknown geometry', () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    const icon = FactoryObjectIcon.getIcon(mesh);
    expect(icon.character).toBe('◇');
    expect(icon.color).toBe('#95a5a6');
  });

  it('should return directional light icon', () => {
    const light = new THREE.DirectionalLight(0xffffff);
    const icon = FactoryObjectIcon.getIcon(light);
    expect(icon.character).toBe('☀');
    expect(icon.color).toBe('#f39c12');
  });

  it('should return point light icon', () => {
    const light = new THREE.PointLight(0xffffff);
    const icon = FactoryObjectIcon.getIcon(light);
    expect(icon.character).toBe('✦');
    expect(icon.color).toBe('#f1c40f');
  });

  it('should return spot light icon', () => {
    const light = new THREE.SpotLight(0xffffff);
    const icon = FactoryObjectIcon.getIcon(light);
    expect(icon.character).toBe('◎');
    expect(icon.color).toBe('#e74c3c');
  });

  it('should return camera icon for camera object', () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const icon = FactoryObjectIcon.getIcon(camera);
    expect(icon.character).toBe('📷');
    expect(icon.color).toBe('#e74c3c');
  });

  it('should return generic icon for Object3D', () => {
    const obj = new THREE.Object3D();
    const icon = FactoryObjectIcon.getIcon(obj);
    expect(icon.character).toBe('○');
    expect(icon.color).toBe('#7f8c8d');
  });

  it('takes the icon and color of every authored entity kind from its definition', () => {
    const spotSettings = { ...lightSettingsCreateDefault('spot'), colorHex: 0x3366ff };
    const spot = LightOwner.create('Spot', spotSettings);
    const point = LightOwner.createDefault('Point', 'point');
    const room = RoomOwner.createDefault('Room');
    const closedPortal = PortalOwner.create('Closed', { ...portalSettingsCreateDefault(), closed: true });
    const gameEntity = GameEntityOwner.createDefault('Thing');
    const cases: [THREE.Object3D, IconName][] = [
      [spot, LightOwner.definition.iconName(spotSettings)],
      [point, LightOwner.definition.iconName(lightSettingsCreateDefault('point'))],
      [room, RoomOwner.definition.iconName(roomSettingsCreateDefault())],
      [closedPortal, PortalOwner.definition.iconName({ ...portalSettingsCreateDefault(), closed: true })],
      [gameEntity, GameEntityOwner.definition.iconName({})],
    ];
    for (const [owner, expectedIcon] of cases) {
      expect(FactoryObjectIcon.getIcon(owner).iconName).toBe(expectedIcon);
    }
    expect(FactoryObjectIcon.getIcon(spot).iconName).not.toBe(FactoryObjectIcon.getIcon(point).iconName);
    expect(FactoryObjectIcon.getIcon(spot).color).toBe(hexToRgb(spotSettings.colorHex));
  });

  it('renders an entity icon as SVG in the outliner glyph slot', () => {
    const glyph = document.createElement('span');
    const badge = document.createElement('span');
    outlinerItemApplyIconFromObject(LightOwner.createDefault('Lamp', 'spot'), glyph, badge);
    expect(glyph.querySelector('svg path')?.getAttribute('d')).toBe(
      IconRegistry.pathOf(LightOwner.definition.iconName(lightSettingsCreateDefault('spot'))),
    );
    outlinerItemApplyIconFromObject(new THREE.Group(), glyph, badge);
    expect(glyph.querySelector('svg')).toBeNull();
    expect(glyph.textContent).toBe('📁');
  });

  it('should return ambient light icon for AmbientLight', () => {
    const light = new THREE.AmbientLight(0xffffff);
    const icon = FactoryObjectIcon.getIcon(light);
    expect(icon.character).toBe('✧');
    expect(icon.color).toBe('#f1c40f');
  });
});
