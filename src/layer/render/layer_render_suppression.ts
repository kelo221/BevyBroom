import * as THREE from 'three';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/** Signature of the render callbacks three.js calls on a scene. */
type SceneRenderCallback = THREE.Scene['onBeforeRender'];

/**
 * Keeps the objects of hidden layers out of every picture drawn of the scene
 * holding the world root. Right before each render it switches off the authored
 * visibility of top-level objects in hidden layers, and right after the render
 * it switches it back on, so saved visibility never changes.
 */
export class LayerRenderSuppression {
  private readonly layerManager: LayerManager;
  private readonly suppressedObjects: THREE.Object3D[];
  private readonly addedListener: () => void;
  private readonly removedListener: () => void;
  private hookedScene: THREE.Scene | null;
  private previousBeforeRender: SceneRenderCallback | null;
  private previousAfterRender: SceneRenderCallback | null;
  private readonly beforeRenderHook: SceneRenderCallback;
  private readonly afterRenderHook: SceneRenderCallback;

  /**
   * Creates the suppression and hooks the scene the world root is in, now and
   * whenever the root moves to another scene.
   *
   * @param layerManager Layer manager of the world root.
   */
  constructor(layerManager: LayerManager) {
    this.layerManager = layerManager;
    this.suppressedObjects = [];
    this.hookedScene = null;
    this.previousBeforeRender = null;
    this.previousAfterRender = null;
    this.beforeRenderHook = (...callbackArguments) => this.beforeRenderRun(callbackArguments);
    this.afterRenderHook = (...callbackArguments) => this.afterRenderRun(callbackArguments);
    this.addedListener = () => this.sceneHookFollowWorldParent();
    this.removedListener = () => this.sceneUnhook();
    this.worldGroupRead().addEventListener('added', this.addedListener);
    this.worldGroupRead().addEventListener('removed', this.removedListener);
    this.sceneHookFollowWorldParent();
  }

  /**
   * Returns the scene currently hooked.
   *
   * @returns Hooked scene, or null while the world root is in no scene.
   */
  hookedSceneRead(): THREE.Scene | null {
    return this.hookedScene;
  }

  /**
   * Hides the top-level objects of hidden layers until {@link suppressionEnd}.
   * Objects still hidden from an interrupted render are restored first.
   */
  suppressionBegin(): void {
    this.suppressionEnd();
    if (!this.layerManager.layerFlagAnyIs('hidden')) {
      return;
    }
    for (const child of this.worldGroupRead().children) {
      if (child.visible && this.layerManager.layerOfTopLevelObjectResolve(child)?.hidden === true) {
        child.visible = false;
        this.suppressedObjects.push(child);
      }
    }
  }

  /** Shows again every object hidden by {@link suppressionBegin}. */
  suppressionEnd(): void {
    this.suppressedObjects.forEach((object) => {
      object.visible = true;
    });
    this.suppressedObjects.length = 0;
  }

  /** Restores visibility, unhooks the scene and stops following the world root. */
  dispose(): void {
    this.suppressionEnd();
    this.sceneUnhook();
    this.worldGroupRead().removeEventListener('added', this.addedListener);
    this.worldGroupRead().removeEventListener('removed', this.removedListener);
  }

  /**
   * Returns the world root of the layer manager.
   *
   * @returns World root.
   */
  private worldGroupRead(): THREE.Object3D {
    return this.layerManager.worldGroupRead();
  }

  /** Hooks the scene that is the world root's parent, if any. */
  private sceneHookFollowWorldParent(): void {
    const parent = this.worldGroupRead().parent;
    if (parent === this.hookedScene) {
      return;
    }
    this.sceneUnhook();
    if (parent instanceof THREE.Scene) {
      this.sceneHook(parent);
    }
  }

  /**
   * Wraps the render callbacks of a scene with the suppression.
   *
   * @param scene Scene to hook.
   */
  private sceneHook(scene: THREE.Scene): void {
    this.hookedScene = scene;
    this.previousBeforeRender = scene.onBeforeRender;
    this.previousAfterRender = scene.onAfterRender;
    scene.onBeforeRender = this.beforeRenderHook;
    scene.onAfterRender = this.afterRenderHook;
  }

  /** Restores the render callbacks of the hooked scene when they are still ours. */
  private sceneUnhook(): void {
    const scene = this.hookedScene;
    if (scene === null) {
      return;
    }
    this.suppressionEnd();
    if (scene.onBeforeRender === this.beforeRenderHook && this.previousBeforeRender !== null) {
      scene.onBeforeRender = this.previousBeforeRender;
    }
    if (scene.onAfterRender === this.afterRenderHook && this.previousAfterRender !== null) {
      scene.onAfterRender = this.previousAfterRender;
    }
    this.hookedScene = null;
  }

  /**
   * Runs the scene's previous before-render callback, then hides hidden layers.
   *
   * @param callbackArguments Arguments three.js passed to the callback.
   */
  private beforeRenderRun(callbackArguments: Parameters<SceneRenderCallback>): void {
    this.previousBeforeRender?.apply(this.hookedScene, callbackArguments);
    this.suppressionBegin();
  }

  /**
   * Shows hidden layers again, then runs the scene's previous after-render
   * callback.
   *
   * @param callbackArguments Arguments three.js passed to the callback.
   */
  private afterRenderRun(callbackArguments: Parameters<SceneRenderCallback>): void {
    this.suppressionEnd();
    this.previousAfterRender?.apply(this.hookedScene, callbackArguments);
  }
}
