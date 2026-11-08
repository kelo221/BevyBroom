import type { SprinkleDefinitionFile } from '@/tools/sprinkle/definition/sprinkle_definition.js';

/**
 * Path prefix marking a sprinkle definition that ships with the editor instead
 * of a project file.
 */
export const SPRINKLE_DEFINITION_BUILTIN_PATH_PREFIX = 'builtin:';

/**
 * Text of the built-in sample definitions that sprinkle the editor's light
 * entities.
 */
const SPRINKLE_DEFINITION_BUILTIN_SAMPLE_LIGHTS_TEXT = `"Sample: Point Lights"
{
	base
	{
		"classname" "lights.point"
		grid "4 4"
	}
	1
	{
	}
}

"Sample: Mixed Lights"
{
	base
	{
		grid "3 3"
	}
	3
	{
		"classname" "lights.point"
	}
	1
	{
		"classname" "lights.spot"
	}
}
`;

/**
 * Sprinkle definition files that ship with the editor, listed after the
 * project's types.
 */
export const SPRINKLE_DEFINITION_BUILTIN_FILES: readonly SprinkleDefinitionFile[] = Object.freeze([
  {
    path: `${SPRINKLE_DEFINITION_BUILTIN_PATH_PREFIX}sample_lights.txt`,
    text: SPRINKLE_DEFINITION_BUILTIN_SAMPLE_LIGHTS_TEXT,
  },
]);
