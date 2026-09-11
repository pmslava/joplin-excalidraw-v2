# Excalidraw

[Excalidraw](https://github.com/excalidraw/excalidraw) drawings in your Joplin notes.

![Excalidraw in action](./example_v2.png)

## What it does

- **Create a drawing** — click the pencil button on the editor toolbar, draw, and close the
  dialog. The drawing is inserted at the cursor as a normal image.
- **Edit a drawing** — hover a drawing in the Markdown viewer or in the Rich Text editor and
  click the **Edit 🖊️** button that appears over it.
- **Edit from the Markdown editor** — put the cursor on the line holding a drawing and use
  **Tools → Excalidraw → Edit Excalidraw drawing**, or right-click and pick the same entry from
  the editor's context menu. The entry only shows up when the current line actually holds a
  drawing.
- **Tools → Excalidraw** groups both commands (*Add Excalidraw drawing*, *Edit Excalidraw
  drawing*) in one submenu.
- **Save and Close inside the editor.** The bottom right of the canvas holds one small bar with
  **Save**, **Close** and a full-size toggle, instead of Joplin's button band under the dialog —
  in both sizes, and out of the way of Excalidraw's own toolbars. *Escape* still closes the
  editor too.
- **Full size.** The toggle next to *Save* expands the editor to the whole Joplin window and
  back — no margin round the drawing. The last choice is remembered, and the *Open the editor
  full size* setting (on by default) decides how the editor opens the first time.
- **Light and dark theme.** The editor follows Joplin's own theme by default. Two settings under
  **Tools → Options → Excalidraw**:
  - *Theme for new drawings* — Follow Joplin theme (default), Light, or Dark.
  - *Keep each drawing's saved theme* — on by default. When off, existing drawings also open
    using the *Theme for new drawings* setting.
- Saving a drawing refreshes its image in place, so you see the new version without reopening
  the note.

## How drawings are stored

Each drawing is two Joplin resources:

- a **`.json`** resource — the Excalidraw scene, the editable source;
- an **`.svg`** resource — the preview that Joplin renders in the note.

The note body itself holds nothing special, just an ordinary Joplin image link:

```
![excalidraw.svg](:/970d7f3995b94321827cdcb8b9e16dc0)
```

The two resources are paired by their titles (`excalidraw-<json resource id>.json` and
`excalidraw-<json resource id>.svg`), so the drawing survives sync and export like any other
attachment.

## Coming from joplin-excalidraw-v2 or joplin-excalidraw

This plugin is the continuation of [`joplin-excalidraw-v2`](https://github.com/neagix/joplin-excalidraw-v2)
by neagix, which is no longer maintained (last commit October 2025), itself a fork of
[`joplin-excalidraw`](https://github.com/artikell/joplin-excalidraw) by artikell.

> [!IMPORTANT]
> **Uninstall the old plugin first.** With both installed you get two Edit buttons on every
> drawing, two pencil buttons on the toolbar and two Tools → Excalidraw submenus — and because
> Joplin does not namespace content-script ids, an Edit click can be handled by the *other*
> plugin's editor.

- **Your existing drawings keep working.** Both the `![excalidraw.svg](:/id)` links and the
  `excalidraw-<id>.json` / `.svg` resource pairs are read unchanged. Nothing is converted or
  rewritten on install.
- **Drawings from the original v1 plugin** (`![excalidraw](excalidraw://…)`) still show a
  **Convert to v2 🔄** button. The converted copy starts with a placeholder preview — open it
  once and save to get a real one. The original v1 resource is left untouched, so other notes
  referencing it are unaffected.
- **Settings start at their defaults.** Joplin stores plugin settings under the plugin's id, so
  the new id starts fresh: *Follow Joplin theme*, *Keep each drawing's saved theme* and *Open the
  editor full size*. Three settings, ten seconds to redo.

## Notes & credits

> [!CAUTION]
> Not compatible with the Freehand Drawing plugin, it causes glitches when both are enabled.

- Tested on macOS, Linux and Windows desktop apps.
- Original plugin by [artikell](https://github.com/artikell/joplin-excalidraw); v2 by
  [neagix](https://github.com/neagix/joplin-excalidraw-v2).
- Thanks to [@Winbee](https://github.com/Winbee) for the Vite refactor.
- Thanks to [@smallzh](https://github.com/smallzh) for the SVG preview support.
- This project refers to the [ThibaultJanBeyer/joplin-sheets](https://github.com/ThibaultJanBeyer/joplin-sheets)
  project, thank you.
- Thanks to [@Akiyamka](https://github.com/Akiyamka) for testing.
- The [Excalidraw](https://github.com/excalidraw/excalidraw) library is bundled into the plugin
  (MIT, Copyright (c) 2020 Excalidraw), together with its fonts and assets; the fonts are covered
  by their own licences.

## Development

See [GENERATOR_DOC.md](./GENERATOR_DOC.md) for the code generation instructions.

```sh
npx yarn@1.22.22 install
npm run dist
```

`npm run dist` writes the release package to `publish/` (a `.jpl` archive and its manifest
`.json`).

For development you can point Joplin straight at the build output: `Tools` → `Options` →
`Plugins` → `Show advanced settings`, and add this repository's `dist/` directory.
