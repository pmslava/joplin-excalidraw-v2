# Editing a drawing and its note simultaneously — separate-window design

Research date: 2026-09-11. Repo: `/home/mrsir/Lab/joplin-plugin-excalidraw`, branch `excalidraw-0.18-theme-editor-menu`.

All Joplin citations are from **`laurent22/joplin` tag `v3.7.16`** (desktop, 2026-09-06) unless stated. Builds on, and does not repeat,
`/home/mrsir/Lab/joplin-plugin-excalidraw/docs/research/separate-window.md` (referenced below as **PR** = prior report).

---

## 0. TL;DR

- **D1 works, and the decisive fact is already proven in the wild.** `dialogs.open()` shows the dialog in **the focused window only**, and removes copies from every other window. Third-party confirmation: freehand-drawing's CHANGELOG 2.17.0 — *"Previously, opening a drawing dialog in a new Joplin window closed any dialogs open in other windows."* That sentence only makes sense if plugin dialogs already render in secondary windows.
- **Today's plugin already half-works in a second window.** The editor toolbar, the Tools menu, the editor context menu and `editor.execCommand` all resolve per-window. If the user opens the note in a new window with Joplin's own "Open in new window" and clicks the Excalidraw button **there**, the dialog opens **there**, and window A stays fully usable. The only thing missing is a one-click command and the full-window CSS.
- **The one genuinely new risk in D1 is a focus race**, not modality: `open()` targets whatever window redux thinks is focused at that instant, and `WINDOW_FOCUS` arrives via a main-process IPC round trip after `openNoteInNewWindow` returns.
- **Window A refreshes by itself.** Joplin 3.7's CodeMirror 6 already re-renders inline resource images on the global `ResourceChange` event, in every window. Our `excalidrawRefreshImage` content-script hack is largely redundant on 3.7 (keep it for older versions).
- **D2 does not flip the main window** — `plugins.shownEditorViewIds` is read exactly once per view, at view creation. PR §2.4's "hazard" framing is too strong.
- **Recommendation: D1**, with a per-window handle pool. D2 is the fallback and stays a bigger, note-scoped rewrite.

---

## 1. Where does a plugin dialog render? → **the focused window only**

Three pieces, all decisive.

**(a) The renderer filters on per-window state, not on `view.opened` and not on `parentWindowId`.**

`packages/app-desktop/gui/WindowCommandsAndDialogs/PluginDialogs.tsx:18-22`:

```tsx
for (const info of infos) {
    const { plugin, view } = info;
    if (view.containerType !== ContainerType.Dialog) continue;
    if (!props.visibleDialogs[view.id]) continue;
```

`view.opened` is never read here. `parentWindowId` (which is `null` for dialogs — `JoplinViewsDialogs.ts:66`, PR §3.2) is never read here either.

`visibleDialogs` is supplied **per window** — `WindowCommandsAndDialogs.tsx:200-207`:

```tsx
export default connect((state: AppState, ownProps: ConnectProps) => {
	const windowState = stateUtils.windowStateById(state, ownProps.windowId);
	return {
		…
		visibleDialogs: windowState.visibleDialogs,
```

and this component is mounted once per window: `gui/Root.tsx:181` (`windowId={defaultWindowId}`) and `gui/NoteEditor/EditorWindow.tsx:145` (`<WindowCommandsAndDialogs windowId={props.windowId} />`, inside the portal).

**(b) `open()` dispatches an action with no window id, which lands on the focused window's slice.**

`packages/lib/services/plugins/WebviewController.ts:220-247`:

```ts
public setOpen(show = true): null|Promise<DialogResult|null> {
	this.setStoreProp('opened', show);
	…
	} else if (this.containerType_ === ContainerType.Dialog) {
		if (this.closeResponse_) {
			this.closeResponse_.resolve(null);
			this.closeResponse_ = null;
		}
		if (show) {
			this.store.dispatch({
				type: 'VISIBLE_DIALOGS_ADD',
				name: this.handle,
			});
			return new Promise<DialogResult>((resolve, reject) => {
				this.closeResponse_ = { resolve, reject };
			});
```

`packages/app-desktop/app.reducer.ts:442-447`:

```ts
case 'VISIBLE_DIALOGS_ADD':
	newState = { ...state };
	newState.visibleDialogs = { ...newState.visibleDialogs };
	newState.visibleDialogs[action.name] = true;
	newState = hideBackgroundDialogsWithId(newState, action.name);
	break;
```

`newState` here is the **top-level** state object, which by construction *is the focused window's state*:

> `readme/dev/spec/background_windows.md:7` — "Each entry in `backgroundWindows` contains the state of a window that is in the background (not currently focused). The currently focused window's state is stored in the top-level state object."

The swap happens in `packages/lib/reducer.ts:962-981` (`handleFocus`, called from `case 'WINDOW_FOCUS'` at :1007).

**(c) "closes any copies of the dialog open in different windows" is `hideBackgroundDialogsWithId`.**

`app.reducer.ts:146-153`:

```ts
const hideBackgroundDialogsWithId = produce((state: AppState, id: string) => {
	for (const windowId of Object.keys(state.backgroundWindows)) {
		const win = state.backgroundWindows[windowId];
		if (id in win.visibleDialogs) {
			delete win.visibleDialogs[id];
		}
	}
});
```

Note it deletes **only that handle id** from background windows. Other handles are untouched → see §4.

### Conclusion (Q1)

**With window B focused, `dialogs.open(handle)` shows the dialog in B only.** Window A does not get a copy, and any copy of *that same handle* previously shown in A is silently removed. Filtering is by `visibleDialogs[view.id]` on the per-window slice, decided by which window was focused at the moment `open()` ran — never by `parentWindowId`, never by `view.opened`.

