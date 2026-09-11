# Joplin changelog

## 3.0.1

- The hover toolbar over drawings is now dark in dark themes; it used to fall back to white when
  Joplin's theme variables were not available in the note viewer

## 3.0.0

First release as **Excalidraw** (`io.github.pmslava.excalidraw`), the continuation of
`joplin-excalidraw-v2` 2.0.0 by neagix.

- Excalidraw 0.18.1
- Fixed the text tool and the hand-drawn font in exported SVGs
- Save, Close and a full-size toggle as one bar at the bottom right of the editor, in both
  sizes, replacing Joplin's button band under the dialog
- Full-size toggle in the editor: expand the dialog to the whole Joplin window and back
- Light and dark theme support, with settings for new drawings and for keeping each drawing's
  saved theme
- Copy a drawing as a PNG image, from the viewer's toolbar, the right-click menu or Tools >
  Excalidraw. Joplin's own "Copy image" copies nothing for a drawing in the Markdown editor,
  because Electron cannot decode SVG (joplin#15878); the plugin rasterises the drawing itself,
  at 2x, light or dark
- Copy a drawing as JSON: the clipboard gets Excalidraw's own clipboard format, so pasting into
  excalidraw.com, Obsidian's Excalidraw plugin or another drawing here inserts editable
  elements, not a picture
- Edit a drawing in a second Joplin window, so the note and the drawing are side by side
  (existing drawings only). The same drawing can no longer be opened in two editors at once
- A hover toolbar over each drawing in the viewer -- Edit, Edit in a new window, Copy as image,
  Copy as JSON -- replacing the single "Edit" button, in Joplin's own theme colours
- Tools > Excalidraw submenu grouping every command
- Edit a drawing from the Markdown editor: right-click menu and the cursor's current line
- Drawings refresh in place after saving, instead of showing a stale preview, and stay visible
  in every window: a drawing saved from a second window no longer leaves a broken image in the
  first window's Markdown editor (a resource's file is briefly renamed away while Joplin
  rewrites it, and `editor.execCommand` only ever reaches the focused window's editor). The
  image retries itself, and each window catches up when it regains focus
- Excalidraw's own chrome stays inside the dialog on a narrow window: the Library button goes
  icon-only, the toolbar's keybinding hints are hidden and the top row tightens up, instead of
  the Library button being cut off at the dialog's edge
- Edit button now works in the Rich Text editor
- "Mermaid to Excalidraw" works again: opening it no longer crashes the editor (upstream #3)
- New plugin id and renamed internal identifiers (content scripts, commands, CSS classes, temp
  folder) so the plugin no longer collides with joplin-excalidraw-v2

The entries below are the history of the predecessor plugins, oldest first.

## v1.1.1 - 2022-10-7 18:37:29

- artikell: fix windows open problem

## v1.1.0 - 2022-10-7 16:21:00

- artikell: slows the synchronization speed, making it easy to modify notes
- artikell: add switch button of the panel

## v1.3.0 - 2022-11-1 00:16:18

- artikell: refactor: Bundle webview with vite @Winbee
- artikell: feature: Support excalidraw dialog
- artikell: fix excalidraw panel in windows open error

## v1.4.0 - 2023-3-11 12:19:36

- artikell: feature: Remove excalidraw panel
- artikell: feature: Modify excalidraw icon

## v1.4.1 - 2023-03-12 08:41:08
- artikell: fix no such file or directory error

## v1.5.1 - 2024-01-20

- smallzh: use an SVG to display the drawing content after clicking a render button

## v2.0.0 - 2025-10-03

- neagix: auto-save SVG on change, use local assets, better resource titles, support conversion of v1 excalidraw resources
