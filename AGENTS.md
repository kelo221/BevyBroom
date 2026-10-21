# BevyBroom

We use Three.js for rendering and math, no other third-party libraries.

This is a 3D map editor to build 3D worlds for video games. The primary target
is Bevy games rendered with DynLight: the editor mirrors the scene live into the
running game and exports levels the game loads.

## Bevy

There are three repositories side by side:

- This repository (folder `AiWorldEd`): the editor, TypeScript and Three.js.
- `../AiWorldEdBevy`: the game side, the `broom_bridge` crate a game adds and
  the `broom_preview` program. Follow its own `AGENTS.md` when working there.
- `../DynLightBevy`: the renderer (lights, bakes, rooms and portals). Follow its
  own `AGENTS.md`; prefer solving a problem in the editor or the bridge before
  changing the renderer.

Rules for work that touches the game:

1. Design features from the game's point of view first: what the game needs to
   receive, load and show, then how the editor authors it.
2. The preview protocol is a contract.
   `src/preview/protocol/preview_protocol_types.ts` mirrors the Rust
   `protocol/` module in `../AiWorldEdBevy`; always change both together.
3. Anything the game must see in a shipped level goes into the exported GLB in a
   form the game reads without the editor (for example DynLight node extras).
4. Editor-only helpers (light markers, room and portal outlines) are never
   exported as meshes.

## Testing requirement

Every new feature MUST have a properly documented unit test. This test must be
robust enough to stand the test of time (no hardcoded positions, rotations, they
must create what they need, test the result, check the result).

Prefer proving a feature end to end. Every feature the game or the desktop app
can observe MUST also get an end-to-end test step under `tests/e2e/` that drives
the real programs. That includes anything sent over the preview link, anything
exported for the game, and desktop shell or MCP tool behavior. Unit tests prove
each piece in isolation and stay fast; end-to-end steps prove the pieces work
together.

End-to-end steps follow the same robustness rules as unit tests. They:

- Build their scene through the editor's own code paths or MCP tools.
- Check the result in the game itself: its status, its entities through the Bevy
  remote protocol, and the files it writes.
- Wait for conditions instead of sleeping fixed times.
- Work on temporary copies of the game project and clean up after themselves.
- Run with hidden windows by default.

## After making changes

`bun run testrun` (vitest is used) must pass all checks.

`bun run build` must pass.

`bun run typecheck:strict` must pass.

When the change touches the game preview, the protocol, export for the game,
the desktop app or MCP tools, `bun run e2e` must pass too, run against freshly
built programs. A stale build silently tests old code:

```
cd ..\AiWorldEdBevy
cargo build --release -j 2 -p broom_preview
cd ..\AiWorldEd
bun run desktop:build:dev
set BROOM_E2E_DESKTOP_EXE=desktop_build\dev-win-x64\BevyBroom-dev\bin\launcher.exe
set BROOM_E2E_PREVIEW_EXE=..\AiWorldEdBevy\target\release\broom_preview.exe
set BROOM_E2E_PROJECT_DIR=..\AiWorldEdBevy
bun run e2e
```

If the Bevy workspace changed, its own checks (`cargo fmt`, `clippy` and
`cargo test`, with `-j 2`) must pass too.

PowerShell is janky, use cmd.

## Coding Style

1. Use many classes distributed across many separate files.
2. Never allow any single file to exceed 1000 lines of code.
3. As soon as a file approaches or reaches the 1000-line limit, stop writing in that file and immediately split its contents into additional classes and files.
4. Prefer many small functions over large functions.
5. No function may exceed 20 lines of code.
6. Every function must include a complete documentation comment that documents all arguments.
7. Do not write any inline comments.
8. Convey intent exclusively through verbose variable names and verbose function names.
9. Design the codebase so that future agents can locate functions and systems quickly.
10. Employ a clear, logical directory structure.
11. Use descriptive class names.
12. Separate concerns into many distinct files.
13. Name all files and folders using snake_case (never camelCase or PascalCase).
14. Create base classes for all groups of similar things and derive specialized classes from those base classes.
15. File names and class names must place the category or type first, followed by the specific name. This ensures related items group together.
    Correct examples:
    input_password instead of password_input.
    input_text instead of text_input.
    error_editor_startup instead of editor_startup_error.
    Always use the pattern category_specific_name.
16. Directory structure should group together related files specific to the feature.
    Correct examples:
    ```
    tools/
    	paintbrush/
    		states/
    			paintbrush_state.ts
    			paintbrush_state_idle.ts
    			paintbrush_state_drawing.ts
    			paintbrush_state_preview.ts
    		configurations/
    			paintbrush_configuration.ts
    			paintbrush_configuration_brush_size.ts
    			paintbrush_configuration_brush_palette.ts
    			paintbrush_configuration_layout.ts
    		layouts/
    			paintbrush_layout.ts
    			paintbrush_layout_default.ts
    			paintbrush_layout_blender.ts
    		renderers/
    			paintbrush_renderer.ts
    			paintbrush_renderer_stroke.ts
    			paintbrush_renderer_line.ts
    		ui/
    			window/
    				paintbrush_window.ts
    				paintbrush_window_floating.ts
    				paintbrush_window_detached.ts
    				buttons/
    					paintbrush_window_button_palette_color.ts
    		mcp/
    			paintbrush_mcp.ts
    			paintbrush_mcp_brush_select.ts
    			paintbrush_mcp_brush_paint.ts
    solid/
    	algorithm/
    		routing/
    			solid_algorithm_routing_table.ts
    			solid_algorithm_routing_table_builder.ts
    			solid_algorithm_routing_table_cache.ts
    ```
