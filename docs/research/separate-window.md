# Excalidraw in a separate window — feasibility & design

Research date: 2026-09-11. Repo: `/home/mrsir/Lab/joplin-plugin-excalidraw`, branch `excalidraw-0.18-theme-editor-menu`.

All Joplin source citations are from `laurent22/joplin` branch `dev` as of 2026-09-11 unless stated.

---

## 0. TL;DR

- **Latest Joplin desktop: v3.7.16 (2026-09-06).**
- There is **no API to detach a dialog or panel into its own window.** Panels are hard-wired to the main window; dialogs have no window options at all.
- The only *supported* route to "Excalidraw in its own window" is `joplin.views.editors` + the built-in `openNoteInNewWindow` command. That API creates **one editor webview per window automatically** — it is the multi-window-aware view type, and it is available on mobile too.
- That API is note-scoped, so it forces a **"drawing note"** data model (note = one drawing) alongside today's embedded drawings. Joplin itself did exactly this with its new built-in Whiteboard (3.7).
- There is also an *unsupported but proven* route: `window.open` straight from the plugin's background page, which Joplin's window policy does not intercept. `joplin-plugin-freehand-drawing` ships it — at the cost of hand-rolling a ~170-line replacement for Joplin's webview contract. Keeps the embedded-drawing model; see design (e).
- **Quick win available today:** the dialog is `90vw × 90vh` with padding. Overriding four CSS custom properties via the `loadChromeCssFile` call the plugin *already makes* gets it to a true full-window canvas. ~20 lines, no version bump, and freehand-drawing already proves the technique.

---

## 1. Latest Joplin version

`https://api.github.com/repos/laurent22/joplin/releases/latest` → tag `v3.7.16`, published `2026-09-06T09:17:56Z`.

Confirmed against `readme/about/changelog/desktop.md`, whose newest heading is `## [v3.7.16] - 2026-09-06T09:17:56Z`.

---

## 2. The editor-plugin API (`joplin.views.editors`)

Source: `packages/lib/services/plugins/api/JoplinViewsEditor.ts` (note the **singular** filename; the namespace is plural). Exposed as `joplin.views.editors` via `packages/lib/services/plugins/api/JoplinViews.ts:59-62`:

```ts
public get editors() {
    if (!this.editors_) this.editors_ = new JoplinViewsEditors(this.plugin, this.store);
    return this.editors_;
}
```

> **Note:** the `api/` folder vendored in our repo is stale — it predates all of this. `api/JoplinViews.d.ts` has no `editors` getter and there is no `api/JoplinViewsEditor.d.ts`. Any work here starts with refreshing the vendored API types (see §7).

### 2.1 Shape

| Member | Signature | Notes |
|---|---|---|
| `register` | `register(viewId: string, callbacks: EditorPluginCallbacks)` | **The current entry point.** |
| `create` | `create(id: string): Promise<ViewHandle>` | **`@deprecated`** (JoplinViewsEditor.ts:166-181). Implemented as `register` with an `onActivationCheck` that always returns `false`. |
| `setHtml` | `setHtml(handle, html): Promise<string>` | |
| `addScript` | `addScript(handle, scriptPath): Promise<void>` | |
| `onMessage` | `onMessage(handle, callback)` | Pairs with `webviewApi.postMessage` in the view. |
| `postMessage` | `postMessage(handle, message): void` | Plugin → view. |
| `saveNote` | `saveNote(handle, { noteId, body }): Promise<void>` | "Saves the content of the editor, without calling `onUpdate` for editors in the same window." |
| `onUpdate` | `onUpdate(handle, callback)` | |
| `onActivationCheck` | `onActivationCheck(handle, callback)` | **`@deprecated`** — "should be provided when the editor is first created with `editor.register`". |
| `isActive` / `isVisible` | `(handle): Promise<boolean>` | |

There is **no `setActive`** in the public API. Activation is driven entirely by returning `true`/`false` from `onActivationCheck`. (`WebviewController.setActive` exists internally — `packages/lib/services/plugins/WebviewController.ts:320` — but is not exposed on `joplin.views.editors`.)

Callback types, `packages/lib/services/plugins/api/types.ts:400-432`:

```ts
export interface EditorUpdateEvent { newBody: string; noteId: string; }
export type UpdateCallback = (event: EditorUpdateEvent)=> Promise<void>;

export interface ActivationCheckEvent { handle: ViewHandle; noteId: string; }
export type ActivationCheckCallback = (event: ActivationCheckEvent)=> Promise<boolean>;

export interface EditorPluginCallbacks {
    onActivationCheck: ActivationCheckCallback;
    onSetup: (handle: ViewHandle)=> Promise<void>;
}
```

`onSetup` is documented in the same file as: *"Emitted when an editor view is created. This happens, for example, when a new window containing a new editor is created."*

### 2.2 Per-window instantiation — the key fact

`register()` creates one view **per window**, and keeps doing so for every window opened later (JoplinViewsEditor.ts:136-162):

```ts
const createEditorViewForWindow = async (windowId: string) => {
    const handle = createViewHandle(this.plugin, `${viewId}-${windowId}`);
    const removeController = initializeController(handle, windowId);
    const removeActivationCheck = registerActivationCheckHandler(handle);
    await callbacks.onSetup(handle);
    await this.onActivationCheck(handle, callbacks.onActivationCheck);
    listenForWindowOrPluginClose(windowId, () => { removeController(); removeActivationCheck(); });
};

await createEditorViewForWindow(defaultWindowId);

const onWindowOpen = (event: WindowOpenEvent) => createEditorViewForWindow(event.windowId);
eventManager.on(EventName.WindowOpen, onWindowOpen);
```

