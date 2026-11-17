import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Parameter values of a procedural object by field path. */
export type ProceduralParameters = Record<string, PreviewFieldValue>;

/**
 * Texture identifier of every material slot of a procedural object by slot
 * name.
 */
export type ProceduralMaterials = Record<string, string>;

/**
 * Authored procedural object: the generator that builds its mesh, the generator
 * version the parameters were written for, the parameters and the texture of
 * each material slot. The mesh itself is never stored; it is rebuilt from
 * these.
 */
export interface ProceduralSettings {
  generatorId: string;
  generatorVersion: number;
  parameters: ProceduralParameters;
  materials: ProceduralMaterials;
}
