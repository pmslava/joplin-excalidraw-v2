# Excalidraw upgrade research — joplin-plugin-excalidraw

Research date: **2026-09-11**. Repo: `/home/mrsir/Lab/joplin-plugin-excalidraw`, branch `excalidraw-0.18-theme-editor-menu`.

## TL;DR

**There is no Excalidraw version gap to close.** `@excalidraw/excalidraw@0.18.1` (published 2026-04-20, released 2026-04-21) is still `dist-tags.latest`, and the repo already pins exactly that. 0.18.1 is a *security-only* patch. Nothing has shipped since.

What *has* happened is that `master` has accumulated ~17 months of unreleased work, published continuously on the `next` tag as `0.18.0-<sha>` (latest `0.18.0-afa3a65`, 2026-09-10 — yesterday). The CHANGELOG's `## Unreleased` section is large and contains several breaking changes that **will** hit this plugin when the next stable (presumably 0.19.0) lands. There is no `0.19` milestone on the repo, so no date is knowable.

So the actual work available today is **toolchain modernization + an automation harness**, not an Excalidraw bump. The Excalidraw part is "be ready", not "upgrade".

---

# 1. Version gap

## 1.1 Releases after 0.18.1

**None.**

Source: `curl https://registry.npmjs.org/@excalidraw%2Fexcalidraw` (fetched 2026-09-11).

```
dist-tags: {
  "latest":  "0.18.1",
  "next":    "0.18.0-afa3a65",
  "rc":      "0.18.0-rc.7",
  "preview": "0.18.0-a9e2d2348-preview-2",
  "patch":   "0.17.1", "patch-0.16": "0.16.4", "patch-v-0.10": "0.10.1",
  "test":    "0.5.0-a78d45417"
}
```

Complete list of stable releases from 0.18.0 onward (from the registry `time` map):

| Version | Published |
|---|---|
| 0.18.0 | 2025-03-10T20:50:46Z |
| **0.18.1** | **2026-04-20T20:24:36Z** (GitHub release `v0.18.1`, 2026-04-21T08:43:20Z) |

Registry `time.modified` = 2026-09-10T14:55:15Z (that is the `next` publish, not a stable release).

### What 0.18.1 actually was

