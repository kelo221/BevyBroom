import * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { CollisionNumberFormat } from '@/level_export/collision/collision_number_format.js';
import type {
  CollisionVector3,
  PlacementKind,
  PlacementProcedural,
  PlacementProceduralPart,
  PlacementRecord,
} from '@/level_export/collision/collision_types.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';
import { ProceduralExportComponent } from '@/procedural/export/procedural_export_component.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { proceduralPartRoleOf } from '@/procedural/build/procedural_part_role.js';

/**
 * Lists every object the game places itself: game entities, procedural objects
 * and any other object carrying game components, each with its world transform
 * and its components with the class defaults filled in.
 */
export class LevelExportPlacementsBuilder {
  /**
   * Builds the placements of a world in scene order.
   *
   * @param worldGroup World root with current world matrices.
   * @returns Placement records.
   */
  static build(worldGroup: THREE.Object3D): PlacementRecord[] {
    const placements: PlacementRecord[] = [];
    worldGroup.traverse((object) => {
      const kind = LevelExportPlacementsBuilder.kindOf(object);
      if (kind !== null && object !== worldGroup && LevelExportObjectFilter.exportedIs(object, worldGroup)) {
        placements.push(LevelExportPlacementsBuilder.recordBuild(object, kind));
      }
    });
    return placements;
  }

  /**
   * Returns what kind of placement an object is.
   *
   * @param object Scene object.
   * @returns Placement kind, or null when the game does not place it.
   */
  private static kindOf(object: THREE.Object3D): PlacementKind | null {
    if (GameEntityOwner.isOwner(object)) {
      return 'game_entity';
    }
    if (ProceduralOwner.isOwner(object)) {
      return 'procedural';
    }
    return GameEntityComponentStore.hasAny(object) ? 'object' : null;
  }

  /**
   * Builds the record of one placed object.
   *
   * @param object Scene object.
   * @param kind Placement kind.
   * @returns Placement record.
   */
  private static recordBuild(object: THREE.Object3D, kind: PlacementKind): PlacementRecord {
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    object.matrixWorld.decompose(position, rotation, scale);
    const record: PlacementRecord = {
      object_id: object.uuid,
      name: object.name,
      kind,
      position: CollisionNumberFormat.vector3(position),
      rotation: CollisionNumberFormat.quaternion(rotation),
      scale: CollisionNumberFormat.vector3(scale),
      components: LevelExportPlacementsBuilder.componentsOf(object),
    };
    const settings = ProceduralOwner.settingsRead(object);
    if (settings !== null) {
      record.procedural = LevelExportPlacementsBuilder.proceduralOf(object, settings);
    }
    return record;
  }

  /**
   * Returns the components of an object with class defaults filled in, a
   * procedural object's `BroomProceduralProp` included.
   *
   * @param object Scene object.
   * @returns Effective components.
   */
  private static componentsOf(object: THREE.Object3D): PlacementRecord['components'] {
    const settings = ProceduralOwner.settingsRead(object);
    const stored = GameEntityComponentStore.read(object);
    const components = settings === null ? stored : ProceduralExportComponent.componentsMerge(stored, settings);
    return GameEntityComponentResolver.componentsEffective(components, (typePath) =>
      GameEntityClassRegistry.classFind(typePath),
    );
  }

  /**
   * Returns the generator data of a procedural object, with its derived points
   * also in world space.
   *
   * @param object Procedural owner with a current world matrix.
   * @param settings Valid settings.
   * @returns Procedural placement data.
   */
  private static proceduralOf(object: THREE.Object3D, settings: ProceduralSettings): PlacementProcedural {
    const generator = ProceduralGeneratorRegistry.find(settings.generatorId);
    const derived = generator?.derivedValues(settings.parameters) ?? {};
    const pointsWorld: Record<string, CollisionVector3> = {};
    for (const name of generator?.derivedPointNames() ?? []) {
      const local = ProceduralParametersRead.vector3(derived, name);
      pointsWorld[name] = CollisionNumberFormat.vector3(local.applyMatrix4(object.matrixWorld));
    }
    return {
      generator: settings.generatorId,
      version: settings.generatorVersion,
      parameters: structuredClone(settings.parameters),
      derived: structuredClone(derived),
      derived_points_world: pointsWorld,
      parts_world: LevelExportPlacementsBuilder.partsWorldOf(object, generator?.partsBuild(settings.parameters) ?? []),
    };
  }

  /**
   * Returns the parts of a procedural object in world space with their unique
   * corners.
   *
   * @param object Procedural owner with a current world matrix.
   * @param parts Parts in the owner's space.
   * @returns Parts in world space.
   */
  private static partsWorldOf(object: THREE.Object3D, parts: readonly ProceduralPart[]): PlacementProceduralPart[] {
    return parts.map((part) => ({
      name: part.name,
      role: proceduralPartRoleOf(part),
      points: LevelExportPlacementsBuilder.cornersUniqueOf(part).map((corner) =>
        CollisionNumberFormat.vector3(corner.clone().applyMatrix4(object.matrixWorld)),
      ),
    }));
  }

  /**
   * Returns the corners of a part once each, in face order.
   *
   * @param part Convex part.
   * @returns Unique corners.
   */
  private static cornersUniqueOf(part: ProceduralPart): THREE.Vector3[] {
    const corners: THREE.Vector3[] = [];
    for (const corner of part.faces.flat()) {
      if (!corners.some((known) => known.distanceToSquared(corner) < 1e-12)) {
        corners.push(corner);
      }
    }
    return corners;
  }
}
