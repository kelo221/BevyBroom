import * as THREE from 'three';
import { CLIP_PREVIEW_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview.js';
import { LayerList } from '@/layer/model/layer_list.js';
import { LayerManagerLookup } from '@/layer/model/layer_manager_lookup.js';
import { LayerChangeNotifier, type LayerChangeListener } from '@/layer/model/layer_change_notifier.js';
import { LAYER_DEFAULT_ID, type LayerDefinition, type LayerFlagName } from '@/layer/model/layer_definition.js';
import { layerIdStoredRead, layerIdStoredWrite } from '@/layer/model/layer_membership.js';

/**
 * Owns the layers of one world root: their order and switches, the current
 * layer new objects join, and the layer each top-level object belongs to.
 */
export class LayerManager {
  private readonly worldGroup: THREE.Object3D;
  private readonly layerList: LayerList;
  private readonly changeNotifier: LayerChangeNotifier;
  private currentLayerIdentifier: string;
  private readonly childAddedListener: (event: { child: THREE.Object3D }) => void;
  private readonly childRemovedListener: () => void;

  /**
   * Creates the layer manager of a world root and binds it to the root.
   *
   * @param worldGroup World root whose direct children carry layer membership.
   */
  constructor(worldGroup: THREE.Object3D) {
    this.worldGroup = worldGroup;
    this.layerList = new LayerList();
    this.changeNotifier = new LayerChangeNotifier();
    this.currentLayerIdentifier = LAYER_DEFAULT_ID;
    this.childAddedListener = (event) => this.childAddedHandle(event.child);
    this.childRemovedListener = () => this.changeNotify();
    this.worldGroup.addEventListener('childadded', this.childAddedListener);
    this.worldGroup.addEventListener('childremoved', this.childRemovedListener);
    LayerManagerLookup.register(worldGroup, this);
  }

  /**
   * Returns the world root this manager owns.
   *
   * @returns World root.
   */
  worldGroupRead(): THREE.Object3D {
    return this.worldGroup;
  }

  /**
   * Returns the layers in display order, the default layer first.
   *
   * @returns Live layer definitions; change them only through this manager.
   */
  layersList(): readonly LayerDefinition[] {
    return this.layerList.listRead();
  }

  /**
   * Finds a layer by identifier.
   *
   * @param layerIdentifier Layer identifier.
   * @returns The layer, or null.
   */
  layerFind(layerIdentifier: string): LayerDefinition | null {
    return this.layerList.find(layerIdentifier);
  }

  /**
   * Returns the default layer.
   *
   * @returns Default layer.
   */
  layerDefaultRead(): LayerDefinition {
    return this.layerList.defaultRead();
  }

  /**
   * Returns the display index of a layer.
   *
   * @param layerIdentifier Layer identifier.
   * @returns Index, or -1 when unknown.
   */
  layerIndexOf(layerIdentifier: string): number {
    return this.layerList.indexOf(layerIdentifier);
  }

  /**
   * Returns the identifier of the layer new objects join.
   *
   * @returns Current layer identifier.
   */
  currentLayerIdRead(): string {
    return this.currentLayerIdentifier;
  }

  /**
   * Makes a layer the one new objects join.
   *
   * @param layerIdentifier Layer identifier.
   * @returns True when the layer exists.
   */
  currentLayerSet(layerIdentifier: string): boolean {
    if (this.layerFind(layerIdentifier) === null) {
      return false;
    }
    if (this.currentLayerIdentifier !== layerIdentifier) {
      this.currentLayerIdentifier = layerIdentifier;
      this.changeNotify();
    }
    return true;
  }

  /**
   * Inserts a layer at a display index after the default layer.
   *
   * @param definition Layer to insert.
   * @param index Desired display index.
   * @returns True when inserted.
   */
  layerInsert(definition: LayerDefinition, index: number): boolean {
    const isInserted = this.layerList.insert(definition, index);
    if (isInserted) {
      this.changeNotify();
    }
    return isInserted;
  }

  /**
   * Removes a layer other than the default; when it was current, the default
   * layer becomes current. Its objects keep their stored identifier and resolve
   * to the default layer.
   *
   * @param layerIdentifier Layer identifier.
   * @returns Index the layer had, or -1 when nothing was removed.
   */
  layerDelete(layerIdentifier: string): number {
    const removedIndex = this.layerList.delete(layerIdentifier);
    if (removedIndex < 0) {
      return removedIndex;
    }
    if (this.currentLayerIdentifier === layerIdentifier) {
      this.currentLayerIdentifier = LAYER_DEFAULT_ID;
    }
    this.changeNotify();
    return removedIndex;
  }

  /**
   * Moves a layer other than the default to a display index.
   *
   * @param layerIdentifier Layer identifier.
   * @param index Desired display index after the default layer.
   * @returns True when the layer moved.
   */
  layerMoveToIndex(layerIdentifier: string, index: number): boolean {
    const isMoved = this.layerList.move(layerIdentifier, index);
    if (isMoved) {
      this.changeNotify();
    }
    return isMoved;
  }

  /**
   * Renames a layer other than the default.
   *
   * @param layerIdentifier Layer identifier.
   * @param name New non-blank name.
   * @returns True when renamed.
   */
  layerRename(layerIdentifier: string, name: string): boolean {
    const isRenamed = this.layerList.rename(layerIdentifier, name);
    if (isRenamed) {
      this.changeNotify();
    }
    return isRenamed;
  }

  /**
   * Sets one switch of a layer.
   *
   * @param layerIdentifier Layer identifier.
   * @param flag Switch to set.
   * @param value New value.
   * @returns True when the value changed.
   */
  layerFlagSet(layerIdentifier: string, flag: LayerFlagName, value: boolean): boolean {
    const isChanged = this.layerList.flagSet(layerIdentifier, flag, value);
    if (isChanged) {
      this.changeNotify();
    }
    return isChanged;
  }

  /**
   * Returns whether any layer has a switch on.
   *
   * @param flag Switch to test.
   * @returns True when at least one layer has it on.
   */
  layerFlagAnyIs(flag: LayerFlagName): boolean {
    return this.layerList.flagAnyIs(flag);
  }

  /**
   * Creates a new "Layer N" definition with an unused identifier without adding
   * it.
   *
   * @returns New layer definition.
   */
  layerDefinitionAllocate(): LayerDefinition {
    return this.layerList.definitionAllocate();
  }

  /**
   * Returns whether a direct child of the world root is content that belongs to
   * a layer rather than an editor helper.
   *
   * @param object Direct child of the world root.
   * @returns True for content meshes and groups.
   */
  topLevelObjectAssignableIs(object: THREE.Object3D): boolean {
    if (object.userData[CLIP_PREVIEW_USERDATA_KEY] === true) {
      return false;
    }
    return object instanceof THREE.Mesh || object instanceof THREE.Group;
  }

  /**
   * Resolves the layer of a direct child of the world root. Unknown or missing
   * identifiers resolve to the default layer.
   *
   * @param object Direct child of the world root.
   * @returns The layer, or null for editor helpers.
   */
  layerOfTopLevelObjectResolve(object: THREE.Object3D): LayerDefinition | null {
    if (!this.topLevelObjectAssignableIs(object)) {
      return null;
    }
    const storedIdentifier = layerIdStoredRead(object);
    const storedLayer = storedIdentifier === null ? null : this.layerFind(storedIdentifier);
    return storedLayer ?? this.layerDefaultRead();
  }

  /**
   * Collects the direct children of the world root that belong to a layer.
   *
   * @param layerIdentifier Layer identifier.
   * @returns Top-level member objects in scene order.
   */
  objectsInLayerCollect(layerIdentifier: string): THREE.Object3D[] {
    return this.worldGroup.children.filter((child) => this.layerOfTopLevelObjectResolve(child)?.id === layerIdentifier);
  }

  /**
   * Counts the direct children of the world root that belong to a layer.
   *
   * @param layerIdentifier Layer identifier.
   * @returns Number of top-level member objects.
   */
  objectCountRead(layerIdentifier: string): number {
    return this.objectsInLayerCollect(layerIdentifier).length;
  }

  /**
   * Stores a layer on top-level objects and notifies once.
   *
   * @param objects Direct children of the world root.
   * @param layerIdentifier Layer to store, or null to remove the stored layer.
   */
  objectsLayerAssign(objects: readonly THREE.Object3D[], layerIdentifier: string | null): void {
    objects.forEach((object) => layerIdStoredWrite(object, layerIdentifier));
    this.changeNotify();
  }

  /** Forgets every layer but the default one and makes the default current. */
  documentReset(): void {
    this.documentReplace([], LAYER_DEFAULT_ID);
  }

  /**
   * Replaces every layer and the current layer, as when a document opens.
   *
   * @param definitions Layers in display order.
   * @param currentLayerIdentifier Current layer; unknown identifiers fall back
   *   to the default layer.
   */
  documentReplace(definitions: readonly LayerDefinition[], currentLayerIdentifier: string): void {
    this.layerList.replace(definitions);
    const isKnown = this.layerFind(currentLayerIdentifier) !== null;
    this.currentLayerIdentifier = isKnown ? currentLayerIdentifier : LAYER_DEFAULT_ID;
    this.changeNotify();
  }

  /**
   * Adds a listener called after any layer or membership change.
   *
   * @param listener Change listener.
   */
  changeListenerAdd(listener: LayerChangeListener): void {
    this.changeNotifier.listenerAdd(listener);
  }

  /**
   * Removes a listener added with {@link changeListenerAdd}.
   *
   * @param listener Change listener.
   */
  changeListenerRemove(listener: LayerChangeListener): void {
    this.changeNotifier.listenerRemove(listener);
  }

  /** Calls every change listener. */
  changeNotify(): void {
    this.changeNotifier.notify();
  }

  /** Unbinds the manager from its world root and drops every listener. */
  dispose(): void {
    this.worldGroup.removeEventListener('childadded', this.childAddedListener);
    this.worldGroup.removeEventListener('childremoved', this.childRemovedListener);
    LayerManagerLookup.unregister(this.worldGroup, this);
    this.changeNotifier.clear();
  }

  /**
   * Puts a newly added content child without a stored layer into the current
   * layer and notifies.
   *
   * @param child Object just added to the world root.
   */
  private childAddedHandle(child: THREE.Object3D): void {
    if (this.topLevelObjectAssignableIs(child) && layerIdStoredRead(child) === null) {
      layerIdStoredWrite(child, this.currentLayerIdentifier);
    }
    this.changeNotify();
  }
}