GitHub release body (https://api.github.com/repos/excalidraw/excalidraw/releases/tags/v0.18.1):

> Security patch release for `@excalidraw/excalidraw@0.18.x`, addressing upstream Mermaid XSS vulnerability CVE-2025-54881 / GHSA-7rqq-prvp-x9jh.
> - Backports Mermaid XSS mitigation by updating `@excalidraw/mermaid-to-excalidraw` to `2.2.2`
> - Pins `@types/d3-dispatch` for compatibility with the 0.18.x TypeScript version

The CHANGELOG has **no `## 0.18.1` heading at all** — it jumps straight from `## Unreleased` to `## 0.18.0 (2025-03-11)`. The patch is documented only in the GitHub release. Good news for us: we're already on the patched version.

### The `next` channel

`@excalidraw/excalidraw@next` is a nightly-ish build of `master`, versioned `0.18.0-<git sha>` (note: `0.18.0`, not `0.19.0` — semver-wise these sort *below* 0.18.1, so `npm i @excalidraw/excalidraw@next` is a **downgrade** as far as any range check is concerned; it must be pinned exactly). ~40 such builds were published between 0.18.1 and today. Latest: `0.18.0-afa3a65` (2026-09-10), matching master commit `afa3a65 feat(editor): sticky notes (#12064)`.

Master commit activity is high (5 most recent, 2026-09-07 → 2026-09-10, all feature work). Open milestones on the repo: `UX Priorities`, `@excalidraw/excalidraw@0.18.0` (0 open), `@excalidraw/excalidraw@0.17.0`. **No 0.19 milestone exists** — mark any predicted release date as unverified/unknowable.

## 1.2 Breaking changes in `## Unreleased` (i.e. what the next stable will bring)

Source: https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/CHANGELOG.md, lines 14–227, fetched 2026-09-11.

### B1 — `excalidrawAPI` prop renamed to `onExcalidrawAPI` ⚠️ **hits us**

> Renamed the `excalidrawAPI` prop to `onExcalidrawAPI`.
> `onExcalidrawAPI` is now called on mount (instead of during constructor), and later on unmount (with `null` value). The API may be removed altogether in the future (you can use `onMount` & `onUnmount` …).

Confirmed in the next build's types (`dist/types/excalidraw/types.d.ts`, `ExcalidrawProps`): `onExcalidrawAPI?: (api: ExcalidrawImperativeAPI | null) => void;` — `excalidrawAPI` is gone.

### B2 — `MainMenu.DefaultItems.ToggleTheme` / theme control reworked ⚠️ **touches us**

- `ToggleTheme` no longer accepts the item-level `onSelect` callback. Hosts controlling theme must pass `onThemeChange` to `<Excalidraw />`.
- `ToggleTheme` with system-theme support now uses `allowSystemTheme` together with `theme={Theme | "system"}` **only to render the selected value**. For the plain light/dark item, pass `allowSystemTheme={false}`.
- `CommandPalette.defaultItems.toggleTheme` removed.
- `UIOptions.canvasActions.toggleTheme`: when `null` it now defaults to `true` if `props.theme` is omitted **or** `props.onThemeChange` is supplied, and otherwise defaults to disabled.

### B3 — `ExcalidrawAPI.scrollToContent()` replaced by `setViewport()` (PR #11554)

`scrollToContent(target?, opts?)` → `setViewport(opts | null)`. `target` is now required; `fitToContent`/`fitToViewport` → `fit: "scale-down" | "contain" | "none"`; `animate`/`duration` → `animation: boolean | {duration?}`; `canvasOffsets` → `offsets`; `viewportZoomFactor`/`minZoom`/`maxZoom` removed. Also `zoomToFitBounds` takes `fit` and no longer rounds zoom to 10% steps unless `steppedZoom: true`. New `initialState={{ viewport }}` prop takes precedence over `initialData.scrollToContent`.

*We don't call `scrollToContent` — no impact, but note `initialData.scrollToContent` is now superseded.*

### B4 — `UIAppState` slimmed down

`UIAppState` no longer includes `zoom`, `shouldCacheIgnoreZoom`, `snapLines`, `originSnapOffset`, `suggestedBinding`, `frameToHighlight`, `elementsToHighlight`. UI render props (`renderCustomStats`, custom `<Footer/>`) no longer receive them. Replacement: `useExcalidrawStateValue(selector)` / `ExcalidrawAPI.onStateChange(...)`.

*We render no custom UI that reads `UIAppState` — no impact.*

### B5 — Tool system & toolbar rework (PR #11649) — DOM/CSS breaking

- `setActiveTool(tool, keepSelection?)` → `setActiveTool(tool, { keepSelection?, toggle? })`.
- Toolbar buttons are now real `<button aria-pressed>` instead of `<label>`-wrapped hidden radio/checkbox inputs. **Class names `.ToolIcon_type_radio`, `.ToolIcon_type_checkbox`, `.ToolIcon--selected` no longer exist**; pressed state is `.ToolIcon--checked` + `aria-pressed`.
- `<Sidebar.Trigger>` renders a `<button>` instead of `<label>` + checkbox.
- Removed internal actions: `toggleHandTool`, `toggleEraserTool`, `toggleLassoTool`, `setFrameAsActiveTool`, `setEmbeddableAsActiveTool`.
- Behaviour: hand/eraser are toggle tools; clicking the active selection tool switches to lasso on all platforms; tool switching no longer creates undo entries; `Ctrl+E` no longer toggles eraser.

*Relevant to us only as CSS drift — see §2.*

### B6 — `@excalidraw/common` / `@excalidraw/element` surface

- `updateActiveTool` (from `@excalidraw/common`): `lastActiveToolBeforeEraser` → `lastActiveTool`.
- `getClosestElementBounds` no longer exported from `@excalidraw/element`.

*We import neither.*

### B7 — Packaging: the monorepo split is now visible in deps

Comparing `package.json` of `0.18.1` vs `0.18.0-afa3a65`:

- 0.18.1 deps include `fractional-indexing`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`.
- next deps instead include `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, the unified `radix-ui` package, and `@codemirror/{commands,language,state,view}` + `@lezer/highlight` (new in-app code editor).
- next `exports` gains type subpaths: `"./common/*"`, `"./element/*"`, `"./math/*"`, `"./utils/*"`.

**The parts we depend on did not change**: `main`/`module` are still `./dist/prod/index.js`, `exports["."]` is unchanged, and `exports["./index.css"]` still resolves to `./dist/prod/index.css`. No ESM/CJS change. The package is ESM-only in both (UMD was already dropped in 0.18.0).

## 1.3 Things that explicitly did **not** change (verified)

These are the ones the brief asked about; all confirmed stable between 0.18.1 and master:

| Concern | Status | Evidence |
|---|---|---|
| **React peer range** | Unchanged: `"react": "^17.0.2 \|\| ^18.2.0 \|\| ^19.0.0"`, same for `react-dom` | registry `versions["0.18.1"]` and `versions["0.18.0-afa3a65"]`.peerDependencies |
| **ESM/CJS packaging** | Unchanged (ESM only; UMD deprecated back in 0.18.0 via #7441/#9127) | `exports` maps identical for `"."` |
| **`index.css` path** | Unchanged — `@excalidraw/excalidraw/index.css` still exported | `exports["./index.css"]` present in both |
| **`EXCALIDRAW_ASSET_PATH`** | Unchanged. No mention anywhere in the Unreleased section (grep count 0) | CHANGELOG lines 360–442 are all 0.18.0-era |
| **Fonts directory layout** | Unchanged — `dist/prod/fonts/<Family>/*.woff2`, **234 files, same 9 families** (Assistant, Cascadia, ComicShanns, Excalifont, Liberation, Lilita, Nunito, Virgil, Xiaolai) in both 0.18.1 and `0.18.0-afa3a65` | jsdelivr flat file listings for both versions |
| **`exportToSvg` signature** | **Byte-identical option set**: `{elements, appState, files, exportPadding?, renderEmbeddables?, exportingFrame?, skipInliningFonts?: true, reuseImages?}` | `dist/types/utils/export.d.ts` (0.18.1) vs `dist/types/utils/src/export.d.ts` (next) |
| **`exportToBlob`** | Unchanged: `ExportOpts & {mimeType?, quality?, exportPadding?}` | same files |
| **`exportWithDarkMode`** | Still an `appState` flag, untouched | no CHANGELOG mention |
| **`serializeAsJSON`** | Unchanged: `(elements, appState, files, type: "local" \| "database")` | `packages/excalidraw/data/json.ts` on master |
| **theme dropped on export** | **Still dropped.** `master/packages/excalidraw/appState.ts:163` → `theme: { browser: true, export: false, server: false }`, and `"local"` still routes through `cleanAppStateForExport` | master source |
| **`restore`/`restoreElements`** | Still exported (`restoreAppState, restoreElement, restoreElements, restoreLibraryItems`) | next `dist/types/excalidraw/index.d.ts:25` |
| **`initialData`** | Still supported (`initialData?: (() => MaybePromise<...>) \| MaybePromise<...>`) | next `types.d.ts` `ExcalidrawProps` |
| **`langCode`** | Still present | next `types.d.ts` |
| **`MainMenu`, `Footer`, `WelcomeScreen`** | All still exported | next `index.d.ts:38,39,42` |
| **`UIOptions`** | Still present; only the `canvasActions.toggleTheme` default logic changed (B2) | CHANGELOG |

## 1.4 New features worth surfacing to users (all in `Unreleased`, not yet stable)

- **Sticky notes** (2026-09-06, master `afa3a65`): new `stickynote` element type + toolbar tool (`N`). Auto-fitting label (font shrinks before the note grows), `baseHeight`/`baseFontSize` on the model, its own colour domain (`currentItemStickynoteStrokeColor` / `...BackgroundColor`, new `colorTopPicks` slots), a creation-date footer band rendered on canvas *and in SVG/PNG exports*, `convertToExcalidrawElements([{type:"stickynote",…}])` skeleton support.
- **Drag tools out of the toolbar** onto the canvas to place an element where you release (generic mechanism; sticky note opts in first).
- **Toolbar badges now show letter shortcuts** (`R`, `T`, `N`, …) instead of numbers; on desktop/tablet the image tool moved into "More tools".
- **Element creation timestamps** (`element.created`, master `854d00c`, 2026-09-08).
- **Device-pixel snapping** for element bitmaps, scroll and grid (master `6574de6`, 2026-09-09) — sharper rendering.
- **Viewport locking / `setViewport`** with scroll+zoom locks and rubberband overscroll (`DEFAULT_OVERSCROLL` = 150px).
- **`interaction` prop** (`false` or `{enabled:{navigation,links,embeds,interactiveContent,browserZoom}}`) — a genuinely inert read-only editor. **Directly interesting for a Joplin viewer-side preview** if we ever want an interactive (pan/zoom) render in the note viewer instead of a flat SVG.
- **`ui` prop** (`false` or `{enabled:{zoom,scrollBackToContent}}`) — hide the whole default UI but keep canvas + host children (`MainMenu`, `Footer`). Also interesting for a chromeless preview.
- **`activeTool` prop** — host-controlled/forced tool.
- **Lifecycle props**: `onMount`, `onInitialize`, `onUnmount`, plus `api.onEvent("editor:mount"|"editor:initialize"|"editor:unmount")` and `ExcalidrawAPI.isDestroyed`.
- **React hooks exported**: `ExcalidrawAPIProvider`, `useExcalidrawAPI()`, `useExcalidrawStateValue()`, `useOnExcalidrawStateChange()`.
- **`onExport`** — host can delay JSON export until async work completes, with an async-generator progress protocol.
- **`ownerDocument` prop** — mount Excalidraw into an iframe document from a parent window. *Not needed by us (we mount inside the iframe), but it's the sanctioned pattern if the architecture ever changes.*
- **`onThemeChange` / `onDuplicate` / `onIncrement`** props.
- **CodeMirror-based in-app editor** (new `@codemirror/*` deps) — likely the diagram-to-code / Mermaid surface.
- Already in 0.18.0 (so we have them and should double-check they're exposed in our stripped-down menu): elbow arrows, lasso select, image cropping, laser pointer, font families (Excalifont/Nunito/Comic Shanns/Lilita/Cascadia), text containers, frames, Mermaid import.

---

# 2. Impact on our code

The **only** change needed to track the *current stable* is: **nothing**. Everything below is preparation for the next stable release.

## 2.1 Breaking changes → exact lines

| # | Change | File:line | Required edit | Risk |
|---|---|---|---|---|
| B1 | `excalidrawAPI` → `onExcalidrawAPI` | `src/local-excalidraw/index.ts:172` — `excalidrawAPI: (api: any) => { apiRef.current = api; },` | Rename the prop. Also guard for the new `null` on unmount: `(api) => { apiRef.current = api; }` is already null-safe, but every `apiRef.current` consumer (lines 79–81, 94–97) should keep its `if (!api) return` early exit — it already does. Consider adding `api?.isDestroyed` checks. | **Low** — one-word rename. This is the single hard blocker for the next major. |
| B1 | API now delivered on *mount*, not constructor | same | `readInitialData()` runs at module scope (line 70) so `initialData` is unaffected. The parent-click Save interceptor (lines 139–162) reads `apiRef.current` lazily → fine. | Low |
| B2 | `ToggleTheme` item-level `onSelect` removed | `src/local-excalidraw/index.ts:177` — `React.createElement(ExcalidrawLib.MainMenu.DefaultItems.ToggleTheme)` | **No change needed** — we pass no props. But add `allowSystemTheme={false}` explicitly to keep the plain light/dark item once the new semantics land. | Low |
| B2 | `UIOptions.canvasActions.toggleTheme` default logic | `src/local-excalidraw/index.ts:170–173` — we pass **no** `theme` prop and **no** `UIOptions` | Under the new rule ("defaults to `true` if `props.theme` is omitted"), the toggle stays enabled. **No change.** Do *not* start passing `theme` without also passing `onThemeChange`, or the toggle would silently disable. | Low but worth a comment |
| B2 | `onThemeChange` is the new host hook | `src/local-excalidraw/index.ts:82–89` (`writeJson` reads `api.getAppState().theme`) | Our approach (read theme off appState at serialize time) still works and is simpler. Optional: switch to `onThemeChange` for an immediate write. | None |
| B5 | Toolbar DOM/class rework | `src/local-excalidraw/style.css:21–23` (`.excalidraw .App-menu_top .buttonList`) and **:31–36** (`:root[dir="ltr"] .excalidraw .layer-ui__wrapper .zen-mode-transition.App-menu_bottom--transition-left`) | These target *internal* Excalidraw class names. PR #11649 rewrote the toolbar; these selectors are likely dead or wrong after the next release. They also don't reference the specifically-removed `.ToolIcon_type_*` classes, so nothing *breaks* — they just stop matching. **Recommend deleting both rules** (they look like leftovers from the upstream example app, not deliberate styling). | Low |
| — | Dead CSS | `src/local-excalidraw/style.css:13–19` (`.button-wrapper button`) and **:38–45** (`button.excalidraw-render-svg`) | No `.button-wrapper` or `.excalidraw-render-svg` element exists in `index.ts` or `index.html`. Dead. Delete. | None |

## 2.2 Things that stay exactly as they are (verified against master)

| Our code | Why it's safe |
|---|---|
| `src/local-excalidraw/index.ts:5` `import "@excalidraw/excalidraw/index.css"` | `exports["./index.css"]` unchanged in the next build |
| `src/local-excalidraw/index.html:11` `window.EXCALIDRAW_ASSET_PATH = new URL("..", document.location.href).href` | Asset-path contract untouched; absolute base still required |
| `webpack.config.js:174–182` CopyPlugin `dist/prod/fonts` → `dist/fonts` | Source layout identical (234 files, 9 families) in 0.18.1 and master |
| `src/local-excalidraw/index.ts:82–84` `serializeAsJSON(els, appState, files, "local")` | Signature unchanged on master |
| `src/local-excalidraw/index.ts:87–89` theme re-injection | Still required — `appState.ts:163` still has `theme: {export: false}` |
| `src/local-excalidraw/index.ts:98–108` `exportToSvg({elements, appState:{…exportBackground, exportWithDarkMode}, files})` | Option set byte-identical on master |
| `src/local-excalidraw/index.ts:171` `initialData: InitialData` | Still supported |
| `src/local-excalidraw/index.ts:176` `MainMenu` + `DefaultItems.ChangeCanvasBackground` | Still exported |

## 2.3 Deprecated APIs already in our code

| Location | Issue |
|---|---|
| `src/local-excalidraw/index.ts:3,185` — `import * as ReactDOM from "react-dom"` + `ReactDOM.render(...)` | **Legacy React 17 API.** Deprecated-with-warning in React 18, **removed in React 19**. Must become `createRoot` from `react-dom/client` before any React bump. This is the one real deprecation in the codebase. |
| `src/index.ts:209` — `await (joplin as any).window.loadChromeCssFile(...)` | The `as any` is unnecessary: `api/Joplin.d.ts:40` declares `get window(): JoplinWindow` and `api/JoplinWindow.d.ts:16` declares `loadChromeCssFile(filePath: string): Promise<void>`. Drop the cast for type safety. |
| `package.json:23` `copy-webpack-plugin ^6.1.0` | webpack-4-era. v14 is current (needs Node ≥ 20.9). The generator-joplin scaffold uses ^11. |
| `package.json:27` `on-build-webpack ^0.1.0` | Unmaintained webpack-4-only plugin. The current generator scaffold no longer uses it (it calls the compiler hook directly). Drops out for free with the scaffold migration. |
| `package.json:30` `react-hot-toast ^2.4.1` | Not imported anywhere in `src/` (grep). Dead dependency. |
| `src/webview/` + `vite-webview.config.ts` + `package.json:5` `dist:webview` | Dead (never registered; confirmed by grep — the only "webview" hits outside `src/webview/` are comments and a URL). It's still built on every `npm run dist` and its output is packed into the `.jpl`. Deleting it removes a whole Vite build from the pipeline and shrinks the plugin. |

## 2.4 Vite config impact (see §3.2)

`vite-local.config.ts:16` `rollupOptions` → must become `rolldownOptions` **only if** going to Vite 8. `vite-local.config.ts:7–11` `optimizeDeps.esbuildOptions` → deprecated in Vite 8 in favour of `optimizeDeps.rolldownOptions` (auto-converted for back-compat). Both are fine through Vite 7.

---

# 3. Toolchain modernization

## 3.1 Current vs available (all versions fetched from npm 2026-09-11)

| Tool | Ours | Current | Node requirement of current | Node 26 OK? |
|---|---|---|---|---|
| `@excalidraw/excalidraw` | 0.18.1 | **0.18.1** | — | ✅ already current |
| `vite` | 2.6.14 (pinned) | **8.3.0** (2026-09-10); `previous` tag = 7.3.6 | v7 & v8: `^20.19.0 \|\| >=22.12.0` | ✅ |
| `react` / `react-dom` | ^17.0.2 | **19.3.0** (2026-09-09) | — | ✅ |
| `typescript` | ^5.3.3 | 5.9.3 / 6.0.3 / **7.0.2** (latest) | — | ✅ |
| `webpack` | ^4.43.0 | **5.110.3** (2026-09-01) | `>=10.13.0` | ✅ |
| `webpack-cli` | ^3.3.11 | 4.x in scaffold | — | ✅ |
| `ts-loader` | ^7.0.5 | **9.6.2** (peer: webpack ^4 \|\| ^5) | — | ✅ |
| `copy-webpack-plugin` | ^6.1.0 | **14.0.0** (`node >= 20.9.0`); scaffold uses ^11 | — | ✅ |
| `generator-joplin` | old scaffold (argv-style `--joplin-plugin-config`) | **3.7.2** (2026-06-16) | `engines: {npm: ">= 4.0.0"}` (no node floor) | ✅ |
| Node (local) | **v26.8.1**, npm 12.0.2 | — | — | — |
| Node (CI) | 22 (`.github/workflows/build-release.yaml`) | — | — | — |

Local sanity check: `node --openssl-legacy-provider -e '…'` → **accepted on Node 26.8.1**, so the current webpack-4 build still has its escape hatch. (`node_modules` is currently absent in this repo, so an actual `npm run dist` was not executed — an end-to-end build is unverified.)

## 3.2 Vite 2.6.14 → 7 (recommended) or 8

**Recommend Vite 7 (7.3.6), not Vite 8.** Vite 8.3.0 shipped on 2026-09-10 (one day ago) and is a wholesale engine replacement: **Rolldown replaces Rollup and Oxc replaces esbuild**, `build.rollupOptions` → `build.rolldownOptions`, `optimizeDeps.esbuildOptions` deprecated, CSS minification moves to Lightning CSS, CJS default-import interop semantics change, object-form `manualChunks` removed. Excalidraw's bundle is large and uses workers (`subset-worker.chunk.js`, `subset-shared.chunk.js`) — exactly the kind of thing a bundler swap disturbs. Let Vite 8 mature; revisit in a few months. (https://vite.dev/guide/migration)

**Vite 7 breaking changes that touch us** (https://v7.vite.dev/guide/migration):
- Node ≥ 20.19 / 22.12 — Node 26 fine; **CI must move off nothing** (already on 22, which satisfies 22.12 only if the runner resolves ≥22.12 — pin `node-version: 22.12` or `24`/`26` to be safe).
- Default target is `'baseline-widely-available'` — irrelevant, we set `build.target: "esnext"` explicitly (`vite-local.config.ts:13`).
- `splitVendorChunkPlugin` removed — not used.
- Sass legacy API removed — Excalidraw ships `sass` as a dep but consumes prebuilt CSS; we import `index.css`, not `.scss`. Should be fine, **unverified**.
- `transformIndexHtml` hook `enforce`/`transform` → `order`/`handler` — we use no plugins at all.

**Why this migration is unusually cheap for us:** `src/local-excalidraw/index.ts` is a `.ts` file using `React.createElement` throughout — **no JSX**, therefore **no `@vitejs/plugin-react`**, no Babel/SWC, no Fast Refresh. The config is 24 lines with zero plugins. The 2→7 jump skips the entire plugin-ecosystem churn that normally makes this painful.

Points to verify during the bump:
1. `__dirname` at `vite-local.config.ts:5,15`. Vite's config loader bundles the TS config and injects `__dirname`/`__filename`/`import.meta.url` defines, so this normally keeps working even with ESM output. **Verify with a build**; if it trips, the fix is one line: `const __dirname = fileURLToPath(new URL('.', import.meta.url))`.
2. `entryFileNames: "[name].js"` / `assetFileNames: "[name].[ext]"` (lines 18–19) — these flat names are what `index.html` and the plugin's iframe `src` depend on. Confirm the emitted files are still `index.js` / `index.css` and not hashed.
3. `base: './'` (line 6) — required, since the iframe is loaded from a `file://`-ish Joplin dialog path. Confirm no absolute `/assets/...` URLs appear in the built HTML.
4. Whether Excalidraw's font-subsetting worker chunks (`subset-worker.chunk.js`, `subset-shared.chunk.js`) are emitted next to `index.js`. Under Vite 2 these presumably got inlined/copied; a newer Rollup worker pipeline may place them elsewhere. **This is the highest-risk unknown in the Vite bump** and is exactly what the SVG-font smoke test (§4.3) would catch.

## 3.3 React 17 → 19

Excalidraw's peer range is `^17.0.2 || ^18.2.0 || ^19.0.0` in **both** 0.18.1 and master, so 17 stays supported indefinitely — this is optional, not forced.

Two options:
- **React 18** — `ReactDOM.render` still works (with a deprecation warning); `createRoot` recommended. Half a migration.
- **React 19 (19.3.0)** — `ReactDOM.render` is **removed**; `createRoot` is mandatory.

Since the edit is the same either way, go straight to **19**:

```ts
// src/local-excalidraw/index.ts:3
import { createRoot } from "react-dom/client";
// :185
createRoot(document.getElementById("app")!).render(React.createElement(App));
```

Do **not** wrap in `<React.StrictMode>` — the double-mount would fire `onExcalidrawAPI` twice and re-run the parent-document click listener setup; there's no benefit here.

Also add `@types/react` / `@types/react-dom` (currently absent — the code leans on `any` via `React.useRef<any>`), which would let `apiRef` be properly typed.

## 3.4 Plugin build: webpack 4 + old scaffold → generator-joplin 3.7.2

### What the target looks like

`generator-joplin@3.7.2` (2026-06-16) template `package_TEMPLATE.json`:

```json
"scripts": {
  "dist": "webpack --env joplin-plugin-config=buildMain && webpack --env joplin-plugin-config=buildExtraScripts && webpack --env joplin-plugin-config=createArchive",
  "prepare": "npm run dist",
  "updateVersion": "webpack --env joplin-plugin-config=updateVersion",
  "update": "npm install -g generator-joplin && yo joplin --node-package-manager npm --update --force"
},
"devDependencies": {
  "@types/node": "^18.7.13", "chalk": "^4.1.0", "copy-webpack-plugin": "^11.0.0",
  "fs-extra": "^10.1.0", "glob": "^8.0.3", "tar": "^6.1.11", "ts-loader": "^9.3.1",
  "typescript": "^4.8.2", "webpack": "^5.74.0", "webpack-cli": "^4.10.0"
}
```

Both sibling repos (`/home/mrsir/Lab/joplin-plugin-cockpit`, `/home/mrsir/Lab/joplin-plugin-whereabouts`) already run exactly this shape. Concrete deltas from our current setup:

| | Ours (old scaffold) | Target (3.7.2) |
|---|---|---|
| CLI arg | `webpack --joplin-plugin-config buildMain` (parsed via `yargs(process.argv)`) | `webpack --env joplin-plugin-config=buildMain`; config exports `module.exports = (env) => …` |
| webpack | 4 + `NODE_OPTIONS=--openssl-legacy-provider` | 5, **no flag** |
| Archive hook | `on-build-webpack` (unmaintained) | direct compiler hook — dependency disappears |
| Category list | hard-coded array in `webpack.config.js` | `require('@joplin/lib/pluginCategories.json')` (needs `@joplin/lib: ~2.9` devDep, as in both siblings) |
| Version bump | manual | `npm run updateVersion` bumps `package.json` **and** `src/manifest.json` together, warns if they diverge |
| Screenshots | n/a | manifest screenshot validation |
| Node builtins | polyfilled by default (wp4) | `builtinModules` set to `false` explicitly |
| `tsconfig.json` | `{compilerOptions}` only, no `include`/`exclude` | siblings add `"include": ["src","api"]` + `"exclude": [...]` — **worth copying**, it stops `tsc` walking `dist/`, `publish/`, `node_modules/` |

### `yo joplin --update` vs fresh scaffold

**Use `yo joplin --update`, not a fresh scaffold.** Reasons:

1. `--update` explicitly "merges the changes in package.json and .gitignore instead of overwriting" and "leaves `/src` as well as README.md untouched" (GENERATOR_DOC.md). Our entire value is in `src/`.
2. It *does* overwrite `webpack.config.js` — which is exactly what we want, since our only customisation there is the 8-line Excalidraw-fonts `CopyPlugin` block (`webpack.config.js:174–182`). That is trivially reapplied; better, extract it to a small `webpack.excalidraw.js` and `require()` it, as GENERATOR_DOC recommends, so the *next* update is a no-op.
3. It also refreshes `api/*.d.ts`. Ours is behind: missing `JoplinImaging.d.ts`, `JoplinViewsNoteList.d.ts`, `noteListType.d.ts`, `noteListType.ts` compared with cockpit. (We *do* already have `JoplinWindow.d.ts` — `loadChromeCssFile` is typed, so `src/index.ts:209`'s `as any` is removable.)

Command (matching what cockpit uses): `npm install -g generator-joplin && yo joplin --node-package-manager npm --update --force`.

**Caveat:** this repo currently uses **yarn** (`yarn.lock`, and CI does `yarn install --frozen-lockfile`) while both sibling repos use **npm** (`package-lock.json`, `npm ci`). The generator's `--node-package-manager npm` flag implies a package-manager switch. Decide deliberately: either pass `--node-package-manager yarn` and keep `yarn.lock`, or switch to npm for consistency with the siblings (which also means updating `build-release.yaml`'s `cache: 'yarn'` / `yarn install --frozen-lockfile`). Recommend **switching to npm** — one fewer difference across the four plugins, and it matches the scaffold's default.

### TypeScript

The scaffold pins `typescript ^4.8.2`; we're on `^5.3.3`. **Keep 5.x** — bump to `5.9.3` (last 5.x, 2025-09-30) and pin it. TS 6.0.3 and especially TS 7.0.2 (the native/Go rewrite) are a separate, unrelated risk; `ts-loader@9.6.2`'s peer is `typescript: "*"` so it won't complain, but that is not the same as being tested. Do not combine a TS-major jump with this migration.

## 3.5 Order that minimises risk

Each step must leave a working `npm run dist` and a manually verified plugin. Rationale for the order: **change one axis at a time**, and do the reversible/deletable things first.

0. **Prune dead code** — delete `src/webview/`, `vite-webview.config.ts`, the `dist:webview` script, `react-hot-toast`, and the four dead CSS rules. Nothing else changes. Immediately shrinks the surface every later step has to carry.
1. **Add the safety net first** — CI build-on-PR already exists; add the headless smoke test (§4.3) *before* touching any dependency. Without it, every later step is verified by hand.
2. **Plugin build: webpack 4 → generator-joplin 3.7.2.** Touches `webpack.config.js`, `package.json`, `api/`, `tsconfig.json` — **not** `src/local-excalidraw/`. Drops the `--openssl-legacy-provider` hack and the `on-build-webpack` dependency. Independent of Vite/React/Excalidraw.
3. **Vite 2 → 7.** Touches only `vite-local.config.ts` and the iframe build output. Independent of step 2.
4. **React 17 → 19 + `createRoot` + `@types/react`.** Touches `src/local-excalidraw/index.ts:3,185`. Do it *after* Vite so that if the iframe breaks you know which change did it.
5. **TypeScript → 5.9.3.**
6. **Excalidraw: stay on 0.18.1.** Optionally open a spike branch pinning `@excalidraw/excalidraw@0.18.0-afa3a65` to exercise B1/B2 early and measure the bundle delta — but do **not** ship a `0.18.0-<sha>` build (it sorts below 0.18.1 semver-wise and is unversioned nightly code).

Node 26 works for every step. Steps 2–5 all *improve* Node-26 compatibility (they remove the OpenSSL legacy shim). The only Node constraint introduced is Vite 7's `^20.19.0 || >=22.12.0`, which means the CI workflow's `node-version: '22'` should be pinned to `22.12`+ (or bumped to `24`).

---

# 4. "Regular update" process

## 4.1 Dependency automation: Renovate

**Recommend Renovate over Dependabot.** Dependabot cannot express "group `@excalidraw/*` into one PR AND hold majors AND run monthly" as cleanly; Renovate's `packageRules` + `schedule` do all three in one file, and it handles the `yarn.lock`/`package-lock.json` either way.

Proposed `renovate.json` at the repo root:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard"],
  "schedule": ["before 6am on the first day of the month"],
  "timezone": "Europe/Belgrade",
  "prConcurrentLimit": 3,
  "labels": ["dependencies"],
  "packageRules": [
    {
      "description": "Excalidraw moves as one unit; never auto-take a major.",
      "matchPackagePatterns": ["^@excalidraw/"],
      "groupName": "excalidraw",
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": false
    },
    {
      "description": "Excalidraw pre-1.0: 0.x MINORS are its breaking changes. Dashboard only.",
      "matchPackagePatterns": ["^@excalidraw/"],
      "matchUpdateTypes": ["major", "minor"],
      "dependencyDashboardApproval": true
    },
    {
      "description": "Build toolchain: group, but hold majors for a human.",
      "matchPackageNames": ["vite", "webpack", "webpack-cli", "ts-loader", "typescript", "copy-webpack-plugin"],
      "groupName": "build toolchain",
      "matchUpdateTypes": ["minor", "patch"]
    },
    {
      "matchPackageNames": ["react", "react-dom", "@types/react", "@types/react-dom"],
      "groupName": "react"
    },
    {
      "description": "Majors never auto-merge anywhere.",
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    },
    {
      "description": "Low-risk dev churn can merge itself once CI is green.",
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchManagers": ["github-actions"],
      "groupName": "github actions",
      "schedule": ["before 6am on the first day of every 3rd month"]
    }
  ]
}
```

Key subtlety for this project: **Excalidraw is pre-1.0, so its `0.MINOR` bumps are the breaking ones** (0.17→0.18 dropped UMD and moved the fonts directory). Hence minors are held behind dashboard approval too, not just majors. Patches (0.18.1-style security fixes) flow through as PRs — which is exactly what we'd have wanted on 2026-04-20.

Also keep `@excalidraw/excalidraw` **pinned exactly** (`"0.18.1"`, as it is today, not `^0.18.1`) so Renovate PRs are explicit and the `dist/fonts` copy always matches the installed bundle.

Renovate needs the GitHub App enabled on `pmslava/joplin-excalidraw-v2`. If that's undesirable, the Dependabot fallback is `.github/dependabot.yml` with `schedule: {interval: monthly}`, `groups: {excalidraw: {patterns: ["@excalidraw/*"]}}`, and `ignore: [{dependency-name: "@excalidraw/*", update-types: ["version-update:semver-major","version-update:semver-minor"]}]` — functional, but no dependency dashboard and clumsier grouping.

## 4.2 CI on PR — what exists and what's missing

`.github/workflows/build-release.yaml` already runs on `pull_request: [opened, synchronize]`: checkout → Node 22 (yarn cache) → `yarn install --frozen-lockfile` → `npm run dist` → upload `publish/` as an artifact. On `push` to `main` it additionally cuts a GitHub release from `package.json`'s version (skipping if the tag exists) and `npm publish`es.

That's a solid base. Gaps:

1. **No test step at all.** A green PR only proves the bundle compiles.
2. **`node-version: '22'`** resolves to the latest 22.x today, which satisfies Vite 7 — but pin `22.12` or move to `24` once Vite 7 lands, so a runner image change can't silently break it.
3. **No bundle-size guard.** Excalidraw is the dominant cost of the `.jpl`; a bad Vite config that stops chunking or starts inlining fonts would sail through.
4. **No `npm ci`/`yarn --frozen-lockfile` drift check** beyond the frozen flag (fine as-is).
5. The release job publishes to npm on every `main` push where the version tag doesn't exist — safe, but means a Renovate automerge to `main` with a bumped version would auto-publish. With `automerge` limited to devDependency patches (which don't bump the plugin version) this is fine; keep it that way.

Add a `tests` job mirroring cockpit's `.github/workflows/tests.yml` shape (`harness` fast job → `e2e` slow job gated on it).

## 4.3 The headless smoke test

Three tiers; **implement tier 1 + 2 now**, treat tier 3 as optional.

### Tier 1 — build + bundle-size assertion (S, cheap, catches most regressions)

A `test/smoke.js` run after `npm run dist`, asserting:

- `dist/local-excalidraw/index.html` and `index.js` exist (catches the `entryFileNames` regression from a Vite bump).
- `dist/local-excalidraw/index.html` contains **no absolute `/assets/`** URLs (catches a `base` regression).
- `dist/fonts/Excalifont/` exists and the total font count matches the source: `node_modules/@excalidraw/excalidraw/dist/prod/fonts` → **234 files** today (catches an upstream fonts-layout move, which is precisely what 0.18.0 did).
- `dist/index.js`, `dist/contentScripts/markdownIt.js`, `dist/contentScripts/codeMirror.js`, `dist/contentScripts/markdownIt-content.js` (copied verbatim, must stay plain JS) all exist.
- `publish/com.joplin.excalidraw-v2.jpl` exists and its size is within, say, ±25% of a checked-in baseline. Fail loudly on a large swing in either direction — a sudden *shrink* usually means the fonts stopped being copied.

### Tier 2 — real SVG export in a headless browser (M, the valuable one)

The brief's suggestion — "load the built iframe app, create a scene with text, call `exportToSvg`, assert the SVG contains the embedded font and expected text" — is the right test, but **jsdom won't do it**: Excalidraw needs canvas 2D, `ResizeObserver`, `FontFace`, and a Worker for font subsetting. Use **Playwright + Chromium** against the *built* `dist/local-excalidraw/index.html` over `file://` (which also exercises the `EXCALIDRAW_ASSET_PATH` / `new URL("..", …)` logic in its real, awkward setting):

```
1. page.goto('file://<repo>/dist/local-excalidraw/index.html')
   — but the app reads hidden inputs from window.parent.document, so serve a
     tiny harness page that iframes it and provides
     #excalidraw_diagram_json / #excalidraw_diagram_svg / #excalidraw_theme /
     #excalidraw_preserve_theme, plus a <button>Save</button>.
2. Seed #excalidraw_diagram_json with a one-text-element scene
   ({type:"text", text:"hello excalidraw", fontFamily:5 /* Excalifont */, ...}).
3. Wait for the canvas to mount, then click the harness "Save" button —
   this exercises the real click-interception path at index.ts:139-162.
4. Read #excalidraw_diagram_svg and assert:
     a. it contains "hello excalidraw"
     b. it contains "@font-face" and "data:font/woff2;base64" (fonts inlined —
        exportToSvg's default; regresses if skipInliningFonts or the asset path
        breaks)
     c. it contains "Excalifont"
     d. no console errors were logged
5. Theme round-trip: set #excalidraw_theme='dark', reload, Save, assert the
   SVG carries the dark-mode filter AND that the JSON written back to
   #excalidraw_diagram_json has appState.theme === 'dark' (guards the
   re-injection at index.ts:87-89 against upstream changing
   cleanAppStateForExport).
6. Preserve-theme off: #excalidraw_preserve_theme='false' + a saved-dark scene
   + #excalidraw_theme='light' → assert the reopened theme is light.
```

Steps 4b and 5 are the two assertions that would have caught every 0.18 quirk listed in the brief. Run headless in CI with `npx playwright install --with-deps chromium`; ~1–2 minutes. Playwright 1.63.0 requires Node ≥ 20.

### Tier 3 — real-Joplin E2E (L, optional)

Both sibling repos already do this: `scripts/setup-e2e.sh` downloads and `--appimage-extract`s a pinned Joplin AppImage into `.e2e-cache/`, and Playwright drives the actual Electron app under `xvfb-run`, with a machine-wide lock (`e2e/guard.ts`) so only one Joplin run exists across sibling repos, an AppImage cache key in CI, and `always()`-uploaded traces. That infrastructure is **directly transplantable** and would let a test verify "insert drawing → Save → image appears in the viewer → Edit reopens it → in-place refresh updates the `<img>`". Worth doing eventually, but tier 2 covers the Excalidraw-upgrade risk at a fraction of the cost; tier 3 covers the *Joplin-integration* risk, which nothing in an Excalidraw bump threatens.

## 4.4 Keeping `dist/fonts` in sync — already solved

**`webpack.config.js:174–182` already does this automatically.** It is not a manual copy:

```js
new CopyPlugin({
  patterns: [{
    from: path.resolve(__dirname, "node_modules/@excalidraw/excalidraw/dist/prod/fonts"),
    to:   path.resolve(__dirname, "dist/fonts")
  }]
})
```

So a Renovate bump of `@excalidraw/excalidraw` automatically re-copies the matching fonts on the next `npm run dist`. Nothing to change. Two hardening notes:

- **Carry this block through the generator-joplin migration.** `yo joplin --update` overwrites `webpack.config.js`. Extract it to `webpack.excalidraw.js` exporting the plugin instance, and `require()` it from the regenerated config — one line to restore after each future scaffold update, as GENERATOR_DOC.md advises.
- **Assert it in the smoke test** (tier 1, the 234-file count). If upstream ever moves the fonts directory again — exactly what 0.18.0 did with `excalidraw-assets` → `dist/prod/fonts` — the copy silently produces an empty `dist/fonts` and only the SVG export would notice at runtime.

## 4.5 Manual verification checklist (for the human, per Excalidraw bump)

Run in a real Joplin desktop, in **both** light and dark Joplin themes:

**Editor basics**
- [ ] Insert → new drawing: the Excalidraw canvas mounts with no console errors in the dialog.
- [ ] **Text tool**: type text; the hand-drawn font (Excalifont) renders *on canvas*, not a fallback sans.
- [ ] Draw a rectangle + arrow; bind the arrow to the shape.
- [ ] Menu shows exactly the two items we register: Toggle theme, Change canvas background.

**Persistence + export**
- [ ] Save → the note gets `![excalidraw.svg](:/<id>)` and the image renders in the viewer.
- [ ] Open the saved `.svg` resource: it contains the text, **and** an `@font-face` block with a base64 `woff2` (hand font is embedded, not referenced).
- [ ] SVG background is present (`exportBackground: true`) — not transparent.

**Theme round-trip**
- [ ] New drawing in Joplin light → opens light; in Joplin dark → opens dark.
- [ ] Toggle theme inside the editor to dark, Save, reopen → **reopens dark** (the `appState.theme` re-injection at `index.ts:87–89` still works).
- [ ] The exported dark SVG is actually dark (invert filter applied), matching the canvas.
- [ ] Settings → "Theme for new drawings" = Light/Dark/Follow Joplin each behave.
- [ ] Settings → "Keep each drawing's saved theme" **off**: an existing dark drawing reopens in the configured new-drawing theme.
- [ ] Joplin "auto-detect theme" on → the fallback luminance sniffing (`index.ts:27–39`) still picks the right side.

**Editing existing drawings**
- [ ] Cursor on a drawing's line → "Edit Excalidraw drawing" opens *that* drawing.
- [ ] Selection containing a drawing → same.
- [ ] Note with exactly one drawing, cursor elsewhere → opens it.
- [ ] Note with several drawings, cursor elsewhere → shows the "put the cursor on the line" message.
- [ ] Note with none → shows the "no drawing found" message.

**In-place refresh**
- [ ] Edit an existing drawing, Save → the `<img>` in the Markdown editor updates immediately (cachebreaker via `excalidrawRefreshImage`), no reopen needed.
- [ ] Same in the Markdown viewer pane.

**Rich Text editor**
- [ ] Drawing renders in the RTE.
- [ ] The **Edit** button appears and works (CSP-safe asset path — `markdownIt-content.js` via `addEventListener`, no inline `on*`).
- [ ] No CSP violations in the RTE webview console.

**v1 → v2 conversion**
- [ ] A legacy `![excalidraw](excalidraw://<id>)` shows the logo placeholder.
- [ ] "Convert to v2" produces a working v2 drawing.

**Regression sweep**
- [ ] Save with an unsaved in-flight change: the click interception (`index.ts:139–162`) still finishes the async SVG export before the dialog closes — no stale SVG.
- [ ] `.jpl` size is in the expected range.

---

# 5. Effort estimate and recommended sequence

| # | Step | Size | Hours | Blocks | Notes |
|---|---|---|---|---|---|
| 0 | Prune dead code (`src/webview/`, `vite-webview.config.ts`, `dist:webview`, `react-hot-toast`, dead CSS at `style.css:13–19,21–23,31–36,38–45`), drop the needless `as any` at `src/index.ts:209` | **S** | 1 | — | Pure deletion. Removes an entire Vite build from `npm run dist`. |
| 1 | Smoke test tier 1 (build + size + fonts-count assertions) + wire a `tests` job into CI; pin `node-version` | **S** | 2 | — | Do before any dependency change. |
| 2 | Smoke test tier 2 (Playwright + Chromium, harness page, SVG/font/theme assertions) | **M** | 5–7 | 1 | The harness page that fakes the Joplin dialog's hidden inputs is the bulk of it. Highest value per hour of anything here. |
| 3 | Renovate config + enable the app | **S** | 1 | — | Independent; can land any time. |
| 4 | webpack 4 → generator-joplin 3.7.2 (`yo joplin --update`), extract the fonts `CopyPlugin` into `webpack.excalidraw.js`, refresh `api/`, add `include`/`exclude` to `tsconfig.json`, decide yarn→npm and update `build-release.yaml` accordingly | **M** | 4–6 | 1 | Drops `--openssl-legacy-provider` and `on-build-webpack`. Doesn't touch `src/local-excalidraw/`. The yarn→npm switch is the fiddly part. |
| 5 | Vite 2.6.14 → 7.3.6 | **M** | 3–5 | 1, 2 | Config is 24 lines with no plugins and no JSX, so this is far cheaper than a typical 2→7 jump. Budget most of it for the worker-chunk / font-subsetting question (§3.2 point 4). |
| 6 | React 17 → 19 + `createRoot` + `@types/react`/`@types/react-dom` | **S/M** | 2–3 | 5 | Two lines of source, plus typing `apiRef` properly now that `any` isn't forced. |
| 7 | TypeScript 5.3 → 5.9.3 | **S** | 1 | 4 | Stay on 5.x. Do **not** jump to 6 or 7 in this pass. |
| 8 | Spike branch on `@excalidraw/excalidraw@0.18.0-afa3a65` to exercise B1/B2 and measure the bundle delta | **M** | 3–4 | 2, 5 | **Do not ship.** Throwaway branch; its purpose is to have the B1/B2 patch written and tested before the real 0.19 lands. |
| 9 | Real 0.19 upgrade when it ships: rename `excalidrawAPI` → `onExcalidrawAPI`, add `allowSystemTheme={false}`, re-check CSS, re-run the full manual checklist | **S/M** | 2–4 | 8 | Small *if* 8 was done. **Unknown timing — no 0.19 milestone exists.** |
| | Smoke test tier 3 (real-Joplin Playwright E2E, transplanted from cockpit) | **L** | 10–14 | 2 | Optional. Covers Joplin-integration risk, not Excalidraw-upgrade risk. |

**Total for steps 0–7 (everything actionable today): ~18–26 hours.**

## Recommended sequence

```
0 → 1 → 3 → 2 → 4 → 5 → 6 → 7      (then 8, and 9 whenever 0.19 lands)
```

Reasoning:
- **0 first** — deleting the dead webview shrinks what every later step must carry, and it's the only change with zero risk.
- **1 before anything else that moves a version.** Tier-1 assertions are cheap and would catch a silent `dist/fonts` regression, which is the failure mode with the worst blast radius (the plugin still builds, still loads, and only the exported SVG's fonts are wrong).
- **3 early** — Renovate starts producing PRs immediately, and those PRs will exercise the CI you just strengthened.
- **2 before 4/5** — the Playwright test is the thing that makes the toolchain migrations verifiable rather than hopeful.
- **4 before 5** because the plugin build and the iframe build are independent; doing the plugin side first gets you off webpack 4 and the OpenSSL shim while the iframe is still known-good.
- **6 after 5** so a broken iframe can be attributed to exactly one change.
- **8 deliberately last and off the release path** — it's rehearsal, not delivery.

## Honest assessment

The headline is that **the Excalidraw upgrade everyone expected isn't there.** The dependency is current, and it's current on a security patch. The genuine debt in this repo is webpack 4 (needing an OpenSSL escape hatch on Node 26), Vite 2 (four years stale), React 17 (`ReactDOM.render` is a dead API), a dead `src/webview/` build shipping in every `.jpl`, and — most consequentially — **no automated test whatsoever** on a plugin whose correctness lives in subtle interactions (async SVG export racing a dialog close; theme surviving a serializer that deliberately strips it; fonts resolved through a runtime-computed absolute asset path). Steps 1 and 2 are worth more than all the version bumps combined, and they're what makes step 9 a routine afternoon rather than an archaeology session.

---

## Sources

- npm registry: `https://registry.npmjs.org/@excalidraw%2Fexcalidraw` (fetched 2026-09-11) — dist-tags, `time`, per-version `peerDependencies`/`exports`
- npm registry: `generator-joplin` (3.7.2, 2026-06-16), `vite` (8.3.0, 2026-09-10; 7.3.6), `react` (19.3.0), `typescript` (5.9.3 / 6.0.3 / 7.0.2), `webpack` (5.110.3), `ts-loader` (9.6.2), `copy-webpack-plugin` (14.0.0), `@playwright/test` (1.63.0), `vitest` (5.0.0), `jsdom` (30.0.1)
- `https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/CHANGELOG.md` (155 KB, fetched 2026-09-11) — `## Unreleased` = lines 14–227
- `https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/json.ts` and `.../appState.ts` — `serializeAsJSON` and `theme: {export:false}`
- `https://api.github.com/repos/excalidraw/excalidraw/releases/tags/v0.18.1`, `.../releases?per_page=5`, `.../milestones?state=open`, `.../commits?per_page=5`
- jsdelivr data API flat file listings for `@excalidraw/excalidraw@0.18.1` and `@0.18.0-afa3a65`; type files `dist/types/excalidraw/index.d.ts`, `dist/types/excalidraw/types.d.ts`, `dist/types/utils/export.d.ts`
- `https://cdn.jsdelivr.net/npm/generator-joplin@3.7.2/generators/app/templates/package_TEMPLATE.json`
- `https://vite.dev/guide/migration` (v8), `https://v7.vite.dev/guide/migration` (v7)
- Local: `/home/mrsir/Lab/joplin-plugin-cockpit` and `/home/mrsir/Lab/joplin-plugin-whereabouts` (`package.json`, `webpack.config.js`, `tsconfig.json`, `playwright.config.ts`, `scripts/setup-e2e.sh`, `.github/workflows/tests.yml`)

### Unverified / assumptions

- **No end-to-end build was run** — `node_modules` is absent in this repo and installing would have modified the working tree. Every claim about *our* build is from reading configs, not from executing them.
- Vite's config loader injecting `__dirname` into bundled TS configs is stated from knowledge of its behaviour, not verified against Vite 7's source.
- Whether Excalidraw's `subset-worker.chunk.js` / `subset-shared.chunk.js` survive a Vite 7 build correctly is **unknown** and is the main risk in that step.
- The next stable being numbered **0.19.0** is an assumption; there is no milestone and no announcement.
- Excalidraw's `sass` dependency is assumed not to reach us (we import prebuilt `index.css`), relevant to Vite 7's Sass legacy-API removal.
- Hour estimates assume familiarity with this codebase and no unexpected upstream breakage.
