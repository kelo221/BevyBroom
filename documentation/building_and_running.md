# Building and Running BevyBroom

This guide is for anyone who wants to run BevyBroom from its source code, test a change locally, create the browser build, or package the standalone desktop application.

You do not need to build the project to use the published online editor or a prebuilt desktop release. Build from source when you want to modify BevyBroom, test an unreleased change, host your own copy, or create a desktop package for your current platform.

If the project is already set up and you only need an exact command or its side effects, use the [Build command reference](build_command_reference.md).

## What you need

Install the following before opening a terminal:

- **Git**, to obtain and update the source repository.
- **Bun 1.4.3**, which installs packages and runs the project's scripts.
- A current web browser for the browser build.

The repository records Bun 1.4.3 as its package-manager version (in `package.json` and `.bun-version`). A significantly different Bun version may behave differently, so use the recorded version when you need a reproducible build.

Desktop packages use Electrobun 2. The `electrobun` package installed with the project dependencies is only a small bootstrap: the first desktop command downloads the Electrobun tool set (Hutch) into `.hutch/` in the project folder, so it needs network access once. Build desktop packages on the operating system you intend to target: Windows on Windows, Linux on Linux, and macOS on macOS.

## Get the source

If you do not already have the repository:

```console
git clone https://github.com/kelo221/BevyBroom.git
cd BevyBroom
```

If you already have a checkout, open a terminal in its root folder—the folder containing `package.json`, `src`, and `documentation`.

## Install dependencies

Run:

```console
bun install --frozen-lockfile
```

The frozen lockfile option makes Bun use the exact dependency versions recorded by the project. If you are intentionally changing dependencies, use `bun install` while making that change and review the resulting `bun.lock` update.

Dependency installation creates local package files used by the build. It does not install BevyBroom as a system-wide application.

## Run the browser editor for development

Start the Vite development server:

```console
bun run dev
```

The command prints a local address. Open that address in a browser. Because the server is started with host access enabled, it may also print a network address that other devices on the same network can reach.

Keep the terminal open while using the development server. Source changes are rebuilt automatically. Stop the server with `Ctrl+C`.

Use the development server when:

- Editing the source and checking changes quickly.
- Debugging with browser developer tools.
- Testing the browser's file and folder permission behavior.
- Verifying responsive layout at different window sizes.

## Create the production browser build

Run:

```console
bun run build
```

This command:

1. Formats supported project files with Prettier.
2. Builds the optimized browser application with Vite.
3. Writes the finished site to the `docs/` folder.

The `docs/` build-output folder is different from the `documentation/` user-guide folder. Do not place authored guide files in `docs/`, because a production build may replace generated files there.

The browser build uses relative asset paths so it can be hosted beneath a project path, including GitHub Pages. Its principal generated files are:

- `docs/index.html`
- `docs/index.js`
- Icons and web-manifest files copied from `public/`

The build may report that the JavaScript bundle is larger than Vite's default warning threshold. That message is a size warning, not a failed build. A successful build ends with a green completion message and exit code zero.

## Preview the production browser build

After building, run:

```console
bun run preview
```

Open the local address printed by Vite. Preview mode serves the generated production files, so it is better than the development server for catching production-only asset or path problems.

Stop the preview server with `Ctrl+C`.

## Run the standalone desktop app during development

Start Electrobun's desktop development workflow:

```console
bun run desktop:dev
```

This builds the desktop page, watches the desktop entry points and launches BevyBroom in its desktop shell. Use it when testing native-window behavior, desktop file dialogs, or standalone update integration.

The desktop application uses the same editor entry point as the browser version, so editing behavior should remain consistent between both targets.

## Build a standalone desktop package

Run:

```console
bun run desktop:build
```

Before packaging, Electrobun runs `scripts/desktop_view_build.ts`, which builds the desktop page with Vite (`vite.desktop.config.ts`) into `desktop_view_dist/`. Electrobun copies it into the app and bundles the main process (`src/desktop/bun/index.ts`). It then builds the application for the current operating system using its stable environment. Intermediate files are written to:

```text
desktop_build/
```

Packaged outputs are written to:

```text
desktop_artifacts/
```

On Windows, Electrobun embeds the application icon (`public/app_icon.ico`) into the launcher, the runtime and the setup program itself. macOS uses the icon set in `public/app_icon.iconset`, while Linux uses the large PNG application icon.

A stable build is compressed for installing and updating, so its `launcher.exe` cannot be started straight from `desktop_build/`. To get an app you can run in place, for example for the end-to-end tests, build the development environment:

```console
bun run desktop:build:dev
```

On Windows the runnable app is then `desktop_build/dev-win-x64/BevyBroom-dev/bin/launcher.exe`.

To relaunch the most recent desktop build:

```console
bun run desktop:run
```