17. Prefer more functions over doing many unrelated things in one function.
    Function names should also be grouped by category e.g. finishingFlagReset instead of resetFinishingFlag.
    Bad example:

    ```
    /**
     * Activates the inline rename by placing the input where the name span sits,
     * before trailing row controls (visibility / lock). Input metrics are copied
     * from the span first so tabs and outliner rows keep their height.
     */
    activate(): void {
    	if (this.isDisposed) return;
    	this.isFinishing = false;
    	this.textSpan.style.display = 'none';
    	this.parentElement.insertBefore(this.inputElement, this.textSpan.nextSibling);
    	this.inputElement.focus();
    	this.inputElement.select();
    }
    ```

    Good example:

    ```
    /**
     * Activates the inline rename mode.
     */
    activate(): void {
    	if (this.isDisposed) {
    		return;
    	}
    	this.finishingFlagReset();
    	this.matchInputLayoutToTextSpan();
    	this.textSpanHide();
    	this.inputElementInsertBeforeTrailingControls();
    	this.inputElementFocusAndSelect();
    }

    /**
     * Resets the finishing flag so a new rename session can begin cleanly.
     */
    private finishingFlagReset(): void {
    	this.isFinishing = false;
    }

    /**
     * Hides the original text span so the input element becomes the visible name.
     */
    private textSpanHide(): void {
    	this.textSpan.style.display = 'none';
    }

    /**
     * Inserts the input element into the parent at the exact position of the text span,
     * placing it before any trailing row controls such as visibility or lock buttons.
     */
    private inputElementInsertBeforeTrailingControls(): void {
    	this.parentElement.insertBefore(this.inputElement, this.textSpan.nextSibling);
    }

    /**
     * Moves keyboard focus to the input element and selects its entire content.
     */
    private inputElementFocusAndSelect(): void {
    	this.inputElement.focus();
    	this.inputElement.select();
    }
    ```

    Many functions allow small reusable actions that are easy to maintain.
    Benefits of Small Functions
    Readability: Short code blocks are easy to understand at a glance.
    Maintenance: Fixing a bug in one small function fixes it everywhere.
    Reusability: You can call the same logic multiple times without rewriting it.
    Testing: Checking a single small task is faster than testing a large block.

18. Documentation comments must always be kept current.
    Each documentation comment must describe only the exact intent and behavior of the function it belongs to.
    It must never describe the project as a whole, architectural context, or relationships to any other function.
    This is because other functions and the whole program architecture may change, old documentation describing old decisions is misleading, so every function must only talk about itself.
19. General purpose solutions such as a menu system can live in their own directories to be reused globally e.g. ui/menu/ and should be designed with base classes for special overrides in other places, but always prefer a design where the base classes are powerful enough to handle all use-cases.
20. Before you work on an assignment, ensure you perform a full directory and file listing, and always avoid re-inventing the wheel.
    It is better to modify or create a global base class to support the necessary functionality than to copy and paste code or write it from scratch.
    For example, do not create a new context menu implementation when we already have a menu system or context menu system, reuse, improve, document, test.
21. Ensure the directory and file structure of tests matches that of the sources as much as possible and keep them in sync.
22. Prefer verbose descriptive names to ensure simple code searches are likely to find them.
23. Systems must always be in child folders that belong together to avoid random files scattered all over the project.
    It is better to implement new features in such a way that they minimally change the existing code and stay in their own subdirectory.
24. Avoid ! (non-null assertion) and rewrite the code to ensure TypeScript can be sure it is not null (with performance as highest priority).
25. Remove unused functions and unused variables.
26. If a function is very complicated and difficult to understand, split it into easier functions with detailed documentation comments (but priority is performance).
27. Code duplication is NOT ALLOWED, create a single function accessible from both code paths (static class, base class).
28. Avoid anti-patterns, instead of disabling something case by case, make the ones that need them enable it and disable it by default.
29. Never leave "Harmless" or "Compatibility Stub" code behind, delete and clean up properly, they are too confusing in the future.

## Coordinates

Bevy and ThreeJS share the same coordinate system: right-handed, Y up, forward
is -Z, one unit is one meter (the game project's `bevy_meters` profile; the
editor's Godot preset uses the same axes). The game preview therefore sends
geometry without any conversion; never add one.

Other targets still matter: we want to be able to export maps to 3D models and
Unity and TrenchBroom and Blender. Unity uses a left-handed system, so those
exports convert on a root node through the game profile. Keep this in mind.

## Theme

Use a similar dark mode theme that Blender uses. Orange selection, black
backgrounds, maybe a subtle gradient here and there to give the editor a very
dark blue vibe. But keep it modern and clean.

## Geometry

We keep meshes convex as that is easier to work with in level design.

## Reference

The reference folder is not part of the project that needs to be edited, it is
to get inspiration for math and code fixes and features. Ensure the names like
Chisel and RealtimeCSG do not end up in our map editor source code.

When code from the reference folder is used ensure it looks and feels different
and matches the style of our programming.