So: **`onSetup` fires once per window**, each with its own handle. `onActivationCheck` is filtered to the owning window (JoplinViewsEditor.ts:224-231):

```ts
const isCorrectWindow = windowId === this.controller(handle).parentWindowId;
const active = isCorrectWindow && await callback({ handle, noteId: effectiveNoteId });
```

This answers the "is a view instantiated per window?" question: **yes, automatically, and the plugin does not manage it.**

### 2.3 Window lifecycle — how the plugin knows a window closed

`packages/lib/eventManager.ts:22-23, 63-69`:

```ts
export enum EventName { … WindowOpen = 'windowOpen', WindowClose = 'windowClose', … }
export interface WindowOpenEvent { windowId: string; }
export interface WindowCloseEvent { windowId: string; }
```

These are **internal** (`@joplin/lib/eventManager`) and are **not** re-exported on `joplin.workspace`. `JoplinWorkspace.ts` exposes only `onNoteSelectionChange`, `onNoteContentChange`, `onNoteChange`, `onResourceChange`, `onNoteAlarmTrigger`, `onSyncStart`, `onSyncComplete`, plus `selectedNote/Folder/NoteIds/NoteHash` and `filterEditorContextMenu`.

**A plugin therefore has no direct "window closed" event.** What it gets instead:
- The per-window editor view is torn down for it (`listenForWindowOrPluginClose`, JoplinViewsEditor.ts:122-134, 148-153). The plugin is not notified, but it also does not leak.
- Indirect signals: `onActivationCheck` stops firing for that handle; `isVisible(handle)` goes false.

⚠️ **This is the single biggest lifecycle gap**: a "save on window close" hook does not exist. Any design that buffers unsaved state in the window must save continuously (autosave/debounce), not on close.

### 2.4 Visibility, and the global shown-editors setting

`showEditorPlugin` / `toggleEditorPlugin` live in `packages/lib/commands/showEditorPlugin.ts` and `toggleEditorPlugin.ts`. Both are plain commands, so `joplin.commands.execute('showEditorPlugin')` works.

`showEditorPlugin(editorViewId = '', show = true)` operates on `context.state.windowId` (the **focused** window) and persists into a **global** setting:

```ts
Setting.setValue('plugins.shownEditorViewIds', getUpdatedShownViewIds());
```

keyed by `editorView.editorTypeId`, which is `${pluginId}-${viewId}` (JoplinViewsEditor.ts:87). New windows then restore that state on creation (JoplinViewsEditor.ts:92):

```ts
void controller.setOpen(Setting.value('plugins.shownEditorViewIds').includes(editorTypeId));
```

**Consequence, both a feature and a hazard:** once the user has shown our editor anywhere, every newly opened window shows it too. That is exactly what we want for "open drawing in new window" — we do not have to race the new window to call `showEditorPlugin`. But it also means the main window flips to the Excalidraw editor for drawing notes, which may or may not be desired.

Also note `WebviewController.emitUpdate` suppresses `onUpdate` while the editor is inactive or hidden (WebviewController.ts:181-183).

### 2.5 Opening a note in a new window

`packages/app-desktop/commands/openNoteInNewWindow.ts`:

```ts
export const declaration: CommandDeclaration = {
    name: 'openNoteInNewWindow',
    label: () => _('Open in new window'),
    iconName: 'icon-share',
};

export const runtime = (): CommandRuntime => ({
    execute: async (context: CommandContext, noteId: string = null) => {
        noteId = noteId || stateUtils.selectedNoteId(context.state);
        …
        context.dispatch({ type: 'WINDOW_OPEN', noteId, folderId, windowId: `window-${noteId}-${idCounter++}`, … });
    },
    enabledCondition: 'oneNoteSelected',
});
```

- **Exact command name: `openNoteInNewWindow`.** Registered in `packages/app-desktop/commands/index.ts`, so it is a normal app command reachable from a plugin as `joplin.commands.execute('openNoteInNewWindow', noteId)`.
- It takes an **optional explicit `noteId`** — so the plugin can open *any* note in a new window, not just the selected one. This is the piece that makes the whole design work.
- Desktop-only (it lives in `packages/app-desktop`).

### 2.6 Minimum versions

Derived from commit history on `packages/lib/services/plugins/api/JoplinViewsEditor.ts` cross-referenced with the changelogs.

| Capability | PR | Landed | `app_min_version` |
|---|---|---|---|
| Multiple window support (`openNoteInNewWindow`) | #11181 | v3.2.1 pre-release, 2024-11-10 | **3.2** |
| Editor plugins (`views.editors.create`) | #11296 | v3.2.1 pre-release, 2024-11-10 | **3.2** |
| Editor plugin views on **mobile** | #11831 | android-v3.3.1 | **3.3** (mobile) |
| **Editor plugins support multiple windows** (`register`, per-window views) | #12041 / issue #11687, by @personalizedrefrigerator | v3.4.2 pre-release, 2025-07-24 | **3.4** |

Changelog lines:
- `v3.2.1`: `- New: Plugins: Add support for editor plugins ([#11296])` and `- Improved: Multiple window support ([#11181] by @personalizedrefrigerator)`
- `v3.4.2`: `- Improved: Plugins: Allow editor plugins to support multiple windows ([#12041]) ([#11687] by @personalizedrefrigerator)`
- `android-v3.3.1`: `- New: Add support for plugin editor views (#11831)`

**For the recommended design the floor is `app_min_version: "3.4"`** (we need per-window `register`). Our manifest currently says `"app_min_version": "2.8"` (`src/manifest.json`).

