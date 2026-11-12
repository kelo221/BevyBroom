# macOS editor support – work log

## Frame

Make the editor feel native on macOS without changing Windows/Linux behaviour.
"Better" = Mac users can delete with ⌫/⌘⌫, see ⌘/⌥/⌃/⌫ labels everywhere,
pan/pinch with a trackpad, Control+click as right click, Cmd+W closes floating
windows, Dock click re-shows the window, dark glass follows the system
appearance. Done-check: `bun run testrun`, `typecheck:strict`, `build`, and new
e2e desktop steps pass against a freshly built dev app.

## Baseline (2026-11-12)

- `bun run testrun`: 1265 files passed, 1 failed (known: game_process_spawner_node
  'directory with spaces'); 7081 tests passed, 1 failed, 105 skipped.
- Delete on Mac: `delete_selected` is bound to code `Delete`; Mac keyboards send
  `Backspace`, so ⌫ / ⌘⌫ do nothing in Object Mode.
- Labels: `formatKeyboardCode` returns 'Del', 'Esc', 'Backspace' on every
  platform; 9 UI strings hard-code 'Ctrl'.
- 2D views: every wheel event zooms (`HandlerOrthoPan.onWheel`), no pan on
  two-finger scroll, no pinch.
- Control+click sends button 0 + ctrlKey on Mac and acts as a Ctrl+click toggle.

## Scope change (from parent, mid-run)

Desktop Save/Save As/export writing is owned by the parent on master. Do not
touch `src/desktop/bun/text_file/`, `src/io/dialog/manager_file_dialog.ts`,
`src/io/dialog/desktop/`.

## Plan / status

1. [ ] Platform key map (`src/platform/keyboard/platform_keyboard_key_map*`):
       Mac aliases Delete → Backspace and ⌘Backspace; key glyphs ⌫ ⌦ ⎋ ⇥ ↩ …;
       shortcut matcher + label formatter + native menu accelerator use it.
2. [ ] Shared 'Ctrl'/'Alt' text formatter for UI strings
       (`platform_keyboard_modifier_map.modifierNameFormat`), replace hard-coded
       strings.
3. [ ] Platform pointer map (`src/platform/pointer/`): Control+click = right
       click on Mac; trackpad two-finger scroll pans 2D views, pinch zooms.
4. [ ] App-level Mac: Dock reopen re-shows window; Cmd+W closes the focused
       floating panel; before-quit cleanup.
5. [ ] Look: dark glass variant from prefers-color-scheme, font smoothing,
       no overscroll / user-select in chrome, Retina pixel ratio check.
6. [ ] Docs: documentation/user_input_and_shortcuts.md Mac notes.
7. [ ] E2E desktop steps + full verification.