If no compatible prior build exists, run `bun run desktop:build` first.

## Validate before sharing a build

Run the same primary checks required by the project:

```console
bun run testrun
bun run build
```

The first command executes the complete Vitest suite once. The second formats supported files and verifies that the production browser bundle can be created.

For a broader continuous-integration check:

```console
bun run ci
```

This checks formatting, runs the complete test suite, and creates the browser build.

Additional checks are available:

```console
bun run typecheck
bun run typecheck:strict
bun run format:check
```

### End-to-end tests

The end-to-end tests drive the real programs and are skipped unless you tell them where those programs are:

| Variable                     | Value                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `BROOM_E2E_DESKTOP_EXE`      | The desktop app launcher from `bun run desktop:build:dev`                              |
| `BROOM_E2E_PREVIEW_EXE`      | The release `broom_preview` program of the Bevy workspace (`AiWorldEdBevy`)            |
| `BROOM_E2E_PROJECT_DIR`      | A game project folder holding `broom.project.json` and `assets/` (copied, not changed) |
| `BROOM_E2E_PORT`             | Optional first bridge port of the games the tests start (default 15792)                |
| `BROOM_E2E_MCP_PORT`         | Optional first MCP port of the desktop app (default 18865)                             |
| `BROOM_E2E_PROJECT_MCP_PORT` | Optional first MCP port of the desktop project test's app (default 18905)              |
| `BROOM_E2E_SHOW_WINDOWS`     | Optional; `1` shows the game and app windows so you can watch the tests                |

From `cmd` on Windows:

```console
set BROOM_E2E_DESKTOP_EXE=desktop_build\dev-win-x64\BevyBroom-dev\bin\launcher.exe
set BROOM_E2E_PREVIEW_EXE=..\AiWorldEdBevy\target\release\broom_preview.exe
set BROOM_E2E_PROJECT_DIR=..\AiWorldEdBevy
bun run e2e
```

The preview tests mirror scenes into the game through the editor's real preview link: lights, rooms and portals, doors opening and closing, failed geometry loads, bakes, renamed levels, Save As, game components with their data assets, including a shipped GLB loaded by a second game, and DynLight light features (effect, cookie, fog, shimmer, scaling a light into its radius, and which settings make a bake stale). The desktop test starts the app with its MCP server on, builds two rooms joined by a door through MCP tools the way an AI client would, checks them in the game, gives the light an effect and fog and removes them, places a game entity and reads a data asset through MCP, then relaunches the app and reopens the scene. The desktop project test opens a temporary copy of the game project whose launch is the preview program, builds a small crate before every launch, breaks and fixes that crate to check compiler errors in the Console and Issues list, rebuilds, restarts and stops the game, and checks that the game of a second project is refused. Without the desktop variable only the preview tests run; without the preview variables the desktop test runs without a game. `bun run testrun` skips all of them unless the variables are set.

The tests run without showing any window: the game is started with `--hidden` and the desktop app with `BEVYBROOM_DESKTOP_HIDDEN=1`. Both still render with the GPU, so they need a normal desktop session rather than a server without graphics. Set `BROOM_E2E_SHOW_WINDOWS=1` to see them in action.

Set `BROOM_E2E_REQUIRED=1` to turn skipping into failure: every end-to-end suite then fails when its variables are missing, and the protocol fixture test fails when the companion checkout is missing. The manual **Game integration** workflow (`.github/workflows/integration.yml`) sets it, builds the preview and the desktop app in the same job, and runs `bun run e2e` against them.

The strict TypeScript check (`bun run typecheck:strict`) is a required step of the automated workflow, next to the unit tests and the production build.

### Getting a compatible set of programs

The game side lives in two sibling checkouts next to this repository:

```
AiWorldEd/        this editor (https://github.com/kelo221/BevyBroom)
AiWorldEdBevy/    broom_bridge (the crate a game adds) and broom_preview (the ready-made game preview)
DynLightBevy/     the DynLight renderer (https://github.com/kelo221/DynamicLighting-Bevy)
```

`compatibility.json` at the root of this repository pins the combination the editor is tested with: the preview protocol range, the Bevy version and the renderer commit. `tests/preview/protocol/preview_protocol_compatibility.test.ts` checks the pin against the editor and, when `../AiWorldEdBevy` is present, against the companion's protocol constants and Bevy version. The wire fixtures in `AiWorldEdBevy/fixtures/` are mirrored in `tests/preview/protocol/fixtures/`; both repositories parse them, and the editor test fails when the mirror and the companion differ.

The companion workspace does not have a public repository yet; until it has one, get it from the maintainer and place it next to this checkout. Check out the renderer at the pinned commit:

