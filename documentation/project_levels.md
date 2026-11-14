# Project Levels

A game project lists its levels, so you can browse and open them without hunting
for files. Project levels need the desktop app; the browser build explains that in
the Level Browser instead of listing levels.

## Where levels live

Level documents are ordinary scene files (`.json`) inside the project's
`document_directory`. `document_directory` is relative to `broom.project.json`
and defaults to `broom/documents`.

```json
{
  "document_directory": "broom/documents",
  "levels": [
    { "id": "castle_hall", "name": "Castle Hall", "document": "castle_hall.json" },
    { "document": "tutorial/first_room.json" }
  ]
}
```

- `levels` is optional. Each entry needs `document`, a `.json` path inside the
  document directory. `id` defaults to the file name without `.json`, and
  `name` defaults to the id.
- The `id` is the name the level is built and published under (**Build Level**),
  so the game finds it by that name.
- Listed levels come first, in file order. Every other `.json` document in the
  document directory is listed after them, so new levels show up without editing
  the project file. BevyBroom never rewrites `broom.project.json`.
- Old project files without these fields stay valid.

## Level Browser

Open it from **File > Level Browser…** or **View > Level Browser**. It lists the
levels of the open project with their name and when they were last changed, and
marks the level that is open.

- **Open** (or double-click) loads a level and remembers it as the open level.
- **New Level** creates an empty level document from the typed name and opens it.
- **Save As New** saves the current scene as a new level with the typed name.
- **Rename** renames a level by moving its document. Levels listed in the project
  file can't be renamed here; edit `broom.project.json` instead.

While a project level is open, **File > Save** (⌘S / Ctrl+S) writes back into its
document without asking. If another program changed the document since you
opened it, Save refuses and says so instead of overwriting it. **File > New** and
**File > Load** forget the open level.

## MCP tools

| Tool                  | What it does                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `list_project_levels` | Lists `levels` (`id`, `name`, `document`, `modifiedMilliseconds`, `isListed`), the `documentDirectory`, and `openLevel` (or null). |
| `open_project_level`  | Opens a level by `levelId` or `document` and makes it the open level.                                                              |
| `save_project_level`  | Without `name`, writes back into the open level; with `name`, saves the scene as a new level and opens it.                         |