Third-party corroboration: `personalizedrefrigerator/joplin-plugin-freehand-drawing` `CHANGELOG.md` §2.17.0:

> "Improve support for secondary Joplin windows. Previously, opening a drawing dialog in a new Joplin window closed any dialogs open in other windows."

---

## 2. Modality scope → per-document; nothing app-wide blocks window A

**The dialog is a native `<dialog>` created in that window's own document.** `packages/lib/components/Dialog.tsx:141-197`:

```ts
useEffect(() => {
	if (!containerDocument) return () => {};
	const dialog = containerDocument.createElement('dialog');
	dialog.classList.add('dialog-modal-layer');
	…
	containerDocument.body.appendChild(dialog);
```

and `:41-51`:

```ts
const open = props.open ?? true;
if (!dialogElement.open && open) {
	dialogElement.showModal();
```

`containerDocument` comes from `useDocument(containerElement)` on a node rendered inside that window's React portal, so `showModal()` applies to **window B's document top layer** only. `UserWebviewDialog.tsx:87-105` is the only consumer for plugin dialogs.

Secondary windows are real `BrowserWindow`s (`gui/NewWindowOrIFrame.tsx:47-55`, `window.open('about:blank')` + portal), but all run in **one renderer process with one redux store** (`background_windows.md:108-146`). So there is no cross-process lock, and no global modal layer: `ModalMessageOverlay` is only rendered when `state.modalOverlayMessage !== null` (`WindowCommandsAndDialogs.tsx:130`), which plugin dialogs never set.

Keyboard and menus keep working in A: the menubar is application-global (`background_windows.md:161`) and commands resolve by runtime priority against the focused document (§5a).

### What *does* leak

1. **`modalDialogVisible` is computed from the top-level slice, not per window** — `packages/app-desktop/services/commands/stateToWhenClauseContext.ts:26`:

   ```ts
   modalDialogVisible: !!Object.keys(state.visibleDialogs).length,
   ```

   Editor commands are gated on `'(!modalDialogVisible || gotoAnythingVisible)'` (`gui/NoteEditor/editorCommandDeclarations.ts:30-38`). So **while B is focused with the dialog open, editor commands are reported disabled in every window**, A included. In practice this is harmless: the moment the user clicks into A, Electron fires `window-focused` → `WINDOW_FOCUS` (`app.ts:739-748`) → `handleFocus` swaps A's (empty) `visibleDialogs` to the top level → `modalDialogVisible` goes false again, while B **keeps** the dialog (its `visibleDialogs` moves to `backgroundWindows`, and `hideBackgroundDialogsWithId` is *not* called on focus changes). Typing itself is never gated — only command-bound shortcuts and toolbar buttons.

2. **`joplin.views.dialogs.showMessageBox` is app-global and synchronous.** `packages/app-desktop/services/plugins/PlatformImplementation.ts:58-60` → `bridge().showMessageBox` → `packages/app-desktop/bridge.ts:423-425`:

   ```ts
   private showMessageBox_(window: BrowserWindow, options: MessageDialogOptions): number {
   	if (!window) window = this.activeWindow();
   	return dialog.showMessageBoxSync(window, { message: '', ...options });
   }
   ```

   `showMessageBoxSync` blocks the main process, i.e. **every** window. Our plugin calls it in `findExcalidrawForEditing()` (`src/index.ts:193-198`). Fine as-is (it is a user-initiated error path), but never call it from a background/autosave path.

---

## 3. Readiness signal after `openNoteInNewWindow`

### What the command actually does

`packages/app-desktop/commands/openNoteInNewWindow.ts:18-33` — unchanged from PR §2.5: it only dispatches `WINDOW_OPEN` with a generated `windowId`. **It never focuses anything itself.** The reducer (`lib/reducer.ts:985-1005`) only adds a `backgroundWindows[windowId]` entry; the top-level (focused) slice is untouched.

### The real creation chain

1. `WINDOW_OPEN` reduced.
2. **Synchronously in the redux middleware**, `packages/lib/components/shared/reduxSharedMiddleware.ts:150-158`:
   ```ts
   if (action.type === 'WINDOW_OPEN') {
       eventManager.emit(EventName.WindowOpen, { windowId: action.windowId });
   ```
   ⇒ **an editor plugin's `onSetup` fires here** (`JoplinViewsEditor.ts:156-162`), i.e. *before the OS window exists*. `onSetup` is a "window state created" signal, **not** "window mounted" and definitely not "window focused". This corrects a plausible reading of PR §2.2.
3. React renders `<EditorWindow windowId=…>` (`Root.tsx:148-156`) → `NewWindowOrIFrame` effect calls `window.open('about:blank')` (`:48`), writes a skeleton document, then attaches stylesheets/scripts and sets `loaded` (`:101-130`). Only then does the portal (and `WindowCommandsAndDialogs`) mount.
4. A separate effect calls `electronWindow.onSetWindowId(props.windowId)` (`NewWindowOrIFrame.tsx:144-150`) → preload `utils/window/secondaryWindowPreload.js:4` → `ipcMain.on('secondary-window-added')` (`ElectronAppWrapper.ts:502-505`) registers the Electron-id ↔ Joplin-id mapping.
5. When the new `webContents` gains focus, `ElectronAppWrapper.ts:428-430` → `sendWindowFocused` (`:385-390`) → `this.win_.webContents.send('window-focused', joplinId)` → `app.ts:739-748` dispatches `WINDOW_FOCUS`.