```console
git clone https://github.com/kelo221/DynamicLighting-Bevy.git DynLightBevy
git -C DynLightBevy checkout <renderer commit from compatibility.json>
cd AiWorldEdBevy
cargo build --release -j 2 -p broom_preview
```

### The handshake

Before the editor publishes anything into a running game it calls `broom.hello`. The game answers with the protocol range it accepts, the features it serves and the project it was started for. The editor publishes nothing, shows **Game is incompatible, nothing is sent** in the Game Preview panel and writes the reason to the Console when:

- the game does not accept the editor's protocol version (rebuild the game, or update the editor),
- the game lacks a feature the editor needs,
- the game belongs to a different project than the open document,
- the game predates the handshake (protocol 3 or older).

A restarted game is checked again, so rebuilding and restarting a compatible game recovers on its own.

### Opening a game project in the desktop app

**File > Open Project…** (or **Open Project…** in the Game Preview panel) opens a `broom.project.json`. The editor checks the project (asset root, working directories, programs, endpoint), remembers it under **File > Recent Projects**, links the open document to it when the document belongs to no project yet, and points the game preview at the project's endpoint. **Run > Launch / Rebuild / Restart / Stop Game** and the panel buttons manage the game:

- **Launch** builds the game when the editor knows how, then starts it and connects.
- **Rebuild** stops the game, builds it and starts it again.
- **Restart** stops and starts the game without building.
- **Stop** ends the game and every process it started. Only a game the editor started is ever stopped; a game you started yourself keeps running when the editor closes.

The build is `preview.build` from the project file (`program`, `arguments`, `working_directory`), or, when that is missing, the `cargo build` matching a `cargo run` launch. Compiler errors appear in the Console and in the Issues list as `file:line:column: message`. A document stays linked to its project: the game of another project is refused, and **Link Document** in the panel moves the document to the open project. The browser editor cannot start programs; start the game yourself and connect to it.

## Build outputs and source files

Generated build folders should not be treated as the editable source:

| Folder               | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `src/`               | Application source code                        |
| `public/`            | Static assets copied into the browser build    |
| `documentation/`     | Authored Markdown user guides and their images |
| `docs/`              | Generated production browser site              |
| `desktop_view_dist/` | Desktop page built before each desktop build   |
| `desktop_build/`     | Intermediate Electrobun build files            |
| `desktop_artifacts/` | Packaged desktop build artifacts               |
| `.hutch/`            | Downloaded Electrobun tool set                 |

Make changes in `src/`, `public/`, or `documentation/`, then rebuild. Editing generated files in `docs/` or `desktop_build/` will not reliably survive the next build.

## How official builds are produced

The project's GitHub Actions workflow installs the Bun version named in `.bun-version`, installs dependencies from the frozen lockfile, checks formatting, runs tests, and builds the browser site.

For changes pushed to the `master` branch, the workflow also:

- Deploys the contents of `docs/` to GitHub Pages.
- Builds Windows, Linux, and macOS desktop artifacts on their respective hosted systems.
- Packages release assets.
- Publishes an automatic GitHub release after the desktop builds succeed.

Local builds do not automatically publish a site or create a GitHub release.

## Troubleshooting builds

### `bun` is not recognized

Bun is either not installed or is not available on your terminal's `PATH`. Install Bun 1.4.3, close and reopen the terminal, then verify:

```console
bun --version
```

### Dependency installation fails

- Confirm that the terminal has network access.
- Confirm that `bun.lock` exists.
- Retry `bun install --frozen-lockfile`.
- If the lockfile was intentionally changed, use `bun install` and review the dependency changes before continuing.

Do not delete the lockfile merely to bypass a dependency error; it is what keeps builds reproducible.

### A port is already in use

The development or preview server may select another available port and print it. If it cannot start, stop the process using the requested port or follow the alternate address shown in the terminal.

### The page opens but assets are missing

- Use `bun run preview` rather than opening `docs/index.html` directly from the filesystem.
- Confirm that the build completed successfully.
- Confirm that `docs/index.js` and copied public assets exist.
- If hosting beneath a path, preserve the generated relative file layout.

### A desktop build fails

- Confirm that dependencies installed successfully.
- The first desktop build downloads the Electrobun tool set into `.hutch/`; confirm network access. Deleting `.hutch/` makes the next build download it again.
- Build on the same operating-system family as the desired artifact.
- Close a previously launched copy if it is locking build files.
- Check the first meaningful error above any follow-on packaging messages.
- Run `bun run testrun` and `bun run build` separately to determine whether the problem is shared editor code or desktop packaging.

### Tests print canvas warnings

The test environment may report that some canvas operations are not implemented by its simulated browser. When the test command exits successfully and all test files pass, these warnings are informational. Treat an actual failed test or nonzero exit code as the build blocker.

For general application problems after a successful build, see [Troubleshooting](troubleshooting.md).
