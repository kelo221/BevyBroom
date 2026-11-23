import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { ControllerViewportShading } from '@/viewports/shading/controller_viewport_shading.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { ContentSceneLitMaterial } from '@/materials/factory_content_scene_lit_material.js';
import { createContentViewLitMaterial } from '@/materials/factory_content_view_lit_material.js';
import {
  SCENE_LIT_UNIFORM_NAMES,
  uniformSceneLitSharedGet,
  uniformSceneLitSharedWrite,
} from '@/materials/shader/uniform/uniform_scene_lit_lights_shared.js';
import { ShadableViewport } from '@/viewports/shading/controller_viewport_shading.js';
import { disposeSharedShadingPass } from '@/viewports/shared/shared_shading_pass.js';
import { clearSharedContentMaterialStoreForTests } from '@/viewports/shared/shared_content_material_store.js';

/** Minimal viewport mock for testing the shading controller. */
class MockViewport implements ShadableViewport {
  private scene: THREE.Scene;

  constructor() {
    this.scene = new THREE.Scene();
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  addMesh(mesh: THREE.Mesh): void {
    this.scene.add(mesh);
  }
}

describe('ViewportShadingController', () => {
  let viewport: MockViewport;
  let controller: ControllerViewportShading;
  let meshA: THREE.Mesh;
  let materialA: THREE.MeshStandardMaterial;

  beforeEach(() => {
    disposeSharedShadingPass();
    clearSharedContentMaterialStoreForTests();
    viewport = new MockViewport();
    controller = new ControllerViewportShading(viewport);
    materialA = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    meshA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialA);
    viewport.addMesh(meshA);
  });

  afterEach(() => {
    controller.dispose();
    disposeSharedShadingPass();
    clearSharedContentMaterialStoreForTests();
  });

  describe('default mode', () => {
    it('should default to SOLID mode', () => {
      expect(controller.getShadingMode()).toBe(ShadingMode.SOLID);
    });

    it('should not modify materials in default SOLID mode', () => {
      expect(meshA.material).toBe(materialA);
      expect(materialA.wireframe).toBe(false);
    });
  });

  describe('mode switching', () => {
    it('should switch to WIREFRAME mode', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME);
      expect(controller.getShadingMode()).toBe(ShadingMode.WIREFRAME);
      expect(meshA.material instanceof THREE.MeshBasicMaterial).toBe(true);
      expect((meshA.material as THREE.Material).colorWrite).toBe(false);
    });

    it('should switch to FLAT mode', () => {
      controller.setShadingMode(ShadingMode.FLAT);
      expect(controller.getShadingMode()).toBe(ShadingMode.FLAT);
      expect(meshA.material instanceof THREE.MeshBasicMaterial).toBe(true);
    });

    it('should switch to WIREFRAME_OVERLAY mode', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME_OVERLAY);
      expect(controller.getShadingMode()).toBe(ShadingMode.WIREFRAME_OVERLAY);
      expect(meshA.material).toBe(materialA);
      expect(materialA.wireframe).toBe(false);
    });

    it('should switch from WIREFRAME to FLAT', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME);
      controller.setShadingMode(ShadingMode.FLAT);
      expect(meshA.material instanceof THREE.MeshBasicMaterial).toBe(true);
    });

    it('should switch from WIREFRAME to SOLID', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME);
      controller.setShadingMode(ShadingMode.SOLID);
      expect(meshA.material).toBe(materialA);
      expect(materialA.wireframe).toBe(false);
    });
  });

  describe('overlay visibility', () => {
    it('should keep overlay hidden in WIREFRAME mode', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME);
      expect(controller['rendererWireframeOverlay'].isVisible()).toBe(false);
    });

    it('should keep overlay hidden in FLAT mode', () => {
      controller.setShadingMode(ShadingMode.FLAT);
      expect(controller['rendererWireframeOverlay'].isVisible()).toBe(false);
    });

    it('should show overlay in WIREFRAME_OVERLAY mode', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME_OVERLAY);
      expect(controller['rendererWireframeOverlay'].isVisible()).toBe(true);
    });

    it('should hide overlay when switching away from WIREFRAME_OVERLAY', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME_OVERLAY);
      controller.setShadingMode(ShadingMode.SOLID);
      expect(controller['rendererWireframeOverlay'].isVisible()).toBe(false);
    });
  });

  describe('updateMeshes', () => {
    it('should rebuild overlay with new meshes', () => {
      controller.updateMeshes([meshA]);
      expect(controller['rendererWireframeOverlay'].getOverlayCount()).toBe(1);
    });

    it('should rebuild overlay with multiple meshes', () => {
      const meshB = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
      );
      controller.updateMeshes([meshA, meshB]);
      expect(controller['rendererWireframeOverlay'].getOverlayCount()).toBe(2);
    });

    it('should clear overlay when given empty list', () => {
      controller.updateMeshes([meshA]);
      expect(controller['rendererWireframeOverlay'].getOverlayCount()).toBe(1);
      controller.updateMeshes([]);
      expect(controller['rendererWireframeOverlay'].getOverlayCount()).toBe(0);
    });

    it('should not force-apply wireframe materials when only updating mesh lists', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME, false);
      controller.updateMeshes([meshA]);
      expect(meshA.material).toBe(materialA);
      expect(materialA.colorWrite).not.toBe(false);
    });
  });

  describe('deferred shading preference', () => {
    it('should store wireframe preference without mutating shared scene materials', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME, false);
      expect(controller.getShadingMode()).toBe(ShadingMode.WIREFRAME);
      expect(meshA.material).toBe(materialA);
    });
  });

  describe('no-op on same mode', () => {
    it('should keep outline-only surface materials when setting WIREFRAME twice', () => {
      controller.setShadingMode(ShadingMode.WIREFRAME);
      controller.setShadingMode(ShadingMode.WIREFRAME);
      expect(meshA.material instanceof THREE.MeshBasicMaterial).toBe(true);
      expect((meshA.material as THREE.Material).colorWrite).toBe(false);
    });
  });

  describe('display overlay preferences', () => {
    it('defaults content wireframes and projected grid on', () => {
      expect(controller.areContentWireframesVisible()).toBe(true);
      expect(controller.isProjectedGridVisible()).toBe(true);
    });

    it('stores content wireframe and projected grid toggles', () => {
      controller.setContentWireframesVisible(false);
      controller.setProjectedGridVisible(false);
      expect(controller.areContentWireframesVisible()).toBe(false);
      expect(controller.isProjectedGridVisible()).toBe(false);
    });
  });

  describe('LIT mode scene lights', () => {
    /**
     * Reads the number of lights loaded into the shared Lit uniforms.
     *
     * @returns Light count.
     */
    function sceneLitLightCountRead(): unknown {
      return uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.count]?.value;
    }

    it('loads the authored lights into the shared uniforms on each Lit render pass', () => {
      uniformSceneLitSharedWrite([]);
      const owner = LightOwner.create('lit_test_light', lightSettingsCreateDefault('point'));
      viewport.getScene().add(owner);
      controller.setShadingMode(ShadingMode.LIT);
      expect(meshA.material).toBeInstanceOf(ContentSceneLitMaterial);
      expect(sceneLitLightCountRead()).toBe(1);
      viewport.getScene().add(LightOwner.create('lit_test_light_second', lightSettingsCreateDefault('spot')));
      controller.applyForRenderPass(new THREE.PerspectiveCamera());
      expect(sceneLitLightCountRead()).toBe(2);
    });

    it('keeps a see-through content material see-through with its opacity', () => {
      const glassOpacity = 0.3;
      const glass = createContentViewLitMaterial(0xffffff, null);
      glass.translucencySet(glassOpacity);
      const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glass);
      viewport.addMesh(glassMesh);
      controller.setShadingMode(ShadingMode.LIT);
      const lit = glassMesh.material;
      expect(lit).toBeInstanceOf(ContentSceneLitMaterial);
      expect(lit instanceof ContentSceneLitMaterial ? lit.translucencyRead() : null).toBeCloseTo(glassOpacity);
      expect(meshA.material instanceof ContentSceneLitMaterial ? meshA.material.translucencyRead() : 0).toBeNull();
    });

    it('leaves the shared light uniforms alone in other modes', () => {
      uniformSceneLitSharedWrite([]);
      viewport.getScene().add(LightOwner.create('unlit_test_light', lightSettingsCreateDefault('point')));
      controller.setShadingMode(ShadingMode.SOLID);
      controller.applyForRenderPass(new THREE.PerspectiveCamera());
      expect(sceneLitLightCountRead()).toBe(0);
    });
  });
});
