import * as THREE from 'three';
import { EntityBrowserPreviewOrbit } from '@/entity_browser/preview/entity_browser_preview_orbit.js';
import { Theme } from '@/theme.js';

/** Vertical field of view of the preview camera, in degrees. */
const ENTITY_BROWSER_PREVIEW_STAGE_FOV_DEGREES = 35;

/** Strength of the even fill light. */
const ENTITY_BROWSER_PREVIEW_STAGE_AMBIENT_INTENSITY = 1.1;

/** Strength of the key light that shades the faces. */
const ENTITY_BROWSER_PREVIEW_STAGE_KEY_INTENSITY = 1.8;

/** Direction the key light shines from, toward the subject. */
const ENTITY_BROWSER_PREVIEW_STAGE_KEY_DIRECTION = new THREE.Vector3(0.6, 1, 0.8).normalize();

/** Radius of the sphere framed around a subject without visible size. */
const ENTITY_BROWSER_PREVIEW_STAGE_EMPTY_RADIUS = 0.5;

/**
 * Small studio showing one preview subject at a time: a mid grey background
 * like the 3D view, fill and key lights, and a camera framed on the subject.
 */
export class EntityBrowserPreviewStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(ENTITY_BROWSER_PREVIEW_STAGE_FOV_DEGREES, 1, 0.01, 100);
  private readonly subjectBounds = new THREE.Sphere(new THREE.Vector3(), ENTITY_BROWSER_PREVIEW_STAGE_EMPTY_RADIUS);
  private subject: THREE.Object3D | null = null;

  /** Creates the studio with its background and lights. */
  constructor() {
    this.scene.background = new THREE.Color(Theme.viewportBackground);
    this.scene.add(new THREE.AmbientLight(Theme.lightAmbient, ENTITY_BROWSER_PREVIEW_STAGE_AMBIENT_INTENSITY));
    const keyLight = new THREE.DirectionalLight(Theme.lightDirectional, ENTITY_BROWSER_PREVIEW_STAGE_KEY_INTENSITY);
    keyLight.position.copy(ENTITY_BROWSER_PREVIEW_STAGE_KEY_DIRECTION);
    this.scene.add(keyLight);
  }

  /**
   * Shows a subject in place of the previous one and measures its bounds.
   *
   * @param subject Object to show, or null for an empty studio.
   */
  subjectShow(subject: THREE.Object3D | null): void {
    if (this.subject === subject) {
      return;
    }
    if (this.subject !== null) {
      this.scene.remove(this.subject);
    }
    this.subject = subject;
    if (subject !== null) {
      this.scene.add(subject);
    }
    this.subjectBoundsMeasure();
  }

  /**
   * Returns the subject shown now.
   *
   * @returns Subject, or null when the studio is empty.
   */
  subjectRead(): THREE.Object3D | null {
    return this.subject;
  }

  /**
   * Places the camera on an orbit around the subject for a view of the given
   * shape.
   *
   * @param orbit Orbit angles and zoom.
   * @param aspect Width divided by height of the view.
   */
  cameraPlace(orbit: EntityBrowserPreviewOrbit, aspect: number): void {
    this.camera.aspect = aspect > 0 ? aspect : 1;
    orbit.cameraPlace(this.camera, this.subjectBounds);
  }

  /**
   * Returns the sphere the camera frames.
   *
   * @returns Bounds of the subject.
   */
  subjectBoundsRead(): THREE.Sphere {
    return this.subjectBounds;
  }

  /**
   * Measures the sphere around the subject, falling back to a small sphere at
   * the origin.
   */
  private subjectBoundsMeasure(): void {
    const box = new THREE.Box3();
    if (this.subject !== null) {
      this.subject.updateMatrixWorld(true);
      box.setFromObject(this.subject, true);
    }
    if (box.isEmpty()) {
      this.subjectBounds.set(new THREE.Vector3(), ENTITY_BROWSER_PREVIEW_STAGE_EMPTY_RADIUS);
      return;
    }
    box.getBoundingSphere(this.subjectBounds);
    if (this.subjectBounds.radius <= 0) {
      this.subjectBounds.radius = ENTITY_BROWSER_PREVIEW_STAGE_EMPTY_RADIUS;
    }
  }
}