**Does it focus the new window?** Yes in practice — a newly shown `BrowserWindow` takes OS focus, and the forum thread *"Opened in new window can't be in front of main window"* (discourse #44907, Joplin 3.2.13/Win10) documents exactly the opposite failure mode: the new window **does** get focus and is then stolen back by another plugin running `focusElementSidebar`. ⚠️ **Not verified at runtime here.** There is also a theoretical gap: `sendWindowFocused` resolves the Joplin id via `windowIdFromWebContents` (`:132-147`), which returns `null` — and silently sends nothing, with no retry — if the `secondary-window-added` IPC (step 4) has not arrived yet.

### What a plugin can observe

| Signal | Fires when | Payload | Verdict for D1 |
|---|---|---|---|
| editor view `onSetup` | synchronously on `WINDOW_OPEN` (middleware) | `handle` (encodes `windowId`, see §6e) | **too early** — window does not exist yet |
| editor view `onActivationCheck` | when that window's `NoteEditor` mounts and on every note change — `useConnectToEditorPlugin.ts:79-89` → `EditorPluginHandler.emitActivationCheck({ parentWindowId, noteId })` | `{ handle, noteId }`; handle → windowId | **good "window B's editor is mounted"** signal; says nothing about focus |
| `workspace.onNoteSelectionChange` | on `WINDOW_FOCUS` (the swap replaces `state.selectedNoteIds` with a *different array object*, and `eventManager.appStateEmit` compares by reference — `eventManager.ts:213-236`) | `{ value: string[] }` — **no windowId** | **the only focus proxy**; fires even when both windows hold the same note |
| `WindowOpen` / `WindowClose` | middleware | `{ windowId }` | internal `@joplin/lib/eventManager`, **not exposed** on `joplin.workspace` (PR §2.3) |
| any "which window is focused" API | — | — | **does not exist.** `CommandService.executeInWindow` is not exposed: `JoplinCommands.execute` calls `CommandService.instance().execute(...)` (`JoplinCommands.ts:89-90`), which is `executeInWindow(name, { windowId: null, args })` (`CommandService.ts:326-328`). `joplin.window` is still only `loadChromeCssFile` / `loadNoteCssFile`. |

### Recommended sequence for D1

```
execute('openNoteInNewWindow', noteId)
  → await the next onNoteSelectionChange tick (WINDOW_FOCUS happened), with a ~1.5 s timeout
  → await one extra macrotask / short delay so the portal has mounted
  → dialogs.open(handleFromPool)
```

**Does D1 need a dummy editor registration?** Not as a *window-created* signal (`onSetup` fires too early, and `WindowOpen` is not exposed anyway). It is worth it only if you want the stronger "B's editor is mounted **with this note**" confirmation from `onActivationCheck` — register an editor whose `onActivationCheck` always returns `false` (it then never renders anything, exactly like the deprecated `editors.create`, `JoplinViewsEditor.ts:170-181`) and use the callback purely as a readiness ping, parsing `windowId` out of the handle. That costs the 3.4 version floor. **Recommended: ship without it**, and offer the manual fallback below.

**Manual fallback that needs no readiness signal at all** (and works on 2.8 today): the user opens the note in a new window themselves, then invokes the plugin *in that window*. Because B is unambiguously focused, `dialogs.open()` lands in B, deterministically. Everything the command needs already resolves per window — see §5a and §6c.

---

## 4. Two drawings at once

**One handle = one dialog, at most once.** `WebviewController` holds a single `closeResponse_` (`:71`). `setOpen(true)` first resolves any pending promise **with `null`** (`:234-237`) — so re-opening handle X while X is already open makes the first `open()` resolve `null` (not reject, not hang), and `hideBackgroundDialogsWithId` (§1c) removes X from the other window. That is the documented behaviour.

**Handles are independent.** Each handle has its own `WebviewController`, its own `closeResponse_`, and its own key in `visibleDialogs`. `hideBackgroundDialogsWithId(id)` only touches that id. ⇒ **two drawings require two handles**, and with two handles they can be open in two windows simultaneously.

Prior art for exactly this: `personalizedrefrigerator/joplin-plugin-freehand-drawing`, `src/DrawingManager.ts:19-37` (verified at `master`, 2026):

```ts
export default class DrawingManager {
	private allDialogs_: AbstractDrawingView[] = [];
	…
	private getClosedDialog_() {
		for (const view of this.allDialogs_) {
			if (!view.isOpen()) {
				return view;
			}
		}
		const newView = this.dialogFactory_();
		this.allDialogs_.push(newView);
		return newView;
	}
```

`isOpen()` is plugin-side bookkeeping (`src/dialog/AbstractDrawingView.ts:63-65`), because Joplin exposes no "is this handle open" query. Our plugin currently creates a **fresh** handle per edit (`src/index.ts:113`, `dialogs.create(\`excalidraw-dialog-${uuidv4()}\`)`), which accidentally already satisfies the two-handles rule but **leaks a controller and a redux view entry per edit, forever** — there is no `dialogs.destroy`. Switch to a pool.

### Window closed (titlebar X) while the dialog is open in it

`ElectronAppWrapper.ts:511-514` → `win.webContents.send('secondary-window-closing', windowId)` → `app.ts:750-752` dispatches `WINDOW_CLOSE` → `lib/reducer.ts:1010-1017` deletes `draft.backgroundWindows[action.windowId]`, taking that window's whole `visibleDialogs` with it.

**Nothing calls `WebviewController.setOpen(false)` or `closeWithResponse` on window close.** Consequences, all verified by absence in `WebviewController.ts` and `reducer.ts`:

- the `dialogs.open()` promise **hangs forever** — it neither resolves nor rejects;
- `view.opened` stays `true` in `pluginService` state, so `controller.visible` lies;
- the drawing's unsaved changes are **lost silently** (no `beforeunload`, and the `<dialog>` is destroyed with the document);
- with a naive pool keyed on `isOpen()`, that handle is now **permanently un-reusable**.

Mitigations: (i) autosave from inside the iframe rather than only on the Save button; (ii) track per-handle "opened at" plugin-side and treat a handle as reusable after a `WINDOW_CLOSE`-shaped event you can infer (an editor-view teardown, or a `onNoteSelectionChange` heartbeat while the promise is still pending); simplest robust option is **never reuse a handle whose promise never settled** and allocate a new one.

**D2, same question:** the editor view is torn down cleanly and silently. `JoplinViewsEditor.ts:122-134` + `:148-153`:

```ts
listenForWindowOrPluginClose(windowId, () => {
	removeController();
	removeActivationCheck();
});
```

`removeController()` → `controller.destroy()` → `PLUGIN_VIEW_REMOVE`. The plugin gets **no callback**, so D2 must autosave too (PR §2.3, §7.1 — unchanged and confirmed at v3.7.16).

---

## 5. Refresh and body conflicts

### (a) How window A learns the SVG changed — **automatically, in 3.7**

**Every resource save emits a global event.** `packages/lib/models/Resource.ts:689-690`:

```ts
const output = await super.save(resource, options);
eventManager.emit(isNew ? EventName.ResourceCreate : EventName.ResourceChange, { id: output.id });
```

This is `Resource.save`, so it covers `joplin.data.put(['resources', id], …)` — i.e. exactly what `updateDiagramResource` does (`src/resources.ts`). `eventManager` is a process-global singleton (`eventManager.ts:260`) shared by all windows.

**Every window's `useFormNote` recomputes `resourceInfos`.** `gui/NoteEditor/utils/useFormNote.ts:46-50` installs a listener on `EventName.ResourceChange`; `:373-379`:

```ts
const onResourceChange = useCallback(async (event: { id: string } = null) => {
	const resourceIds = await Note.linkedResourceIds(formNote.body);
	if (!event || resourceIds.indexOf(event.id) >= 0) {
		clearResourceCache();
		const newResourceInfos = await attachedResources(formNote.body);
		setResourceInfos(newResourceInfos);
	}
}, [formNote.body]);
```

(There is **no** `useResourceInfos.ts` at v3.7.16 — the logic lives in `useFormNote`.)

**The viewer pane** re-renders because `props.resourceInfos` is a dependency of the markup effect (`NoteBody/CodeMirror/v6/CodeMirror.tsx:217-248`), and the rendered `<img>` src carries a cache-breaker keyed on `updated_time` — `packages/renderer/utils.ts:174-190`:

```ts
const timestampParameter = `?t=${resource.updated_time}`;
```

**The CodeMirror 6 inline image decoration also refreshes — this is new and important.** `NoteBody/CodeMirror/v6/CodeMirror.tsx:252-261`:

```ts
const listener = (event: ResourceChangeEvent) => {
	editorRef.current?.onResourceChanged(event.id);
};
eventManager.on(EventName.ResourceChange, listener);
```

→ `packages/editor/CodeMirror/CodeMirrorControl.ts:245-251` dispatches `resetImageResourceEffect.of({ id })` → `packages/editor/CodeMirror/extensions/rendering/renderBlockImages.ts:276-286`:

```ts
shouldFullReRender: (transaction: Transaction) => {
	for (const effect of transaction.effects) {
		if (effect.is(resetImageResourceEffect)) {
			const key = `:/${effect.value.id}`;
			imageToRefreshCounters.set(key, (imageToRefreshCounters.get(key) ?? 0) + 1);
```

→ the widget is rebuilt with the bumped counter (`:252`) → `gui/NoteEditor/NoteBody/CodeMirror/v6/Editor.tsx:78-84`:

```ts
resolveImageSrc: async (src, reloadCounter) => {
	…
	return `${getResourceBaseUrl()}/${resourceFilename(item)}${reloadCounter ? `?r=${reloadCounter}` : ''}`;
},
```

The decoration matches markdown `Image` nodes whose src is `:/<32 hex>` — which is exactly our `![excalidraw.svg](:/<svgId>)`.

⇒ **After a save from window B, window A's editor and viewer both refresh on their own, with no plugin involvement.** Our `excalidrawRefreshImage` CodeMirror command (`src/contentScripts/codeMirror.ts`) is redundant on 3.7 for this path. Keep it (older Joplin, and it is harmless), but **do not rely on it cross-window**.

**Which window does `editor.execCommand` reach? The focused one.** `joplin.commands.execute` → `CommandService.execute` → `executeInWindow(name, { windowId: null, args })` (`CommandService.ts:326-328`) → `getRuntime(command, null)` picks the highest `getPriority` (`:309-323`). Each window's `NoteEditor` registers its own runtime (`useWindowCommandHandler.ts:86-99`) with `getWindowCommandPriority(containerRef, windowId === targetWindowId)` — and with `targetWindowId === null` that reduces to (`getWindowCommandPriority.ts:7-16`):

- `2` — this window's document has focus **and** the editor container holds `activeElement`
- `1` — this window's document has focus, but focus is elsewhere in it (e.g. inside a plugin dialog)
- `0` — this window's document does not have focus

So while the dialog is open in B, **B's editor wins at priority 1 and A's scores 0**. `editor.execCommand`, `insertText` and `selectedText` all go to B. (This is also why `editExcalidraw` invoked in window B correctly reads B's cursor line.)

### (b) New-drawing insertion while A edits the same note's body

`insertText` is an editor command (`editorCommandDeclarations.ts:45`), so per (a) it goes to **window B's** editor — correct target. Then:

- B's editor schedules a save: `Note.save(note, { changeId: \`editorChange-${props.editorId}\`, … })` (`useScheduleSaveCallbacks.ts:47`), where `editorId = \`editor-${editorIdCounter++}\`` is **per `NoteEditor` instance, i.e. per window** (`NoteEditor.tsx:82, 96-97`).
- Every window's `useFormNote` listens for `ItemChange` (`useFormNote.ts:188-211`):

  ```ts
  const listener = ({ itemId, changeId }: ChangeEventSlice) => {
      const isExternalChange = !(changeId ?? 'unknown').endsWith(editorId);
      if (itemId === noteId && !cancelled && isExternalChange) {
          if (formNoteRef.current.hasChanged) return;
          refreshFormNote();
      }
  };
  eventManager.on(EventName.ItemChange, listener);
  ```

⇒ **If window A has no unsaved edits, A reloads the note and shows B's insertion.** ⚠️ **If window A *does* have unsaved edits (`hasChanged`), the reload is skipped, and A's next save writes A's whole body — silently dropping B's inserted markdown.** This is core Joplin behaviour, not something a plugin can fix; it is last-write-wins at note-body granularity.

**Editing an EXISTING drawing touches no note body — confirmed no conflict.** `openDialog()`'s non-new branch (`src/index.ts:133-138`) only calls `updateDiagramResource` + `refreshDrawingImage`; `joplin.data.put(['resources', …])` never emits `ItemChange` for the note, so neither window's form note is disturbed and no save races. This is the path Slava actually cares about, and it is clean.

**Design consequence:** make "Edit in separate window" available for **existing** drawings only. For a *new* drawing, either insert the markdown in the main window before opening the second window, or keep new drawings on today's in-window dialog.

---

## 6. D2 mechanics

### (a) `showEditorPlugin` does **not** flip the other window

`packages/lib/commands/showEditorPlugin.ts:19-71`. It resolves the view within `context.state.windowId` only:

```ts
const activePlugins = getActivePluginEditorViews(pluginStates, windowId);
const editorPluginData = activePlugins.find(({ editorView }) => editorView.id === editorViewId);
```

and `getActivePluginEditorViews.ts:14` hard-filters on the window:

```ts
if (view.parentWindowId !== windowId || !view.active) continue;
```

The visibility flip is `await controller.setOpen(show)` (`:71`) on **that one view's controller** — for `ContainerType.Editor` that is just `setStoreProp('opened', …)` (`WebviewController.ts:221, 256-258`), which is per-view and therefore per-window.

The global setting write at `:69`:

```ts
Setting.setValue('plugins.shownEditorViewIds', getUpdatedShownViewIds());
```

is read in **exactly one place** — `JoplinViewsEditor.ts:92`, inside `initializeController`, i.e. once when a view is created:

```ts
void controller.setOpen(Setting.value('plugins.shownEditorViewIds').includes(editorTypeId));
```

There is no live subscription. ⇒ **Window A's already-created view is not touched.** The setting only affects windows opened *later*. (This softens PR §2.4: the "every new window shows it too" half is right; the "main window flips" half is wrong for existing windows.)

And if A's activation check returns `false`, A's view has `active === false`, so `getShownPluginEditorView` returns `null` (`getActivePluginEditorViews.ts:14` + `getShownPluginEditorView.ts:5-9`) → `usePluginEditorView` yields no `editorPlugin` → `builtInEditorVisible = !editorPlugin` is `true` (`NoteEditor.tsx:123-124`) → **A stays on Markdown.** ✅

### (b) What an active editor view replaces

`NoteEditor.tsx:817-849`. The editor row is:

```tsx
<div style={{ display: 'flex', flex: 1, paddingLeft: theme.editorPaddingLeft, maxHeight: '100%', minHeight: '0' }}>
    {editor}
    {renderPluginEditor()}
</div>
```

with `editor = null` whenever `builtInEditorVisible` is false (`:569-596`). So the plugin view replaces **the built-in editor *and* its viewer pane *and* the editor toolbar** (the markdown toolbar lives inside `CodeMirror6`, at `NoteBody/CodeMirror/v6/CodeMirror.tsx:425-433`).

It does **not** replace: `NoteTitleBar` (title + `NoteToolbar`) above, `StatusBar` and `WarningBanner` below, or the search bar row (`NoteEditor.tsx:823-846`).

Size: `renderPluginEditor()` mounts `<UserWebview … fitToContent={false}>` (`:742-751`), and `services/plugins/styles/plugin-user-webview.scss:2-7` gives `.plugin-user-webview` `width:100%; height:100%; border:none; padding:0; margin:0`. ⇒ full editor-pane size. In a **secondary** window the layout is only `editor` + a hidden `chatPanel` (`EditorWindow.tsx:45-54`) — no sidebar, no note list — so that pane is nearly the whole window.

### (c) Getting back to Markdown

`toggleEditorPlugin` (`packages/lib/commands/toggleEditorPlugin.ts`), surfaced as the eye button in the **note toolbar**, which stays visible because `NoteTitleBar` is not replaced: `gui/NoteToolbar/NoteToolbar.tsx:54, 66-69`:

```ts
const { editorPlugin } = getActivePluginEditorView(state.pluginService.plugins, ownProps.windowId);
…
if (editorPlugin || windowState.activeNoteIsWhiteboard) commands.push('toggleEditorPlugin');
```

`NoteTitleBar.tsx:5, 108-135` renders it. The command is per-window (`context.state.windowId`, `:19`), and on hide it dispatches `EDITOR_NOTE_NEEDS_RELOAD` (`:62-64`) so the markdown editor picks up data-API changes.

### (d) `<iframe>` + relative URLs + `postMessage`

`UserWebview.tsx:127-145` is shared by **dialogs, panels and editors alike** — same host page, same rules:

```ts
const path = toForwardSlashes(getAssetPath('services/plugins/UserWebviewIndex.html'));
if (isolate) { return `joplin-content://plugin-webview/${path}`; } else { return `file://${path}`; }
```

⇒ the base dir is **Joplin's app directory, not the plugin's**. So relative URLs in `setHtml` do **not** resolve against the plugin install dir — which is exactly why `src/index.ts:116` already builds an absolute path from `joplin.plugins.installationDir()`. **The same trick works verbatim in an editor view.** (`WebviewController.addScript` *does* resolve against the plugin base dir: `WebviewController.ts:142-145`.)

`editors.postMessage(handle, msg)` after `onSetup`: **works per window**, despite an alarming-looking line. `WebviewController.postMessage` (`:156-170`) hardcodes `windowId: defaultWindowId`, but `PostMessageService.postMessage` short-circuits Plugin→UserWebview to `viewMessageHandler` (`PostMessageService.ts:80-83`), whose lookup key ignores the window entirely (`:104-113`):

```ts
const viewMessageHandler = this.viewMessageHandlers_[[ResponderComponentType.UserWebview, message.viewId].join(':')];
```

and `viewId` is the per-window handle. ✅ (View→plugin *responses* do use `windowId`, supplied correctly by the webview — `UserWebview.tsx:105-113`, `PostMessageService.ts:115-139`.)

⚠️ Moving to `postMessage` would also fix the latent `featureFlag.plugins.isolatePluginWebViews` bug in `src/local-excalidraw/index.ts:11-12` (PR §7.5) — with isolation on, the host page is served from `joplin-content://` and `window.parent.document` throws.

### (e) Per-window activation for the same note — confirmed

`JoplinViewsEditor.ts:136-137` — one handle per window, **with the window id baked into it**:

```ts
const handle = createViewHandle(this.plugin, `${viewId}-${windowId}`);
```

(`createViewHandle.ts:5-7` → `plugin-view-${plugin.id}-${id}`, so the handle literally ends with `-window-<noteId>-<n>`; the plugin can parse the windowId out.)

`:224-231`:

```ts
const isActive = async ({ windowId, effectiveNoteId }: ActivationCheckSlice) => {
	const isCorrectWindow = windowId === this.controller(handle).parentWindowId;
	const active = isCorrectWindow && await callback({ handle, noteId: effectiveNoteId });
```

and the emitter fills in the window: `EditorPluginHandler.ts:85-100` builds `{ effectiveNoteId: noteId, windowId: parentWindowId }` and only calls `controller.setActive()` when `controller.parentWindowId === parentWindowId`. The caller is `useConnectToEditorPlugin.ts:79-89`, which runs in each window's `NoteEditor` with `windowId = useContext(WindowIdContext)`.

⇒ **For the same note, the plugin can return `true` for window B's handle and `false` for window A's.** `ActivationCheckEvent` is `{ handle, noteId }` (`api/types.ts:407-411`) — the window is *only* recoverable from the handle string. That is the mechanism D2 depends on, and it works.

---

## 7. Prior art for D1

| Finding | Source | Verdict |
|---|---|---|
| A plugin dialog **does** open in a secondary Joplin window, and one handle's `open()` closes its copies elsewhere | freehand-drawing `CHANGELOG.md` §2.17.0 | ✅ direct confirmation of §1 |
| Dialog pool so two drawings can be open at once | freehand-drawing `src/DrawingManager.ts:19-37` (`getClosedDialog_`), `src/dialog/AbstractDrawingView.ts:63-65` | ✅ the pattern to copy |
| "For now, avoid having the same drawing open in multiple different windows" | freehand-drawing `CHANGELOG.md` §2.8.0 | ⚠️ the same caveat applies to us |
| Editor plugin state leaking across windows (kanban in a second window forced back to Markdown by the main window) | `laurent22/joplin#11379` — *"Multi-windows support: Conflict when an editor plugin is open in one window"*, opened 2024-11-11 by laurent22, labels bug/desktop/medium, **still open** | ⚠️ predates per-window `register` (#12041, 3.4); the code read in §6a says it should be fixed, but the issue was never closed |
| New window loses focus to the main window | forum [#44907](https://discourse.joplinapp.org/t/opened-in-new-window-cant-be-in-front-of-main-window/44907) (Joplin 3.2.13, Win10) — caused by another plugin running `focusElementSidebar` | ⚠️ exactly D1's focus race, triggered by a third party |
| A plugin that calls `openNoteInNewWindow` **and then opens a dialog** | GitHub code search `"openNoteInNewWindow" NOT repo:laurent22/joplin language:TypeScript` → 80 hits; only **one** real Joplin plugin in the top 20 (`benlau/joplin-plugin-kanmug`, `src/actions.ts:70-75`, an action type only), the rest unrelated Electron note apps and Joplin forks | ❌ **none found** |
| A Joplin issue/PR titled "plugin dialog opens in wrong window", or the PR that made dialogs per-window | `repo:laurent22/joplin plugin dialog window in:title` → 0 results; `"editor plugin" window` → 68 issues, none about dialog window targeting | ❌ **none found**; per-window dialog rendering appears to have arrived silently with the multi-window work (#11181) rather than as a named fix |

So: **D1 is novel as a one-click flow, but every mechanism it relies on is proven**, and the pool pattern has shipped in a sibling plugin for over a year.

---

## 8. Comparison

Requirements: **(N1)** the main window's note editor stays usable while the drawing is open elsewhere; **(N2)** two drawings open at once; **(N3)** drawings stay embedded in ordinary notes.

| | **D1 — dialog in a 2nd note window** | **D2 — editor view in a 2nd note window** | **D3 — raw `window.open`** |
|---|---|---|---|
| **N1 note + drawing simultaneously** | ✅ B holds a modal dialog, A is a separate document and stays fully editable (§2). B's *own* editor is blocked — acceptable, A is the one being edited. | ✅ and better: B's Excalidraw is not modal at all; B could even toggle back to markdown. | ✅ fully independent OS window. |
| **N2 two drawings at once** | ✅ two handles, two windows (§4). Two in the *same* window also technically works (stacked `<dialog>`s) but is ugly. | ✅ one view per window ⇒ two windows = two drawings. Two in one window: ❌ (`getShownPluginEditorView` returns `[0]`). | ✅ n windows. |
| **N3 embedded model** | ✅ **untouched** | ❌ **note-scoped by construction** — forces "drawing notes" (PR §4b). Embedded drawings in mixed notes cannot activate an editor view. | ✅ untouched |
| Save/refresh in the other window | ✅ free (§5a) | ✅ free | ✅ free |
| Window closed with unsaved work | ⚠️ promise hangs, changes lost, handle burned (§4) | ⚠️ view torn down silently, changes lost (§4, PR §2.3) | ⚠️ same; freehand has no `beforeunload` (PR §9.1) |
| Main risk | **focus race** — `open()` may land in window A (§3) | **data model change**; plus #11379 never formally closed | **unsupported hole** in Joplin's window policy; hand-rolled webview host |
| Min Joplin | **3.2** (`openNoteInNewWindow`); **2.8** for the manual variant | **3.4** (per-window `register`); 3.4.2 in practice (PR §2.6) | ~3.3 |
| Mobile | ❌ desktop-only | ✅ 3.3+ | ❌ |
| Effort | **S–M — ~4-6 h** (command + pool + readiness + full-window CSS) | **L — ~20-30 h** (3rd bundle, postMessage protocol, autosave, drawing-note UX, manifest/API refresh) | **L — ~20 h** (~170-line host shim + Excalidraw wiring) |
| Verdict | ✅ **recommended** | fallback / separate "drawing note" feature | last resort |

---

## 9. Recommendation

**Implement D1.** It is the only candidate that satisfies all three non-negotiables, it needs no data-model change, no new bundle and no new message protocol, and Joplin's own refresh machinery does the cross-window update for free. Effort is **S–M (~4-6 hours)** against D2's L.

Ship it in two layers so the risky half is optional:

1. **Layer 1 (no timing, works on 2.8):** the full-window dialog CSS (PR §6) + the existing commands, which already resolve per window. Document "open the note in a new window, then click Edit there". This alone delivers Slava's requirement.
2. **Layer 2 (the one click, 3.2+):** a new `editExcalidrawInNewWindow` command that chains `openNoteInNewWindow` → readiness wait → `dialogs.open()`.

---

## 10. Implementation outline for D1

### Commands

| Name | Label | Where |
|---|---|---|
| `editExcalidrawInNewWindow` | "Edit Excalidraw drawing in a new window" | Tools ▸ Excalidraw submenu (`src/index.ts:298-301`) + editor context menu (`src/index.ts:305-313`), next to the existing entries. **No toolbar button** (freehand keeps its new-window command palette-only — `CHANGELOG.md` §2.8.0 — for good reason; ours can be a menu item). |

Guard it: `enabledCondition` / a runtime check for `oneNoteSelected`, and feature-detect `openNoteInNewWindow` the way `lim0513/joplin-explorer` does (PR §9.3) — `try { execute('openNoteInNewWindow', id) } catch { /* fall back to the in-window dialog */ }`.

### Plugin-side sequence

```ts
// 1. Resolve the drawing in the CURRENT window (reuses findExcalidrawForEditing()).
const svgResourceId = await findExcalidrawForEditing();      // src/index.ts:181-199
if (!svgResourceId) return;
if (openDrawings.has(svgResourceId)) { /* already open — focus/warn, do not open twice */ return; }

// 2. Remember which note, then open it in a second window.
const note = await joplin.workspace.selectedNote();
await joplin.commands.execute('openNoteInNewWindow', note.id);

// 3. Wait for the focus swap. onNoteSelectionChange fires on WINDOW_FOCUS
//    (eventManager.ts:213-236 compares selectedNoteIds by reference).
await waitForNextNoteSelectionChange({ timeoutMs: 1500 });
await new Promise(r => setTimeout(r, 150));   // let the portal mount

// 4. Open the dialog — it lands in whichever window is focused NOW.
openDrawings.add(svgResourceId);
try   { await openDialogOnHandle(await pool.acquire(), svgResourceId); }
finally { openDrawings.delete(svgResourceId); pool.release(handle); }
```

`waitForNextNoteSelectionChange` = register one `joplin.workspace.onNoteSelectionChange` listener at `onStart`, keep a module-level list of one-shot waiters, resolve them on each event. **Never register a fresh listener per call** — `JoplinWorkspace.onNoteSelectionChange:82-96` returns an empty `{}` Disposable and only unregisters on plugin unload, so per-call registration leaks (see `laurent22/joplin#14919`, "Plugin API callback registry memory leak").

### Handle pool (replaces `dialogs.create(uuid)` per edit)

`src/index.ts:113` currently mints a new handle every time. There is no `dialogs.destroy`, so each edit permanently adds a `WebviewController` + a redux view entry. Port freehand's shape:

```ts
class DialogPool {
  private handles: { handle: string; busy: boolean }[] = [];
  async acquire() {
    const free = this.handles.find(h => !h.busy);
    if (free) { free.busy = true; return free.handle; }
    const handle = await joplin.views.dialogs.create(`excalidraw-dialog-${this.handles.length}`);
    this.handles.push({ handle, busy: true });
    return handle;
  }
  release(handle: string) { /* mark not busy */ }
  burn(handle: string)    { /* promise never settled: never reuse (§4) */ }
}
```

`setHtml` / `setButtons` / `setFitToContent` are re-applied on every acquire (they are per-handle store props, so reuse is safe).

### Files to touch

| File | Change |
|---|---|
| `src/index.ts` | new command + menu/context entries; `DialogPool`; one-shot `onNoteSelectionChange` waiter; `openDrawings` set keyed by svg resource id; refactor `openDialog()` to take a handle |
| `src/excalidraw.css` | **the full-window CSS is not yet there** (checked: 34 lines, no `.user-webview-dialog` rule). Add PR §6 verbatim, scoped via `iframe[id*="com.joplin.excalidraw-v2"]`. Already wired through `loadChromeCssFile` at `src/index.ts:209` — and `loadChromeCssFile` applies to **all** windows (`StyleSheetContainer` is rendered in `EditorWindow.tsx:156` too), so the second window gets it for free. |
| `src/manifest.json` | leave `app_min_version: "2.8"`; feature-detect `openNoteInNewWindow` at runtime instead of raising the floor |
| `src/contentScripts/codeMirror.ts` | no change needed; optionally note that `excalidrawRefreshImage` is redundant on 3.7 (§5a) |
| `src/local-excalidraw/index.ts` | **optional but recommended**: a debounced autosave (reuse the existing `scheduleSvg` shape at `:112-127`) so a titlebar close does not lose everything (§4). Requires a plugin↔iframe channel — either keep the hidden-form channel and have the plugin poll, or (better) move to `webviewApi.postMessage`, which also fixes the `isolatePluginWebViews` bug (§6d). |

### Edge cases

| Case | Handling |
|---|---|
| **Window closed with unsaved changes** | The `open()` promise hangs and changes are lost (§4). Mitigate with autosave; `burn()` that handle; wrap the `await` so the `openDrawings` entry is cleared by a watchdog rather than only in `finally`. |
| **Same drawing opened twice** | Refuse up front via `openDrawings: Set<svgResourceId>` (cheaper and clearer than freehand's "avoid it" caveat). Without this, two Excalidraw instances autosave the same pair of resources — last write wins, silently. |
| **Focus race — dialog lands in window A** | The realistic failure. There is no API to detect it (§3). Mitigations: (i) the wait above; (ii) make the *manual* flow first-class and documented, so a user who hits it has a deterministic path; (iii) optionally a setting "Open in new window: automatic / manual". |
| **Refresh in the other window** | Free (§5a). Nothing to do. Verify visually that the CM6 widget refresh (`?r=` counter) actually fires for our `![excalidraw.svg](:/id)` line — the regex is `:\/[a-zA-Z0-9]{32}` in the **HTML** branch (`renderBlockImages.ts:179`) while ours is a markdown `Image` node (`:235-238`), which has no such length constraint. |
| **New drawing insertion** | `insertText` reaches the focused window's editor (§5a) — which is B, correct. But if A has unsaved edits in the same note, A will later overwrite B's insertion (§5b). **Restrict "Edit in separate window" to existing drawings**; keep `addExcalidraw` in-window. |
| **Full-window CSS** | `100vh` may clip the Save/Close bar; `calc(100vh - 2.5rem)` is the safe `--content-height` (PR §6). Our Save button is load-bearing — the click interception at `src/local-excalidraw/index.ts:139-162` matches on the parent "Save" button — so override `--content-width`/`--content-height` rather than absolutely positioning the iframe the way freehand does. |
| **`showMessageBox` from the new-window path** | It blocks every window synchronously (§2). `findExcalidrawForEditing()` calls it; that runs *before* the new window opens, so it is fine — just do not add any further message boxes after step 2. |

### If D1 hits its main risk (the dialog opens in the wrong window)

**Fall back to the manual two-step, not to D2.** Demote `editExcalidrawInNewWindow` to "Open this note in a new window" (a plain `openNoteInNewWindow` passthrough) and tell the user to click Excalidraw in that window — which is deterministic because *they* own the focus. That keeps 100 % of the user-visible value (note + drawing side by side, two drawings at once, embedded model) and costs one extra click. It is also a strictly smaller change than what Layer 2 adds, so the fallback is just "delete the readiness wait".

Only if the *dialog itself* turns out to be unusable in a secondary window (it should not be — §1, §2, and freehand's CHANGELOG all say otherwise) does D2 become relevant, and then it is a separate, opt-in "drawing note" feature as laid out in PR §5, not a replacement for the embedded model.

---

## 11. Could not verify

- **Runtime focus behaviour after `openNoteInNewWindow`** — whether `WINDOW_FOCUS` reliably reaches redux before a plugin's next microtask, and whether the `secondary-window-added` ↔ `webContents 'focus'` ordering in `ElectronAppWrapper.ts:385-390, 428-430, 502-505` ever drops the first focus event. Read from source + one corroborating forum thread only. **This is D1's single unverified load-bearing assumption.**
- Whether the CM6 block-image widget actually re-renders our specific `![excalidraw.svg](:/id)` line on `ResourceChange` (source says yes; needs a running Joplin).
- Whether `100vh` clips the dialog button bar (inherited from PR §8).
- Whether `laurent22/joplin#11379` is in fact fixed by per-window `register` — the code says it should be, the issue is still open.
- Two `<dialog>`s stacked in one window: standards say both go in the top layer; not tested in Electron.
- GitHub code search covers public repos only, and its `NOT repo:` results were sampled at 20 of 80 hits — the "no plugin combines `openNoteInNewWindow` with a dialog" claim is strong but not exhaustive.