### 2.7 Mobile

**Editor plugins are supported on mobile** since android-v3.3.1 (PR #11831, "Mobile: Add support for plugin editor views", 2025-02-17). `JoplinViewsEditor.ts` lives in `packages/lib` (shared) and carries **no** `<span class="platform-desktop">` marker, unlike e.g. `JoplinViewsDialogs.showOpenDialog` (JoplinViewsDialogs.ts:93) and `JoplinWorkspace.filterEditorContextMenu` (JoplinWorkspace.ts:159).

Relevant for the sibling mobile project: `views.editors` is the **only** view API that is both multi-window on desktop and available on mobile. `openNoteInNewWindow` is desktop-only, but on mobile the editor simply takes over the full note screen, which is the same UX win. This is a strong argument for the editor-plugin route independent of windows.

---

## 3. Can a dialog or panel be detached into its own window?

### 3.1 Panels — no

`packages/lib/services/plugins/api/JoplinViewsPanels.ts:48`:

```ts
const controller = new WebviewController(handle, this.plugin.id, this.store, this.plugin.baseDir, ContainerType.Panel, defaultWindowId);
```

The parent window is hard-coded to `defaultWindowId`. There is no option, no overload, no setter. **Panels cannot exist in secondary windows.** Design (c) is dead.

### 3.2 Dialogs — no window options, but they *do* render per-window

`packages/lib/services/plugins/api/JoplinViewsDialogs.ts:66`:

```ts
const controller = new WebviewController(handle, this.plugin.id, this.store, this.plugin.baseDir, ContainerType.Dialog, null);
```

`parentWindowId` is `null`. The full dialog API is `create`, `showMessageBox`, `showToast`, `showOpenDialog`, `setHtml`, `addScript`, `setButtons`, `open`, `setFitToContent`. **Nothing window-related.**

Dialogs *are* rendered inside the per-window `WindowCommandsAndDialogs` component (`packages/app-desktop/gui/WindowCommandsAndDialogs/WindowCommandsAndDialogs.tsx:131` renders `<PluginDialogs …/>`; the component is `connect`ed on `ownProps.windowId`). Hence the doc note on `open()`:

> "Opens the dialog. **On desktop, this closes any copies of the dialog open in different windows.**"

So a dialog follows the focused window but cannot be *given* a window, and cannot outlive/float free of one.

### 3.3 Can a webview call `window.open`? — two different answers

Joplin's Electron handler, `packages/app-desktop/ElectronAppWrapper.ts:403-421`:

```ts
// Override calls to window.open and links with target="_blank": Open most in a browser instead of Electron:
webContents.setWindowOpenHandler((event) => {
    if (event.url === 'about:blank') {
        // Script-controlled pages: Used for opening notes in new windows
        return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: {
            nodeIntegration: false,
            preload: path.resolve(__dirname, './utils/window/secondaryWindowPreload.js'),
        } } };
    } else if (event.url.match(/^https?:\/\//)) {
        void bridge().openExternal(event.url);
    }
    return { action: 'deny' };
});
```

**(i) From a dialog/panel/editor webview — effectively blocked.** Those live inside the main window, whose `webContents` *is* passed through the handler. `about:blank` is allowed (it is how Joplin makes its own secondary windows) but yields an empty document with no Joplin bridge, no theme and no `webviewApi`; `file://` is `deny`d outright, so we could not even open our own bundle. Do not build on this.

**(ii) From the plugin's background page — unrestricted, and this is what shipping prior art actually does.** The handler is installed only on the main window and on windows created from it:

```ts
const addWindowEventHandlers = (webContents: WebContents) => {   // :393
    …
    webContents.on('did-create-window', (event) => { addWindowEventHandlers(event.webContents); });  // :424
};
addWindowEventHandlers(this.win_.webContents);  // :432 — main window only
```

Plugin background pages are a **separate** `BrowserWindow`, created in `packages/app-desktop/services/plugins/PluginRunner.ts:119-136` (`bridge().newBrowserWindow({ webPreferences: { nodeIntegration: true … } })` loading `services/plugins/plugin_index.html`). It is never passed to `addWindowEventHandlers`, so **`window.open('file://…')` from plugin code is not intercepted at all.**

`joplin-plugin-freehand-drawing` ships exactly this (see §9.1): `window.open(\`file://…/dialog/window/index.html\`, '_blank', 'autoHideMenuBar=true')`. It works, but the cost is that you must hand-roll everything Joplin would otherwise give you — the plugin re-implements the `webviewApi` contract, the button bar and the `setHtml`/`addScript` message protocol by hand (~170 lines), and gets no theme integration. Recorded below as design **(e)**.

### 3.4 How big is the dialog today, and what limits the canvas — the quick win

Our plugin calls `dialogs.setFitToContent(dialogHandle, false)` (`src/index.ts:123`). The `false` branch is styled in `packages/app-desktop/gui/styles/user-webview-dialog.scss`:

```scss
.user-webview-dialog {
    overflow: unset;
    align-items: center;
    --content-width: 90vw;
    --content-height: 90vh;

    &.-fit { --content-width: auto; --content-height: auto; }

    > .content {
        display: flex;
        flex-direction: column;
        background-color: var(--joplin-background-color);
        padding: var(--joplin-main-padding);
        border-radius: 4px;
        box-shadow: 0 6px 10px #00000077;
        width: var(--content-width);
        height: var(--content-height);
    }
}
```

(The API doc comment still says *"the dialog is set to 90vw and 80vh"* — **the doc is stale**; the stylesheet says `90vh`.)

Plus the button bar, `packages/app-desktop/services/plugins/styles/user-dialog-button-bar.scss`:

```scss
.user-dialog-button-bar { display: flex; width: 100%; box-sizing: border-box; justify-content: flex-end; padding-top: var(--joplin-main-padding); }
```

So the canvas loses: **10vw × 10vh**, plus `--joplin-main-padding` on all four sides of `.content`, plus the button bar and its top padding. That is the "squeezed with margins" Slava is describing.

The dialog element is a native `<dialog>` opened with `.showModal()` (`packages/lib/components/Dialog.tsx:52`), with classes `dialog-modal-layer` + `user-webview-dialog` (+ `-fit`). The inner iframe is `.plugin-user-webview` and — crucially — **carries the view handle as its DOM `id`**:

`packages/app-desktop/services/plugins/UserWebview.tsx:139-145`:
```tsx
return <iframe
    id={props.viewId}
    style={style}
    className={`plugin-user-webview ${props.fitToContent ? '-fit-to-content' : ''} …`}
    ref={viewRef} src={src}
></iframe>;
```

and `packages/lib/services/plugins/utils/createViewHandle.ts`:
```ts
return `plugin-view-${plugin.id}-${id}`;
```

⇒ our iframes have ids like `plugin-view-com.joplin.excalidraw-v2-excalidraw-dialog-<uuid>`. **That gives us a selector to scope the override to our own dialog** instead of restyling every plugin's dialogs. See §6.

Note `Dialog.tsx` also supports a `-fullscreen` modifier (`contentFillsScreen` prop, Dialog.tsx:62-66, styled in `dialog-modal-layer.scss`) — but `UserWebviewDialog` never passes `contentFillsScreen`, so plugins cannot reach it. CSS is the only lever.

---

## 4. Design fit

Our data model: **many drawings embedded in ordinary markdown notes**, each `![excalidraw.svg](:/<svgId>)` with a paired `.json` resource (`src/resources.ts`, `src/index.ts:96-98`). `joplin.views.editors` is, by construction, **an editor for a whole note**. That mismatch is the crux.

Worth knowing: **Joplin 3.7 ships a built-in "Whiteboard"** — a note-level canvas with cards, edges and groups (`packages/app-desktop/gui/WindowCommandsAndDialogs/commands/toggleWhiteboardEditor.ts`, `WHITEBOARD_FORCE_MARKDOWN_TOGGLE`, `activeNoteIsWhiteboard`; changelog entries across v3.7.3–v3.7.13). It reuses the editor-plugin toggle machinery (`toggleEditorPlugin.ts` branches on `windowState?.activeNoteIsWhiteboard`). So Joplin's own answer to "big canvas UI" was **note = one canvas**. That is a meaningful validation of option (b).

### (a) Editor plugin on a hidden/scratch note per editing session

Plugin creates or reuses a scratch note, `openNoteInNewWindow(scratchNoteId)`, editor activates on it, writes back to the origin note's resources, cleans up.

- **APIs:** `views.editors.register`, `data.post/delete(['notes'])`, `commands.execute('openNoteInNewWindow', id)`, `showEditorPlugin`.
- **Min version:** 3.4.
- **Risks:** ⚠️ **Severe.** Scratch notes are real notes — they sync, they appear in search, in All Notes, in conflict resolution, and on every other device. A crash or a force-quit leaves orphans (and §2.3 means we get no close event to clean up on). Deleting them creates sync-deletion churn. The "origin note" binding has to be persisted somewhere resilient. Two windows on the same drawing is entirely possible.
- **Effort: L.** And it fights the platform the whole way.
- **Verdict: reject.**

### (b) Editor plugin on real "drawing notes" (note = one drawing) ✅

A note whose body is a single `![excalidraw.svg](:/<id>)` (optionally plus a marker) *is* a drawing. `onActivationCheck` returns `true` for it; the editor renders Excalidraw full-bleed. Embedded drawings in mixed notes keep today's dialog.

- **APIs:** `views.editors.register` (`onSetup` + `onActivationCheck`), `editors.setHtml`/`addScript`/`onMessage`/`postMessage`, `editors.saveNote`, `commands.execute('openNoteInNewWindow', noteId)`, `showEditorPlugin`.
- **Min version:** 3.4 desktop; the same code gives mobile full-screen editing at 3.3+.
- **Risks:** two windows on the same drawing note is possible (Joplin does not prevent opening one note twice) — last-write-wins on the resource; mitigate with a debounced autosave and an in-plugin "this drawing is open elsewhere" guard keyed by resource id. The global `plugins.shownEditorViewIds` (§2.4) means the main window also switches to Excalidraw for drawing notes. Users must understand two kinds of drawing.
- **Effort: M.**
- **Verdict: recommended.** It is the only design where the note-scoped API and our data model actually agree, and it gets mobile for free.

### (c) A panel in a secondary window ❌

**Not possible.** `JoplinViewsPanels.ts:48` pins panels to `defaultWindowId`. Effort: N/A.

### (e) Raw `window.open` from the plugin background page — the freehand-drawing route

Keep the embedded-drawing data model exactly as-is; just render the editor into a real OS window opened directly from plugin code (§3.3(ii)).

- **APIs:** none of Joplin's — `window.open` plus a hand-rolled `webviewApi` shim and message protocol. Needs an `extraStandaloneScripts` entry in `plugin.config.json` for the popup page.
- **Min version:** works on anything modern (freehand-drawing declares `3.3.0`, for unrelated reasons).
- **Pros:** **no data-model change at all** — this is the only "separate window" design that preserves "many drawings per ordinary note". Full control of the window; no margins by construction.
- **Risks:** ⚠️ relies on an unhandled-by-design gap in Joplin's window policy — unversioned, undocumented, could be closed at any time (Joplin already tightened this area once: freehand-drawing's CHANGELOG 3.1.0, "Added a `Content-Security-Policy` to custom secondary windows"). No Joplin theme. **Closing the window via the titlebar X bypasses the in-page unsaved-changes confirmation** (freehand-drawing has no `beforeunload` guard on the popup — inferred from source, §9.1). Desktop-only. You maintain a webview-contract emulation layer forever.
- **Effort: L** (freehand-drawing's shim is ~170 lines before any Excalidraw wiring).
- **Verdict:** viable and proven, but it buys a separate window at the price of owning a parallel plugin-host implementation. Worth reconsidering only if the "drawing note" data model is rejected outright.

### (d) Anything else

- **`joplin.window`** — exists (`packages/lib/services/plugins/api/JoplinWindow.ts`) but is **only** `loadChromeCssFile` and `loadNoteCssFile`. **No window management whatsoever.** (Our plugin already uses `loadChromeCssFile` at `src/index.ts:209`.)
- **`joplin.views.noteList`** (`JoplinViewsNoteList`) — unrelated.
- **`views.editors.create`** — deprecated; do not use in new code.

### Comparison

| Design | Separate window? | Exact APIs | Min Joplin | Mobile | Lifecycle risk | Effort |
|---|---|---|---|---|---|---|
| **(b) Drawing notes + editor plugin** ✅ | **Yes**, via `openNoteInNewWindow` | `views.editors.register`, `editors.saveNote`, `openNoteInNewWindow`, `showEditorPlugin` | **3.4** | ✅ 3.3+ | Medium — same note in 2 windows; global shown-editors setting | **M** |
| (e) `window.open` from plugin page | **Yes**, keeps embedded model | none (hand-rolled shim) | ~3.3 | ❌ | **High** — unsupported gap, no theme, X-button loses changes | L |
| (a) Scratch note per session | Yes | as (b) + `data.post/delete(['notes'])` | 3.4 | ✅ | **High** — sync noise, orphan notes, no close event | L |
| (c) Panel in secondary window | **No — impossible** | — | — | — | — | N/A |
| (d1) `window.open` from dialog webview | **No — denied** | — | — | — | — | N/A |
| (d2) `joplin.window` | **No such API** | — | — | — | — | N/A |
| **(QW) Maximise the dialog** ⚡ | No — but removes the margins | `joplin.window.loadChromeCssFile` (already used) | **2.8, unchanged** | ❌ desktop-only CSS | **Very low** | **S** |

---

## 5. Recommendation

**Ship the quick win now (§6). Then implement design (b) as a second, opt-in "drawing note" mode.**

Rationale:
1. The quick win addresses the literal complaint — "squeezed inside a modal dialog with margins, more of the drawing visible" — in an afternoon, for every user on 2.8+, with zero architectural risk, using a technique freehand-drawing already proves. It is very likely *most* of the perceived value. **Ship it first and let Slava judge whether the window work is still wanted.**
2. Design (b) is the only *supported* real "separate window", and the only path that is simultaneously multi-window on desktop **and** available on mobile — which matters for the sibling project. Seven plugins use `views.editors.register` successfully; YesYouKan is a close structural match.
3. Embedded drawings stay exactly as they are. Nothing regresses.

**The honest counter-argument for (e):** it is the only design that gives a separate window *without* a new data model, and freehand-drawing — written by the same person who contributed Joplin's own multi-window and editor-plugin support — chose it over `views.editors`. That is a meaningful signal. But note they shipped it as a command-palette-only power-user feature with a "avoid having the same drawing open in multiple windows" caveat, and their titlebar-close path silently drops unsaved changes. Treat (e) as the fallback if the drawing-note model is rejected, not as the default.

### Implementation outline for (b)

**Step 0 — refresh the vendored plugin API.** `api/` in our repo predates `views.editors` entirely (no `editors` getter in `api/JoplinViews.d.ts`, no `JoplinViewsEditor.d.ts`). Run `npm run update` (`yo joplin --update`, already wired in `package.json`) or hand-copy the `.d.ts` files. Bump `src/manifest.json` `app_min_version` from `"2.8"` to `"3.4"` — or keep 2.8 and feature-detect `joplin.views.editors?.register` so old installs silently keep dialog-only behaviour. **Prefer feature-detection**; it avoids cutting off existing users.

**Step 1 — define the drawing-note marker.** Decide on the contract, e.g. a note whose body matches `^\s*!\[excalidraw\.svg\]\(:\/([a-z0-9]+)\)\s*$`. Reuse/extend `excalidrawSvgIds()` (`src/index.ts:160-166`) — add a `drawingNoteSvgId(body): string | null`. Keep it strict so ordinary notes never activate the editor.

**Step 2 — register the editor.** New file `src/editor.ts`:
```ts
await joplin.views.editors.register('excalidrawEditor', {
  onSetup: async (handle) => {
    await joplin.views.editors.setHtml(handle, '<div id="excalidraw-editor-root"></div>');
    await joplin.views.editors.addScript(handle, './editorView/index.js');
    await joplin.views.editors.addScript(handle, './editorView/index.css');
    await joplin.views.editors.onMessage(handle, onEditorMessage(handle));
    await joplin.views.editors.onUpdate(handle, async ({ noteId, newBody }) => { /* reload scene */ });
  },
  onActivationCheck: async ({ noteId }) => {
    const note = await joplin.data.get(['notes', noteId], { fields: ['body'] });
    return drawingNoteSvgId(note.body) !== null;
  },
});
```
Remember `onSetup` runs **once per window** — keep all per-view state keyed by `handle`, never in module-level singletons.

**Step 3 — port the webview.** Build a third bundle from `src/local-excalidraw/` into `dist/editorView/`, adding a `vite-editor.config.ts` alongside the existing `vite-local.config.ts` / `vite-webview.config.ts`, and a `dist:editor` script in `package.json`.
- **Replace the hidden-form data channel with `webviewApi.postMessage`.** The current `window.parent.document.getElementById(...)` trick (`src/local-excalidraw/index.ts:11-12, 50-68, 78-110`) does not apply here, and it is **already fragile**: `featureFlag.plugins.isolatePluginWebViews` (default `false`, but a public user-facing setting — `packages/lib/models/settings/builtInMetadata.ts:2392-2400`) serves the plugin webview from `joplin-content://plugin-webview/` instead of `file://`, which would make that cross-origin parent access throw. Moving to `postMessage` **fixes a latent bug**, not just a port.
- Keep `EXCALIDRAW_ASSET_PATH` absolute (the fix from commit `3b81aeb`); resolve it from the injected script's own URL.
- Keep the theme logic (`newDrawingTheme`, `preserveSavedTheme`, persisting `appState.theme` in `writeJson`) — pass the prefs in via `postMessage` at setup instead of hidden inputs.

**Step 4 — save.** There is **no close event** (§2.3), so autosave. On Excalidraw's `onChange`, debounce ~500ms (the existing `scheduleSvg` pattern in `src/local-excalidraw/index.ts:112-127` is the right shape), then `webviewApi.postMessage({ type: 'save', json, svg })`. Plugin side calls `updateDiagramResource(svgId, json, svg)` from `src/resources.ts`. The note body does not change, so `editors.saveNote` is only needed if we also rewrite the body — call it with the unchanged body only when we must, to avoid pointless note revisions.

**Step 5 — commands.**
- New `newExcalidrawNote`: create a note, seed its body with a fresh drawing's `![excalidraw.svg](:/id)`, `joplin.commands.execute('showEditorPlugin')`.
- New `openExcalidrawInNewWindow`: resolve the drawing via the existing `findExcalidrawForEditing()` (`src/index.ts:181-199`); if the current note is a drawing note, `joplin.commands.execute('openNoteInNewWindow', note.id)`. If it is an *embedded* drawing, either keep the dialog or offer "extract to its own note" — decide the UX, do not silently rewrite the user's note.
- Add both to the existing Tools > Excalidraw submenu (`src/index.ts:298-301`) and the context-menu filter (`src/index.ts:305-313`).

**Files to touch:** `src/index.ts`, new `src/editor.ts`, new `src/editorView/*` (from `src/local-excalidraw/`), `src/resources.ts` (unchanged logic, new caller), `src/manifest.json`, `package.json`, new `vite-editor.config.ts`, `webpack.config.js` (ship the new bundle). `src/webview/` is dead code (only referenced by `vite-webview.config.ts`, never registered in `src/index.ts`) — good candidate to delete while you are here.

---

## 6. The cheap quick win ⚡

Maximise the dialog and strip its chrome. The plugin **already** calls `joplin.window.loadChromeCssFile(installDir + '/excalidraw.css')` at `src/index.ts:209`, so there is nothing new to wire up — just append to `src/excalidraw.css`.

Scoped to our own dialog via the iframe id (§3.4), so other plugins' dialogs are untouched:

```css
/* Give the Excalidraw dialog the whole window: Joplin's default is 90vw x 90vh
   plus --joplin-main-padding on every side (gui/styles/user-webview-dialog.scss). */
.user-webview-dialog:has(> .content > .user-dialog-wrapper > iframe[id*="com.joplin.excalidraw-v2"]) {
  --content-width: 100vw;
  --content-height: 100vh;
}
.user-webview-dialog:has(> .content > .user-dialog-wrapper > iframe[id*="com.joplin.excalidraw-v2"]) > .content {
  padding: 0;
  border-radius: 0;
  box-shadow: none;
}
.user-webview-dialog:has(> .content > .user-dialog-wrapper > iframe[id*="com.joplin.excalidraw-v2"]) .user-dialog-button-bar {
  padding-top: 0;
  padding-right: 8px;
  padding-bottom: 4px;
}
```

**This exact technique is proven prior art** — `joplin-plugin-freehand-drawing` ships it (§9.1), same `loadChromeCssFile` mechanism, same `.user-webview-dialog` + iframe-id-substring selector, behind a user setting.

Notes:
- `:has()` is fine — Joplin 3.x runs Chromium ≫ 105. If you want to support very old Joplin, drop `:has()` and accept the unscoped version (`.user-webview-dialog { --content-width: 100vw; … }`), which affects all plugin dialogs.
- **Deliberate divergence from freehand-drawing:** they absolutely-position the *iframe* to `100vw × 100vh`, which overlays and hides the dialog button bar — hence their `:not(:has(* > button))` guard, and why they only go fullscreen when they have removed the buttons and drawn their own. **Our Save/Close buttons are load-bearing** (`src/index.ts:119-122`, and the click interception at `src/local-excalidraw/index.ts:139-162` depends on the parent "Save" button existing). So override the `--content-*` custom properties instead, as above, and keep the button bar visible.
- `100vh` may leave the button bar overflowing; `calc(100vh - 2.5rem)` for `--content-height` is the safer value if the Save/Close row gets clipped. **Verify visually** — this is the one thing here I could not test.
- Consider putting it behind a setting, as freehand-drawing does (`disable-editor-fills-window`), so users who liked seeing the note behind the dialog can opt out.
- Going further (hiding the button bar entirely and moving Save into Excalidraw's own menu) would remove the click-interception hack, but that is a behaviour change, not a quick win.

**Effort: S.** No version bump, no API change, no manifest change.

---

## 7. Risks

1. **No window-close event for plugins (§2.3).** Biggest structural risk. There is no `onDestroy`, no `WindowClose` on `joplin.workspace`. Design must autosave; "save on close" is unimplementable. ⚠️
2. **Same drawing open in two windows.** Joplin will happily open one note in several windows. Two Excalidraw instances autosaving the same resource = last-write-wins, silent data loss. Needs an in-plugin lock keyed by resource id, and ideally a visible "read-only, open elsewhere" state.
3. **`plugins.shownEditorViewIds` is global, not per-window (§2.4).** Showing the editor once makes every new window show it. Convenient for the feature, surprising for the user.
4. **Stale vendored `api/` types.** Our `api/` folder is from the 2.8 era. Everything in §2 is invisible to the TypeScript compiler until it is regenerated. `src/index.ts:209` already casts around this (`(joplin as any).window`).
5. **`featureFlag.plugins.isolatePluginWebViews`.** Default `false`, but user-togglable. If enabled, today's `window.parent.document` data channel (`src/local-excalidraw/index.ts:11-12`) becomes cross-origin and **the plugin breaks** — the Save button would silently write nothing. This is a **pre-existing bug** worth fixing regardless of the window work.
6. **Raising `app_min_version` to 3.4** cuts off users on 3.2/3.3. Feature-detect instead.
7. **Joplin's built-in Whiteboard (3.7)** occupies adjacent conceptual space and reuses the same toggle command (`toggleEditorPlugin.ts` branches on `activeNoteIsWhiteboard`). Not a conflict today, but worth watching — and worth checking that our editor toggles cleanly on a note that is also a whiteboard.
8. **Stale upstream docs.** The `setFitToContent` doc comment says 80vh; the stylesheet says 90vh. `JoplinViewsEditor`'s class doc tells plugins to call `joplin.workspace.selectedNote()` in `onUpdate` — that reads global state, and while its own doc says "on desktop, this returns the selected note in the focused window" (JoplinWorkspace.ts:168-173), the focused window is **not necessarily** the window whose editor is updating. **Always use the `noteId` from the `onUpdate`/`onActivationCheck` event**, never `selectedNote()`.

---

## 8. Could not verify

- Whether `100vh` clips the dialog button bar in practice (needs a running Joplin).
- Exact stable-release date mapping for 3.2/3.4 finals (dates above are the **pre-release** in which each PR first shipped; the stable minor is the same number).
- Runtime behaviour of the `window.open` popup in design (e) — theme inheritance, titlebar-close semantics — read from source only.
- "No other plugin does X" claims in §9 rest on GitHub code search, which indexes only public repos and can miss files.

---

## 9. Prior art

### 9.1 `personalizedrefrigerator/joplin-plugin-freehand-drawing` (js-draw)

HEAD `7d3baea` (2026-05-01), version 4.3.0, id `io.github.personalizedrefrigerator.js-draw`, `app_min_version: "3.3.0"`, `categories: ["editor"]`.

**It has both a dialog mode and a separate-window mode — and uses `views.editors` for neither.** `grep -rniE "views\.editors" src/ api/` → zero hits.

An abstract base (`src/dialog/AbstractDrawingView.ts:47`) declares `setHtml/addScript/setDialogButtons/postMessage/onMessage/showDialog`, with two implementations:

- `src/dialog/DrawingDialog.ts` — the modal path: `dialogs.create(...)` (:38), `dialogs.setFitToContent(handle, false)` (:46), `dialogs.open(handle)` (:91). Curiously it pumps messages through the *panels* namespace on a dialog handle: `joplin.views.panels.postMessage(await this.handle, message)` (:83).
- `src/dialog/DrawingWindow.ts` — the separate-window path, **no Joplin view API at all** (:68):
  ```js
  const dialog = window.open(
      `file://${posixPath.normalize(installationDir)}/dialog/window/index.html`,
      '_blank', 'autoHideMenuBar=true')!;
  ```
  The popup page `src/dialog/window/window.ts` then re-implements Joplin's webview contract by hand so the same `webview.js` payload runs unmodified: a `window.onmessage` router for `addScript`/`setHtml`/`setButtons` with an origin guard `event.origin.startsWith('file:')` (:15-65), a synthesized `(window as any).webviewApi = { postMessage, onMessage }` shim over `window.parent.postMessage` (:72-99), and real `<button>` elements that post `{kind:'dialogResult'}` then `window.close()` (:42-51). Shipped via `plugin.config.json` → `extraStandaloneScripts`.

**Discoverability of the new-window mode is poor and deliberate:** two `DrawingManager` instances (`src/index.ts:21-31`) back two commands, `…insertDrawing` and `…insertDrawing__newWindow` (:33, :44). Only the same-window one gets a toolbar button (:54) and an Edit-menu item (:62) — the new-window command is **command-palette-only** (CHANGELOG.md:123).

**Data model — embedded resources, same as ours.** Insert is `` `![${resource.htmlSafeTitle()}](:/${resource.resourceId})` `` (`src/DrawingManager.ts:47`). Editing is entered from a markdown-it content script matching `img[src*=".svg"]` filtered by `/[a-z0-9]{32}[.]svg([?]t=\d+)?$/` (`src/contentScripts/markdownIt-content.ts:30`, `utils/makeImageEditable.ts:14`) — essentially the same design as our `src/contentScripts/markdownIt-content.js`. Saving is `joplin.data.put(['resources', id], …, [{path: tempfile}])` (`src/Resource.ts:71`), matching our `updateDiagramResource`.

**Unsaved changes** are handled *inside* the webview: it posts `{type: ShowCloseButton, isSaved}` (`screens/showCloseScreen.ts:19-22`) and the host flips its single button between `{id:'ok', title: close}` and `{id:'cancel', title: discardChanges}` (`AbstractDrawingView.ts:189-195`). ⚠️ **There is no `beforeunload` guard on the popup**, so closing the separate window by its titlebar X appears to bypass the confirmation entirely — a concrete illustration of the §2.3 "no close event" problem in design (e).

**Multi-window:** zero `windowId` hits anywhere in `src/`. CHANGELOG 2.8.0 warns *"For now, avoid having the same drawing open in multiple different windows"*; 2.17.0 fixed dialogs in one window closing dialogs in another via a dialog pool (`DrawingManager.getClosedDialog_()`, :28-37) — which is the documented `dialogs.open()` behaviour from §3.2.

**The fullscreen CSS** (`src/dialog/DrawingDialog.ts:53-63` → `joplin.window.loadChromeCssFile(installationDir + '/dialog/userchromeStyles/dialogFullscreen.css')`, toggled by a `disable-editor-fills-window` setting):

```css
.user-webview-dialog:not(
	/* Exclude the case where buttons would be hidden by the iframe */
	:has(* > button)
) iframe[id*='js-draw-jop-freehand-drawing-jsdraw-plugin-jsDrawDialog'] {
	position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
}
```

This independently confirms every mechanism the §6 quick win relies on: `loadChromeCssFile` reaching the dialog chrome, the `.user-webview-dialog` class, and matching the iframe by view-handle substring. See §6 for why we should override the custom properties instead of absolutely-positioning the iframe.

### 9.2 Other plugins using `views.editors.register`

Seven plugin repos found (GitHub code search; 22 raw hits incl. forks/docs):

| Repo | File | Activation marker |
|---|---|---|
| `joplin/plugin-yesyoukan` (the reference impl. cited in Joplin's own docs) | `src/index.ts:32` | `noteBody.includes('```kanban-settings')` (`utils/noteParser.ts:16-19`) |
| `CalebJohn/joplin-inline-todo` | `src/editor.ts:15` | `isSummary(note)` + a `custom_editor` setting gate |
| `txnam/JoplinKan` | `src/editor/registerKanbanEditor.ts:199` | not read |
| `txnam/JoplinMemo` | `src/editor/registerMemoEditor.ts:341` | not read |
| `lansidev/joplin-shopping-list` | `src/index.ts:281` | `onActivationCheck: async ({ noteId }) => …` |
| `kamleshnanda/joplin-notesheet-plugin` | `src/index.ts:29` | not read |
| `KingCruzIII/joplin-plugin-notexl` | `src/index.ts:33` | uses the **deprecated** `create()` + `onActivationCheck(view, …)` form and reads `workspace.selectedNote()` instead of `event.noteId` — i.e. the §7.8 anti-pattern |

**None of the seven handles `windowId`, `newWindow` or fullscreen** (zero grep hits). They register once and let Joplin fan out per window, exactly as §2.2 describes — which is the point: **the multi-window behaviour is free.**

YesYouKan is the closest model for us: `joplin.views.editors.saveNote(editorHandle, {...})` (`src/messageHandlers.ts:30, :106`), force-shows itself with `joplin.commands.execute('showEditorPlugin')` (`src/index.ts:237`) and hides with `(…, null, false)` (`messageHandlers.ts:139`). Manifest: `app_min_version 3.4.2`, `platforms: [desktop, mobile]` — **independently confirming 3.4.2 as the practical floor for `register`** (§2.6) and that the same code serves mobile.

Its one multi-window concession is defensive, not windowId-aware (`src/index.ts:41-52`): *"In some cases selectedNoteIdRef isn't set during the initial load of the editor"* → falls back to `workspace.selectedNote()`.

### 9.3 Plugins calling `openNoteInNewWindow`

Three, all context-menu "open in new window" affordances on a note list:

- `benlau/joplin-plugin-kanmug`, `src/kanbanApp.ts:294-295`
- `Rinsutoringu/full_notebook_view`, `src/index.ts:1173-1178` (try/catch → `'Command not available'`)
- `lim0513/joplin-explorer`, `src/index.ts:1991-1992` — `try { execute('openNoteInNewWindow', id) } catch { execute('openNote', id) }`, a nice graceful-degradation pattern worth copying

⚠️ **None of them combines `openNoteInNewWindow` with an editor plugin.** The recommended design (b) is therefore *novel* — each half is well-trodden, the combination is not. Budget for surprises at the seam (specifically: the global `plugins.shownEditorViewIds` behaviour in §2.4 is the part no existing plugin exercises this way).

### 9.4 Dialog-maximising CSS elsewhere

Essentially nobody but freehand-drawing. `"user-webview-dialog" language:CSS` → 14 hits, all either its two files or verbatim copies cached in dotfiles repos. `"dialog-modal-layer"` → Joplin core/forks plus two *themes* doing cosmetic restyling (`andrejilderda/joplin-macos-native-theme`, which also loads via `joplin.window.loadChromeCssFile` at `src/index.ts:36-37`; `ivfrost/joplin-adwaita-theme`). `"loadChromeCssFile"` → 149 hits, overwhelmingly Joplin itself and forks; the only non-fork plugin consumers surfaced were those two.
