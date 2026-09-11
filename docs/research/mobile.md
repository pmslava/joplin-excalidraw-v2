# Excalidraw on Joplin mobile — feasibility research

Date: 2026-09-11. All Joplin source citations are from `laurent22/joplin` branch `dev`
(tree `94084f36`, fetched 2026-09-11) unless stated otherwise.
Local plugin: `/home/mrsir/Lab/joplin-plugin-excalidraw` @ `excalidraw-0.18-theme-editor-menu`.

**Bottom line up front: the June 2026 conclusion was correct and is still correct in
September 2026.** A Joplin mobile plugin cannot create or update a resource, because
the only resource-creating API requires a *file path* and mobile plugins have no way to
write a file. Everything else (dialogs, webviews, content scripts, the `:/id` markdown,
reading resources) works on mobile. The blocker is one narrow, well-identified hole in
the plugin API, and the realistic path forward is to get that hole closed upstream.

---

## 1. Latest mobile version and the mobile plugin API surface

### Version

| Item | Value | Evidence |
| --- | --- | --- |
| Latest Joplin Android release | **3.7.8**, published 2026-09-05 | `laurent22/joplin-android` releases (GitHub API); previous: 3.6.22 (2026-08-20), 3.6.21, 3.6.20, 3.6.18, 3.5.8, 3.4.6, 3.3.11 |
| Mobile plugin support landed | Joplin mobile **3.3.x** (the freehand-drawing plugin pins `app_min_version: 3.3.0`); mobile plugin support was announced in the forum thread *Mobile: Plugin support* | see §3 |

### Manifest fields (authoritative)

`readme/api/references/plugin_manifest.md`:

```
`app_min_version`        | string | Yes | Minimum version of Joplin that the plugin is compatible with.
`app_min_version_mobile` | string | No  | Minimum version of Joplin on mobile platforms, if different from `app_min_version`
`platforms`              | string[] | No | List of platforms supported by the plugin. For example, `["desktop", "mobile"]`.
...
## Platforms
A list that can contain `"desktop"` and/or `"mobile"`. If not given, it defaults to `[ "desktop" ]` for most plugins.
```

`readme/api/references/mobile_plugin_debugging.md` confirms the gate:

> If you encounter an "incompatible with Joplin mobile" error, be sure that
> `"platforms": ["mobile", "desktop"]` is included in your plugin's `manifest.json`

Our `src/manifest.json` currently has **no** `platforms` field → desktop-only by default,
and `app_min_version: "2.8"`.

### Runtime detection

`packages/lib/services/plugins/api/types.ts:232-238`

```ts
export interface VersionInfo {
	version: string;
	profileVersion: number;
	syncVersion: number;

	platform: 'desktop'|'mobile';
}
```

`packages/app-mobile/services/plugins/PlatformImplementation.ts:30-37`

```ts
public get versionInfo(): VersionInfo {
	return {
		version: shim.appVersion(),
		syncVersion: Setting.value('syncVersion'),
		profileVersion: reg.db().version(),
		platform: 'mobile',
	};
}
```

So `(await joplin.versionInfo()).platform === 'mobile'` is a **verified** runtime switch.

### API-by-API mobile support

Method: in the plugin API sources, a `<span class="platform-desktop">desktop</span>` tag
marks desktop-only classes/methods; untagged = cross-platform. Cross-checked against the
mobile `PlatformImplementation` and the mobile plugin runtime.

| API | Mobile? | Evidence |
| --- | --- | --- |
| `joplin.data` (get/post/put/delete, `resourcePath`, userData) | **Yes** | `JoplinData.ts` — no platform tag |
| `joplin.data.post(['resources'], …, [{path}])` | **Yes, but unusable** — needs a real file path | §2 |
| `joplin.settings` (sections, settings, `globalValue`) | **Yes** | `JoplinSettings.ts` — no platform tag. Caveat: `SettingItemSubType.FilePath` / `DirectoryPath` are commented `// Not supported on mobile!` (`types.ts:504-505`) |
| `joplin.commands` (register/execute) | **Yes** | `JoplinCommands.ts` — no platform tag |
| `joplin.workspace` (selectedNote, events) | **Yes**, except `filterEditorContextMenu` | `JoplinWorkspace.ts:156-160` tags only the editor-context-menu filter as desktop |
| `joplin.contentScripts.register(MarkdownItPlugin)` + `assets()` | **Yes** | §4 |
| `joplin.contentScripts.register(CodeMirrorPlugin)` | **Yes (CM6 only)** | `types.ts:910` "This field is ignored on mobile…" (about CM5 `codeMirrorResources`); `types.ts:934` "See the editor plugin tutorial for how to develop a plugin for **the mobile editor** and the desktop beta markdown editor" |
| `joplin.views.dialogs` (create/setHtml/setButtons/open/addScript/setFitToContent/showMessageBox/showToast) | **Yes** | `JoplinViewsDialogs.ts` — class untagged; mobile impl in `packages/app-mobile/components/plugins/dialogs/PluginUserWebView.tsx` |
| `joplin.views.dialogs.showOpenDialog` | **No** | `JoplinViewsDialogs.ts:93` desktop tag; mobile impl throws: `PlatformImplementation.ts:53-55` `showOpenDialog: async (_options) => { throw new Error('Not implemented: showOpenDialog'); }` |
| `joplin.views.panels` | **Yes** | `JoplinViewsPanels.ts` untagged; `packages/app-mobile/components/plugins/dialogs/PluginPanelViewer.tsx` exists |
| `joplin.views.editors` | **Yes** | `JoplinViewsEditor.ts` untagged |
| `joplin.views.toolbarButtons` — `EditorToolbar` | **Yes** | `types.ts:347-358`: `NoteToolbar` carries the desktop tag, `EditorToolbar` does not |
| `joplin.views.toolbarButtons` — `NoteToolbar` | **No** | same |
| `joplin.views.menuItems`, `joplin.views.menus` | **No (desktop only)** | `JoplinViewsMenuItems.ts:15`, `JoplinViewsMenus.ts:15` class-level desktop tags |
| `joplin.views.noteList` | **No** | `JoplinViewsNoteList.ts:39` |
| `joplin.window.loadChromeCssFile` / `loadNoteCssFile` | **No** | `JoplinWindow.ts:22, :37` |
| `joplin.imaging.*` | **No — every method throws on mobile** | `PlatformImplementation.ts:73-85`: `createFromPath`, `createFromPdf`, `getPdfInfo` all `throw new Error('Not implemented: …')`; `nativeImage` returns `null` (`:88-90`). `createFromResource`/`toPngResource` etc. are built on these, so they throw too. `JoplinImaging.ts:84` also carries the desktop tag |
| `joplin.clipboard` | **Android yes / iOS no** | `PlatformImplementation.ts:92-111`: iOS branch throws `'Not available on iOS'` per AppStore guidelines; Android uses `@react-native-clipboard/clipboard`. Class is also desktop-tagged in `JoplinClipboard.ts` |
| `joplin.fs.archiveExtract` | **No** | `JoplinFs.ts:15, :23` desktop tags |
| `joplin.interop`, `joplin.ai` | **No** | `JoplinInterop.ts`, `Joplin.ts:135` desktop tags |
| `joplin.require('fs')` / `require('fs-extra')` / `sqlite3` | **NO — throws** | §2 |
| `joplin.require('path')` | **Yes** | §2 |
| `joplin.plugins.dataDir()` / `installationDir()` | **Returns a path, but nothing can write to it** | `JoplinPlugins.ts:70, :80` untagged; see §2 |

---

## 2. Resource creation on mobile — the crux

### 2a. The only resource-creation entry point requires a filesystem path

`packages/lib/services/plugins/api/JoplinData.ts:85-87`

```ts
public async post(path: Path, query: any = null, body: any = null, files: RequestFile[] = null) {
	return this.api_.route(RequestMethod.POST, this.pathToString(path), query, this.serializeApiBody(body), files);
}
```

`packages/lib/services/rest/Api.ts:26-28` — **`RequestFile` has exactly one field:**

```ts
export interface RequestFile {
	path: string;
}
```

There is no `content`, no `data`, no base64, no `Blob`, no `ArrayBuffer` variant. `Api.route`
does nothing with `files` except forward them (`Api.ts:181-229`).

`packages/lib/services/rest/routes/resources.ts:50-72`

```ts
if (request.method === RequestMethod.POST || request.method === RequestMethod.PUT) {
	const isUpdate = request.method === RequestMethod.PUT;

	if (!request.files.length) {
		if (request.method === RequestMethod.PUT) {
			// In that case, we don't try to update the resource blob, we
			// just update the properties.
			return defaultAction(BaseModel.TYPE_RESOURCE, request, id, link);
		} else {
			// If it's a POST request, the file content is required.
			throw new ErrorBadRequest('Resource cannot be created without a file');
		}
	}
	...
	const filePath = request.files[0].path;
	const defaultProps = request.bodyJson(readonlyProperties(request.method));
	return shim.createResourceFromPath(filePath, defaultProps, { … });
}
```

Two consequences:
* **POST** without `files` → hard error `Resource cannot be created without a file`.
* **PUT** without `files` → silently updates *metadata only*; the blob is untouched.
  So you cannot even overwrite an existing drawing's content without a path.

And on mobile the file is read straight off the RN filesystem —
`packages/app-mobile/utils/shim-init-react/shimInitShared.ts:107-138`:

```ts
// NOTE: This is a limited version of createResourceFromPath - unlike the Node version, it
// only really works with images. It does not resize the image either.
shim.createResourceFromPath = async function(filePath, defaultProps = undefined) {
	...
	const targetPath = Resource.fullPath(resource);
	await shim.fsDriver().copy(filePath, targetPath);
	...
};
```

`shim.fsDriver().copy()` on Android is RNFS — it needs a real file that already exists.

### 2b. Mobile plugins have no filesystem at all

`packages/app-mobile/components/plugins/backgroundPage/pluginRunnerBackgroundPage.ts`
(the whole `require` shim for mobile plugins):

```ts
// Old plugins allowed to import legacy APIs
const legacyPluginIds = [
	'outline',
	'ylc395.noteLinkSystem',
	'com.github.joplin.kanban',
];

const pathLibrary = require('path');
const punycode = require('punycode/');

export const requireModule = (moduleName: string, fromPluginId: string) => {
	if (moduleName === 'path') {
		return pathLibrary;
	}

	if (legacyPluginIds.includes(fromPluginId)) {
		...
		if (moduleName === 'fs' || moduleName === 'fs-extra') {
			console.warn('The fs library is unavailable to mobile plugins. A non-functional mock will be returned.');
			return {
				existsSync: () => false,
				pathExists: () => false,
				readFileSync: () => '',
				readFile: () => '',
				writeFileSync: () => '',
				writeFile: () => '',
				appendFile: () => '',
			};
		}
		...
	}

	throw new Error(`Unable to require module ${moduleName} on mobile.`);
};
```

Reading that carefully:

* `path` is the **only** module any mobile plugin can require.
* `fs` / `fs-extra` return a **deliberately non-functional mock**, and only for three
  hard-coded legacy plugin IDs (`outline`, `ylc395.noteLinkSystem`, `com.github.joplin.kanban`).
  Our plugin id is not one of them, so `joplin.require('fs-extra')` **throws**.
* The mock's `writeFile` is `() => ''` — a no-op. Even the grandfathered plugins cannot write.

Matching doc in `packages/lib/services/plugins/api/Joplin.ts:141-157` — `joplin.require`
is explicitly desktop-only:

```
 * Currently these packages are available:
 *
 * - [sqlite3](https://www.npmjs.com/package/sqlite3)
 * - [fs-extra](https://www.npmjs.com/package/fs-extra)
 *
 * <span class="platform-desktop">desktop</span>
```

### 2c. Every alternative route, closed

| Candidate | Verdict | Why |
| --- | --- | --- |
| `joplin.require('fs-extra')` write to `dataDir()` | **Closed** | throws (above). Laurent on the forum, 2025-09-10: "this package is most likely not available on mobile"; personalizedrefrigerator (the mobile-plugin maintainer), same thread: **"In general, file access is unsupported for mobile plugins."** — [discourse #47249](https://discourse.joplinapp.org/t/can-an-android-plugin-access-files-using-joplin-plugins-datadir/47249) |
| Pass content inline to `data.post` (base64 / data URL / Blob / ArrayBuffer) | **Closed** | `RequestFile = { path: string }`, `Api.ts:26-28`. No other shape is accepted anywhere in `Api.route` or `routes/resources.ts` |
| `joplin.imaging` → `toPngFile()` / `toPngResource()` | **Closed** | mobile `PlatformImplementation.imaging` throws `Not implemented` for all three primitives (`createFromPath`, `createFromPdf`, `getPdfInfo`); `nativeImage` is `null` |
| `joplin.fs.archiveExtract` (extract a zip into a dir) | **Closed** | desktop-only, and you'd still need to write the zip first |
| `joplin.data.put(['resources', id])` to overwrite content | **Closed** | without `files` it only updates metadata (`resources.ts:54-57`) |
| Point `path` at `joplin.plugins.installationDir()` | **Useless** | the plugin dir is read-only static content shipped in the `.jpl`; it cannot hold a drawing the user just made |
| Point `path` at `joplin.data.resourcePath(id)` of an existing resource | **Useless** | reading the path is fine; you still cannot put new bytes there |
| `joplin.settings` as the store (Laurent's suggested workaround) | **Works, but wrong shape** | stores the JSON/SVG as a setting string, not a `:/id` resource. Violates Slava's requirement |
| Reach `shim.fsDriver()` from a webview | **Closed** | the mobile note-renderer webview *does* get an `fsDriver` remote API (`packages/app-mobile/contentScripts/rendererBundle/types.ts` — `MainProcessApi.fsDriver`), but it is handed to Joplin's own `Renderer` object (`rendererBundle/contentScript/index.ts:44-47`) and is **not** on `window.webviewApi`, which exposes only `postMessage` (`index.ts:32-34`) |
| POST `['notes']` with `body_html` containing a `data:` image (the Web-Clipper media route) | **Closed on mobile** (and on desktop for SVG) | `shim.imageFromDataUrl` is an unimplemented stub on mobile (`packages/lib/shim.ts:396-399`) and throws for SVG on Electron (`shim-init-node.ts:516-519`); `notes.ts:291-297` swallows the error and leaves the inline `data:` URL in the note body. Full analysis in §2e |
| Local REST/clipper server | **Closed** | desktop-only; mobile has no clipper server |

### 2d. Why the June 2026 note was right — and what changed since

Nothing relevant changed. The `fs-extra` mock/throw shim, the `RequestFile = {path}` type
and the `routes/resources.ts` requirement are all present on `dev` today (Sep 2026). The
public forum answer from the mobile-plugin maintainer dates from **2025-09-10** and still
stands. There is no PR in `laurent22/joplin` titled around mobile plugin file/resource
access (`search_pull_requests` for `mobile plugin resource file in:title` → 0 results).

**Verdict on the crux: creating a `:/id` resource from a mobile Joplin plugin is
impossible with the Joplin 3.7.8 public plugin API.**

### 2e. The notes-route media route

**Route under test.** Joplin's Data API *notes* route creates resources itself from media
referenced in `body_html` — this is how the Web Clipper works. A plugin could in principle
reach it with `joplin.data.post(['notes'], null, { body_html: '<img src="data:image/svg+xml,…">', parent_id, title })`.
Chain: `requestNoteToNote` → `extractMediaUrls` → `downloadMediaFiles` → `downloadMediaFile`
(`data:` branch) → `shim.imageFromDataUrl` → `createResourcesFromPaths` →
`shim.createResourceFromPath` → `replaceUrlsByResources` rewrites the body to `:/id`.

**Answer: the route is real and it does exactly what the coordinator describes — but it is
dead on mobile, at one specific line, and it is also dead for SVG on Electron desktop.**

#### Q1 — the `data:` branch, and what it accepts

`packages/lib/services/rest/routes/notes.ts:260-298` — the branch exists:

```ts
export async function downloadMediaFile(url: string, fetchOptions?: FetchOptions, allowedProtocols?: string[]) {
	url = markdownUtils.unescapeLinkUrl(url);

	const isDataUrl = url && url.toLowerCase().indexOf('data:') === 0;
	const urlProtocol = urlUtils.urlProtocol(url)?.toLowerCase();

	if (!isValidUrl(url, isDataUrl, urlProtocol, allowedProtocols)) {
		return '';
	}

	const fileExt = getFileExtension(url, isDataUrl);
	const mediaPath = generateMediaPath(url, isDataUrl, fileExt);
	let newMediaPath = undefined;

	try {
		if (isDataUrl) {
			await shim.imageFromDataUrl(url, mediaPath);
		} else if (urlProtocol === 'file:') {
			…
```

**`data:` is an allowed protocol** for the POST /notes path —
`notes.ts:521-528`:

```ts
const allowedProtocolsForDownloadMediaFiles = ['http:', 'https:', 'file:', 'data:'];
const extracted = await extractNoteFromHTML(requestNote, String(requestId), imageSizes, undefined, allowedProtocolsForDownloadMediaFiles);
```

**Images only — a JSON payload cannot travel this way.** `notes.ts:244-258`:

```ts
const isValidUrl = (url: string, isDataUrl: boolean, urlProtocol?: string, allowedProtocols?: string[]) => {
	if (!urlProtocol) return false;

	// PDFs and other heavy resources are often served as separate files instead of data urls, its very unlikely to encounter a pdf as a data url
	if (isDataUrl && !url.toLowerCase().startsWith('data:image/')) {
		logger.warn(`Resources in data URL format is only supported for images ${url}`);
		return false;
	}
	…
```

So `data:application/json`, `data:application/vnd.excalidraw+json` and a
`data:application/pdf` trick are all refused at `notes.ts:248`. **Confirmed: the Excalidraw
scene JSON cannot be smuggled through as a second data URL.**

**SVG → `.svg` mapping works.** `notes.ts:228-233` →
`mimeUtils.toFileExtension(mimeUtils.fromDataUrl(url))`; `packages/lib/mime-utils.ts:37-46`
parses `data:image/svg+xml,…` to `image/svg+xml`; `packages/lib/mime-utils-types.ts:654`:

```ts
{ t: 'image/svg+xml', e: ['svg', 'svgz'] },
```

`toFileExtension` (`mime-utils.ts:21-32`) returns the first 3-char extension → `svg`, and
`getFileExtension` keeps it because `fromFileExtension('svg')` is non-null.

**What `extractMediaUrls` picks up** — `notes.ts:416-421`:

```ts
export function extractMediaUrls(markupLanguage: number, text: string): string[] {
	const urls: string[] = [];
	urls.push(...ArrayUtils.unique(markupLanguageUtils.extractImageUrls(markupLanguage, text)));
	urls.push(...ArrayUtils.unique(markupLanguageUtils.extractPdfUrls(markupLanguage, text)));
	return urls;
}
```

Images and PDFs only. Plain `<a>` links are *not* collected: `markdownUtils.extractFileUrls`
(`packages/lib/markdownUtils.ts:93-106`) only keeps `link_open` tokens when
`onlyType === 'pdf'` **and** the next token is the literal text `embedded_pdf`
(`markdownUtils.ts:96-99`), i.e. Joplin's `[embedded_pdf](url)` form.

**A gate that is easy to miss: base64 SVG data URLs are dropped before they ever reach
`downloadMediaFile`.** For a markdown note, `extractImageUrls` runs the body back through
markdown-it with Joplin's own link validator — `packages/lib/markdownUtils.ts:82-84`:

```ts
extractFileUrls(md: string, onlyType: string = null): string[] {
	const markdownIt = new MarkdownIt();
	markdownIt.validateLink = validateLinks; // Necessary to support file:/// links
```

and `packages/renderer/MdToHtml/validateLinks.ts:3-15` is the whole function:

```ts
export default function(url: string) {
	const BAD_PROTO_RE = /^(vbscript|javascript|data):/;
	const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

	// url should be normalized at this point, and existing entities are decoded
	const str = url.trim().toLowerCase();

	if (str.startsWith('data:image/svg+xml,') || str.startsWith('data:image/svg+xml;utf8,')) {
		return true;
	}

	return BAD_PROTO_RE.test(str) ? (!!GOOD_DATA_RE.test(str)) : true;
}
```

`svg+xml` is **absent** from `GOOD_DATA_RE`, so `data:image/svg+xml;base64,…` fails
validation, markdown-it never emits an `image` token for it, and the URL is invisible to
`extractMediaUrls`. Only the **URL-encoded** forms `data:image/svg+xml,…` and
`data:image/svg+xml;utf8,…` (lines 10-12) survive — which also means the payload travels
percent-encoded, ~1.5-2× larger than base64 for XML.

(`convert_to: 'html'` would bypass this gate, since the HTML branch of `extractImageUrls`
has no markdown-it validator — but it produces an **HTML-markup note**, not the
`![excalidraw.svg](:/id)` markdown Slava requires, and it still dies at Q2.)

#### Q2 — `shim.imageFromDataUrl` is NOT implemented on mobile. This is the decisive line.

`packages/lib/shim.ts:396-399` — the default, which is what mobile gets:

```ts
imageFromDataUrl: async (_imageDataUrl: string, _filePath: string, _options: any = null): Promise<any> => {
	throw new Error('Not implemented: imageFromDataUrl');
},
```

A repo-wide code search for `imageFromDataUrl` returns exactly **four** files:
`packages/lib/shim.ts` (the throwing stub), `packages/lib/shim-init-node.ts` (the only
implementation), `packages/lib/services/rest/routes/notes.ts` (the caller) and one docs
file. **Nothing under `packages/app-mobile`.** Neither
`packages/app-mobile/utils/shim-init-react/index.ts` nor `.../shimInitShared.ts` assigns it
— verified by reading both files in full (186 + 165 lines).

**The failure is silent, and lands exactly on the June 2026 outcome.**
`notes.ts:291-297`:

```ts
	} catch (error) {
		// Clipped pages regularly contain images that cannot be downloaded - dead tracking
		// pixels, expired links, etc. There's nothing to be done about it, and the note is
		// still created without them, so this is not logged as a warning.
		logger.info(`Cannot download image at ${url}`, error);
		return '';
	}
```

The throw is swallowed, `downloadMediaFile` returns `''`, `downloadMediaFiles` never pushes
it to `output` (`notes.ts:308`), no resource is created, and `replaceUrlsByResources` leaves
the URL untouched (`notes.ts:385-386`: `if (type === 'link' || !urlInfo || !urlInfo.resource) return before + url + after`).
**Result: a note whose body contains the full inline `data:` SVG** — precisely the "bulky
inline `data:` SVG, never the short `:/id` resource link" outcome from June, reached by a
different road.

**Bonus finding: this route cannot produce an SVG resource on Electron desktop either.**
`packages/lib/shim-init-node.ts:513-538`:

```ts
shim.imageFromDataUrl = async function(imageDataUrl, filePath, options = null) {
	if (options === null) options = {};

	if (shim.isElectron()) {
		const nativeImage = require('electron').nativeImage;
		let image = nativeImage.createFromDataURL(imageDataUrl);
		if (image.isEmpty()) throw new Error('Could not convert data URL to image - perhaps the format is not supported (eg. image/gif)');
		…
	} else {
		if (options.cropRect) throw new Error('Crop rect not supported in Node');

		const imageDataURI = require('image-data-uri');
		const result = imageDataURI.decode(imageDataUrl);
		await shim.fsDriver().writeFile(filePath, result.dataBuffer, 'buffer');
	}
};
```

Electron's `nativeImage` does not decode SVG, so `image.isEmpty()` is true and it throws.
Only the **CLI/node** branch (lines 531-537) handles SVG correctly. So the notes-media route
would give us SVG resources on `joplin-cli` and nowhere else.

**`shim.createResourceFromPath` itself is fine on mobile** — `shimInitShared.ts:109-138`,
already quoted in §2a. It only needs a real temp file, which is exactly the thing
`imageFromDataUrl` was supposed to produce.

#### Q3 — does `joplin.data.post` reach the route unchanged on mobile?

**Yes.** `packages/lib/services/plugins/api/JoplinData.ts:85-87` forwards straight to
`Api.route(RequestMethod.POST, 'notes', …)`, and `packages/lib/services/rest/Api.ts` is the
same class on every platform — there is no mobile-specific filtering, stripping or
rejection of `body_html` anywhere in `Api.ts`, `routes/notes.ts` or the mobile plugin
runtime. The *call* arrives intact; only the shim underneath is missing. That is what makes
this route interesting despite failing today: the gap is one unimplemented shim method, not
an architectural wall.

#### Q4 — practicality, if the shim existed

| Step | Verified? | Evidence |
| --- | --- | --- |
| POST a throwaway note and read the resource id back | **Yes** | `notes.ts:530-543` returns the saved `note`; its `body` has been rewritten to `![](:/<id>)` by `replaceUrlsByResources`, so the id is parseable from the response |
| Permanently delete that note | **Yes** | `notes.ts:606`: `await Note.delete(id, { toTrash: request.query.permanent !== '1', sourceDescription: 'api/notes DELETE' });` → `joplin.data.delete(['notes', id], { permanent: '1' })`. Platform-neutral |
| Delete a superseded resource | **Yes, works on mobile** | `routes/resources.ts:74` falls through to `defaultAction`, and `services/rest/utils/defaultAction.ts:38-42` does `ModelClass.delete(model.id, …)` — pure model/DB, no plugin filesystem involved |
| **Update an existing drawing's bytes** | **No — impossible via this route** | `notes.ts:546-595` (PUT) never calls `extractNoteFromHTML`; it only merges `request.bodyJson(...)` props. **Only POST processes `body_html`.** And `routes/resources.ts:54-57` confirms PUT /resources without `files` updates metadata only |

So "edit a drawing" would have to mean **create a new resource on every save and delete the
old one**. That is workable but ugly: the `:/id` changes on every edit, so every note
referencing the drawing must be rewritten (a drawing shared across notes silently breaks in
all but the one being edited), and each save churns a note create + permanent delete plus a
resource create + delete through sync and revision history. It also loses the stable
identity our `src/resources.ts` currently relies on.

#### Q5 — the embedded-scene SVG (worth doing regardless)

Verified against `@excalidraw/excalidraw@0.18.1` (jsdelivr type declarations and shipped
`dist/prod` bundle):

* `exportToSvg(elements, appState, files, opts)` accepts `exportEmbedScene?: boolean` in its
  appState argument — `dist/types/excalidraw/scene/export.d.ts`; and `AppState.exportEmbedScene: boolean`
  at `dist/types/excalidraw/types.d.ts:226`.
* The **package root** re-exports what we need —
  `dist/types/excalidraw/index.d.ts:15` `export { exportToCanvas, exportToBlob, exportToSvg, exportToClipboard } from "@excalidraw/utils/export";`
  and `:17` `export { loadFromBlob, loadSceneOrLibraryFromBlob, loadLibraryFromBlob } from "./data/blob";`
* `encodeSvgBase64Payload` / `decodeSvgBase64Payload` exist in `scene/export.d.ts` but are
  **not** in the root export list. **The name `decodeSvgMetadata` does not exist in 0.18.1** —
  use `loadFromBlob(new Blob([svgString], { type: 'image/svg+xml' }), null, null)`, which
  decodes the embedded payload for you.
* The mechanism is present in the shipped bundle (`dist/prod/chunk-EIO257PC.js`): markers
  `payload-type:`, `payload-version:2`, `payload-start`, `payload-end`, and the encoder is
  `base64(encode(JSON.stringify(...)))` where `encode` **deflates** first — so the embedded
  payload is compressed, not raw JSON. Decoder path confirmed in the same chunk
  (`/<!-- payload-start -->\s*(.+?)\s*<!-- payload-end -->/`).

**Size cost:** deflate + base64 of the scene JSON. Typical Excalidraw JSON deflates hard, so
the embedded payload usually lands well under the raw JSON it replaces — meaning one
self-describing `.svg` is normally **smaller than today's `.svg` + `.json` pair**. *(Ratio is
an estimate — not measured; measure on a few real drawings before committing.)*

**Recommendation: adopt `exportEmbedScene: true` now, on desktop, independent of mobile.**
It halves the resource count per drawing, and it removes the fragile title-based coupling in
`src/resources.ts:73-86`, where the SVG resource's *title* (`excalidraw-<jsonId>.svg`) is
parsed to find its JSON sibling. The desktop plugin should read the embedded scene whenever
no `.json` sibling exists, keeping full backward compatibility with existing drawings. It
also means that if a mobile write path ever opens, only **one** resource has to be created.

#### Verdict on 2e

**Does not work on mobile today.** Decisive line: `packages/lib/shim.ts:396-399` —
`imageFromDataUrl` throws `Not implemented`, and nothing in `packages/app-mobile` overrides
it; `notes.ts:291-297` then swallows the error and saves the note with the inline `data:`
URL still in the body.

**But it materially improves the upstream ask.** Implementing `shim.imageFromDataUrl` for
React Native is a ~5-line patch, far smaller than the `RequestFile` change proposed in §5:
`packages/app-mobile/utils/fs-driver/fs-driver-rn.ts:267-277` already exposes

```ts
// Encoding can be either "utf8", "utf-8", or "base64"
public writeFile(path: string, content: string, rawEncoding = 'base64') {
```

so a mobile implementation is "split the data URL, `await shim.fsDriver().writeFile(filePath, base64Payload, 'base64')`".
That is a strictly better first PR to propose — it is tiny, it fixes a real Joplin bug (the
mobile Web-Clipper-style import path silently drops every inline image today), and it is
much easier to justify than a new plugin-API surface. It would not, on its own, make our
plugin work: we would still need `validateLinks` to accept base64 SVG data URLs (or send
URL-encoded SVG), we would still be limited to image media (no separate JSON resource — hence
Q5), and we would still have no way to *update* a resource in place.

---

## 3. The "existence proof" is not one: `joplin-plugin-freehand-drawing` is desktop-only

Source read at commit `7d3baea2` (repo default branch), 2026-09-11.

**`src/manifest.json`** — note what is *absent*:

```json
{
	"manifest_version": 1,
	"id": "io.github.personalizedrefrigerator.js-draw",
	"app_min_version": "3.3.0",
	"version": "4.3.0",
	"name": "Freehand Drawing",
	...
	"categories": ["editor"],
```

There is **no `platforms` field** and no `app_min_version_mobile` → per
`plugin_manifest.md`, it defaults to `["desktop"]`. The plugin is **not installable on
mobile**.

**`src/TemporaryDirectory.ts:1-6, 31-51`** — it is built on Node fs, which is exactly what
mobile lacks:

```ts
import { tmpdir } from 'os';
import * as path from 'path';
import type FsExtra = require('fs-extra');
const fs = joplin.require('fs-extra') as typeof FsExtra;
...
public async newFile(data: string, fileExtension: string = ''): Promise<string> {
	const path = this.nextFilepath(fileExtension);
	const file = await fs.open(path, 'w');
	await fs.writeFile(file, data);
	await fs.close(file);
	return path;
}
...
public static async create(): Promise<TemporaryDirectory> {
	const prefix = 'joplin-js-draw';
	const directoryPath = await fs.mkdtemp(path.join(tmpdir(), prefix));
	return new TemporaryDirectory(directoryPath);
}
```

`joplin.require('fs-extra')` runs at **module top level**, and `TemporaryDirectory.create()`
is the first thing `onStart` does (`src/index.ts:18`) — on mobile this would throw before
the plugin even registered a command.

**`src/Resource.ts:130-154`** — creation is the same two-step temp-file dance we use:

```ts
public static async ofData(tmpdir, data, title, fileExtension): Promise<Resource> {
	const query = null;
	const metadata = { title: …, created_time: Date.now(), updated_time: Date.now(), file_extension: fileExtension };
	const filePath = await tmpdir.newFile(data, fileExtension);
	const fileData = [{ path: filePath }];
	const result = await joplin.data.post(['resources'], query, metadata, fileData);
	…
}
```

and update (`Resource.ts:52-73`) writes another temp file and calls
`joplin.data.put(['resources', this.resourceId], query, metadata, fileData)`.

**`src/DrawingManager.ts:39-50`** — the `:/id` insertion, identical in spirit to ours:

```ts
const resource = await Resource.ofData(this.temporaryDirectory_, svgData, localization.defaultImageTitle, '.svg');
const textToInsert = `![${resource.htmlSafeTitle()}](:/${resource.resourceId})`;
await insertText(textToInsert);
```

**Viewer "Edit" button** (`src/index.ts:94-109`): markdown-it content script + asset +
`webviewApi.postMessage` → `joplin.contentScripts.onMessage(..., 'edit:<url>')`. Same
architecture as ours. Its README is entirely desktop-framed (markdown toolbar, keyboard
shortcuts, "open in a new window", Rich Text Editor double-click) and never mentions
Android/iOS.

**What actually runs on mobile is Joplin itself, not this plugin.** Joplin's own help page
[Drawing tool](https://joplinapp.org/help/apps/drawing_tool/) states drawing is **built in
on mobile** and supported **on desktop through the Freehand Drawing plugin**. The built-in
mobile editor lives in the app, not in a plugin:
`packages/app-mobile/contentScripts/imageEditorBundle/` and
`packages/app-mobile/components/NoteEditor/ImageEditor/`. It creates resources with
app-internal code that has direct `shim.fsDriver()` access — a privilege no plugin has.

So there is **no existence proof**. The plugin Slava is thinking of is the desktop plugin;
the mobile capability is a native Joplin feature.

---

## 4. Our plugin on mobile — what would and would not work

### 4a. Would break immediately (plugin fails to load)

| Site | Problem |
| --- | --- |
| `src/resources.ts:5` `const fs = joplin.require('fs-extra')` at module scope | **throws on import** → `onStart` never runs. Fatal. |
| `src/resources.ts:3` `import { tmpdir } from 'os'` | `os` is not requireable on mobile; webpack may shim it, but `tmpdir` is meaningless there |
| `src/index.ts` `clearDiskCache()` (first line of `onStart`) | `fs.existsSync` / `mkdirSync` |
| `createDiagramResource` / `updateDiagramResource` | the crux — see §2 |

### 4b. Desktop-only APIs we currently call

| Call | Site | Mobile |
| --- | --- | --- |
| `joplin.window.loadChromeCssFile(...)` | `src/index.ts` `onStart` | **desktop only** (`JoplinWindow.ts:22`) — must be guarded |
| `joplin.views.menus.create(..., MenuItemLocation.Tools)` | `src/index.ts` | **desktop only** (`JoplinViewsMenus.ts:15`) |
| `joplin.workspace.filterEditorContextMenu(...)` | `src/index.ts` | **desktop only** (`JoplinWorkspace.ts:156-160`) |
| `joplin.views.toolbarButtons.create('addExcalidraw', …, ToolbarButtonLocation.EditorToolbar)` | `src/index.ts` | **OK on mobile** |

### 4c. Would probably work

* **Dialog + iframe.** The mobile plugin dialog is a real WebView whose *base directory is
  the plugin's install dir*:
  `packages/app-mobile/components/plugins/dialogs/PluginUserWebView.tsx:122-133`
  ```tsx
  <ExtendedWebView
      style={props.style}
      baseDirectory={plugin.baseDir}
      ...
      html={html}
      hasPluginScripts={true}
      injectedJavaScript={injectedJs}
  ```
  and dialog scripts are injected as `<script src="<abs path>">` on Android/iOS
  (`.../dialogs/hooks/useWebViewSetup.ts:33-37` → `dialogControl.includeJsFiles(jsPaths)`),
  vs. read-and-inline on **web** (`if (shim.mobilePlatform() === 'web') … runScript(path, await shim.fsDriver().readFile(path,'utf-8'))`).
  So a `file://`-resolved `<iframe src>` is plausible on Android/iOS and **will not work on
  Joplin web**, where files are virtual.
* **Form data.** `getFormData()` exists in the mobile dialog webview
  (`packages/app-mobile/components/plugins/backgroundPage/initializeDialogWebView.ts:65-67`),
  so our hidden-`<form>` data-passing pattern survives.
* **Dialog buttons.** `setButtons`/`open` are untagged → Save/Close render on mobile.
* **markdown-it content script + `assets()` JS in the mobile viewer.** Confirmed:
  `packages/app-mobile/contentScripts/rendererBundle/useWebViewSetup.ts:154-171` ships
  plugin content scripts into the viewer (`setExtraContentScriptsAndRerender`), line
  231-234 handles `pluginAssets/` loading, and lines 72-82 route messages back:
  ```ts
  const onPostPluginMessage = async (contentScriptId: string, message: unknown) => {
      …
      const pluginId = pluginService.pluginIdByContentScriptId(contentScriptId);
      …
      return plugin.emitContentScriptMessage(contentScriptId, message);
  };
  ```
  and `packages/app-mobile/contentScripts/rendererBundle/contentScript/index.ts:32-34`:
  ```ts
  window.webviewApi = {
      postMessage: messenger.remoteApi.onPostPluginMessage,
  };
  ```
  **Note:** the mobile viewer's `WebViewApi` has **only `postMessage`** (`index.ts:9-11`) —
  no `onMessage`. Our `markdownIt-content.js` only uses `postMessage`, so it is compatible;
  its `top.require('@joplin/lib/…')` fallback will simply fail silently on mobile (fine).
* **CodeMirror 6 content script.** Mobile's editor is CM6 and
  `ContentScriptType.CodeMirrorPlugin` is supported there; our `codeMirror.ts` uses only
  `editorControl.registerCommand`, which is the CM6 API. Should work —
  **unverified in practice**.
* **Settings.** `joplin.settings` is cross-platform; our two settings are `String`(enum)
  and `Bool`, both fine. `joplin.settings.globalValue('theme' | 'themeAutoDetect')` —
  mobile has themes, but the numeric theme IDs our `DARK_THEME_IDS`/`LIGHT_THEME_IDS` sets
  assume are **unverified on mobile**; the editor's own light/dark autodetect is the safe
  fallback we already have.

### 4d. Would be painful even if the resource blocker vanished

1. **Bundle size / memory.** Excalidraw 0.18 + React is several MB of JS. Android WebViews
   on mid-range devices will be slow to boot it and may OOM. Joplin also warns that
   resources >10 MB crash mobile sync — Excalidraw scenes with images can approach that.
2. **`<script type="module">`** in `src/local-excalidraw/index.html`. ES module scripts are
   subject to CORS; from a `file://` origin in an Android WebView they are commonly blocked.
   This alone is likely to break the current iframe as-is on mobile — it would need a
   classic (non-module) bundle, or full inlining.
3. **`EXCALIDRAW_ASSET_PATH`.** We already fight this on desktop
   (`window.EXCALIDRAW_ASSET_PATH = new URL("..", document.location.href).href`). With a
   `file://` base and the `dist/fonts` directory this needs re-verification; on Joplin web
   it cannot work at all (virtual FS) — fonts would have to be inlined as data URIs.
4. **Touch/pen.** Excalidraw itself has good pointer-event/stylus support, so drawing is
   fine; the problem is chrome — its toolbars/panels are designed for a desktop viewport,
   and the on-screen keyboard resizing the WebView causes canvas/viewport jumps.
5. **Dialog sizing.** `setFitToContent(handle,false)` gives 90vw/80vh on desktop; mobile
   dialog sizing goes through `getContentSize()` (`initializeDialogWebView.ts:74-85`) and a
   `PluginDialogWebView` — a full-screen canvas inside a "modal with a button row" is an
   awkward fit on a phone.
6. **Web build.** If Slava wants the Joplin **web** app too, `file://` asset loading is out;
   everything must be inlined.

### 4e. One codebase for both platforms — yes, mechanically

* `manifest.json`: add `"platforms": ["desktop", "mobile"]` and
  `"app_min_version_mobile": "<whatever ships the fix>"`.
* Move `joplin.require('fs-extra')` out of module scope into a **lazily-created**
  desktop-only module, so importing the plugin never touches it on mobile.
* Guard `window.loadChromeCssFile`, `views.menus`, `filterEditorContextMenu` behind
  `(await joplin.versionInfo()).platform === 'desktop'`.
* Keep one markdown-it content script + asset (already mobile-safe) and one CM6 script.

---

## 5. Verdict and plan

### Verdict

**Not feasible today** for Slava's hard requirement (`![…](:/id)` resource links created
and updated from the phone), on any Joplin mobile version up to and including **3.7.8**.

The single blocking sentence, with evidence:
> `packages/lib/services/rest/Api.ts:26-28` types a request file as `{ path: string }` only,
> `packages/lib/services/rest/routes/resources.ts:53-71` refuses a POST without
> `request.files[0].path` and reads it via `shim.createResourceFromPath`, and
> `packages/app-mobile/components/plugins/backgroundPage/pluginRunnerBackgroundPage.ts:13-44`
> makes `fs`/`fs-extra` throw (or return a no-op mock) for every mobile plugin — so there is
> no path a mobile plugin can produce.

**What *is* feasible today on mobile: everything except writing.** View-only rendering of
existing drawings, tagging them in the viewer, reading the JSON via
`joplin.data.get(['resources', id, 'file'])`, showing them in an Excalidraw viewer inside a
plugin dialog — all supported.

**The notes-route media route (§2e) was checked and does not change this verdict.** Posting
`['notes']` with a `data:` image in `body_html` does make *Joplin* create the resource and
rewrite the body to `:/id` — but on mobile the chain dies at
`packages/lib/shim.ts:396-399`, where `imageFromDataUrl` is an unimplemented stub that
throws, and `routes/notes.ts:291-297` swallows that error and saves the note with the inline
`data:` URL intact. It **did** change the recommended upstream ask, below.

### The path to making it fully work

There is exactly one: **get the API hole closed upstream.** Three candidate shapes, in order
of likely acceptance — §2e added (C) and it is now the recommended first PR:

* **(C) Implement `shim.imageFromDataUrl` for React Native.** ~5 lines in
  `packages/app-mobile/utils/shim-init-react/`: split the data URL and call the existing
  `FsDriverRN.writeFile(path, base64Payload, 'base64')`
  (`packages/app-mobile/utils/fs-driver/fs-driver-rn.ts:267-277`). It is tiny, it fixes a
  real Joplin bug on its own (today the mobile Web-Clipper-style import path silently drops
  every inline image — `notes.ts:291-297`), and it is far easier to justify than new plugin
  API surface. **Caveat: it is not sufficient by itself for us** — we would also need
  `validateLinks` to accept base64 `image/svg+xml` (or send URL-encoded SVG, ~1.5-2× larger),
  we could still carry only *image* media (so the scene JSON must be embedded in the SVG —
  see §2e Q5), and we would still have **no way to update a resource in place**, forcing a
  new-resource-per-save churn. Best used as a door-opener and a credibility builder, with (A)
  as the follow-up.

* **(A) Inline content in `RequestFile`.** Extend to
  `{ path: string } | { content: string; encoding?: 'base64'|'utf8'; filename?: string }`,
  have `routes/resources.ts` write it to `Setting.value('tempDir')` via
  `shim.fsDriver().writeFile()` then fall through to `shim.createResourceFromPath`. Small,
  contained, works on desktop/mobile/web identically, and needs no new plugin API surface.
* **(B) A mobile-capable scoped `joplin.fs`** limited to `plugins.dataDir()` +
  the temp dir (`writeFile`/`readFile`/`unlink`). Bigger surface; personalizedrefrigerator
  flagged in [discourse #47249](https://discourse.joplinapp.org/t/can-an-android-plugin-access-files-using-joplin-plugins-datadir/47249)
  that the Android WebView side would need `WebViewAssetLoader` work.

Slava has already landed a Joplin-ecosystem PR (neagix#6 was ours; upstream contribution is
familiar territory). **(A) remains the ask that actually unblocks us** (~100 lines plus
tests); **(C) is the cheapest way to open the conversation** and is worth sending first or
alongside.

### Staged plan

Stages 1–2 are shippable **now**. Stage 3 is gated on the upstream PR. §2e adds a new
stage **1b** (embedded-scene SVG), which is worth doing on desktop regardless of mobile and
also shrinks every later stage.

| Stage | Scope | Effort | Notes |
| --- | --- | --- | --- |
| **0. Make the plugin mobile-loadable** | `platforms` + `app_min_version_mobile` in the manifest; move `joplin.require('fs-extra')` behind a lazy desktop-only accessor; guard `loadChromeCssFile`, `views.menus`, `filterEditorContextMenu` with `versionInfo().platform`; keep `ToolbarButtonLocation.EditorToolbar` | **S — 4-6 h** | Pure refactor, zero behaviour change on desktop. Prerequisite for everything else |
| **1. View-only on mobile** | markdown-it content script already renders the SVG `![…](:/id)` natively; verify the asset JS + `webviewApi.postMessage` round-trip in the mobile viewer; on mobile make the "Edit" affordance open a **read-only** Excalidraw viewer dialog (zoom/pan, no save) | **M — 12-20 h** | Real work is the mobile dialog/iframe: non-module bundle, asset path under `file://`, viewport/zoom. Tests on Android + Joplin web |
| **1b. Embedded-scene SVG (desktop first)** | Switch saves to `exportToSvg(..., { exportEmbedScene: true })` and load via `loadFromBlob`; keep reading the legacy `.json` sibling when present, so existing drawings still open. Drops the title-parsing coupling in `src/resources.ts:73-86` | **M — 10-14 h** | Verified available in `@excalidraw/excalidraw@0.18.1` (§2e Q5). One resource per drawing instead of two; measure the size delta on real drawings first |
| **2. Upstream the API fix** | Primary: the `RequestFile` inline-content PR (A) against `laurent22/joplin` + a test in `packages/lib/services/rest`. Opener: the ~5-line RN `shim.imageFromDataUrl` PR (C), which fixes a standalone mobile bug | **M — 16-24 h** + **calendar weeks** for review/release | The whole project hinges on this. Effort is mostly review latency, not code. (C) is a few hours and builds credibility for (A) |
| **3. Edit existing drawing on mobile** | Swap `createDiagramResource`/`updateDiagramResource` to a platform-dispatching `ResourceWriter`: desktop = temp file (unchanged), mobile = inline content. Wire Save in the mobile dialog | **M — 10-16 h** (**S-M — 6-10 h** if Stage 1b landed: one resource, not two) | Only after Stage 2 ships in a mobile release. If only (C) lands, this degrades to new-resource-per-save + `data.delete(['resources', oldId])` and a note-body rewrite — see §2e Q4 |
| **4. Create new drawing on mobile** | Toolbar button → new-drawing dialog → two resources + `insertText(':/id')`; verify `insertText` in the mobile CM6 editor | **S — 6-8 h** | Mostly reuse of Stage 3 |
| **5. Mobile UX polish** | Full-bleed dialog, keyboard/viewport handling, touch-target sizing, theme wiring, perf on large scenes, size guardrails (<10 MB) | **L — 20-40 h** | Open-ended; where phone-vs-desktop reality bites |

Fastest credible route to "it works on my phone": **Stage 0 + 1 now (~1 week)**, open the
upstream PRs in parallel ((C) first, then (A)), slot **1b** in while waiting, then Stages 3-4
land within days of the API shipping.

### Top 3 risks

1. **The upstream PR never lands, or lands late.** Everything past Stage 1 is blocked on a
   change to Joplin core that we do not control. Mitigation: propose the minimal variant (A),
   bring a test and a working branch, and post it in the plugins category where
   personalizedrefrigerator (the mobile-plugin maintainer) will see it. Fallback if
   rejected: mobile stays view-only — which is still a real improvement and does not
   compromise the `:/id` requirement.
2. **Excalidraw doesn't survive the Android WebView.** Multi-MB React bundle, `type="module"`
   scripts under `file://`, `EXCALIDRAW_ASSET_PATH`/font resolution, on-screen-keyboard
   viewport thrash, and OOM on mid-range devices. This risk is entirely inside Stage 1, so
   it gets discovered cheaply and early — deliberately front-loaded. Mitigation: build a
   classic (non-module) bundle with inlined fonts for the mobile target; prototype against
   Joplin web first (`app.joplincloud.com` + "Install from file", per
   `mobile_plugin_debugging.md`) before touching a device.
3. **Feature/UX divergence between platforms.** `views.menus`, `filterEditorContextMenu`,
   `loadChromeCssFile` and `NoteToolbar` simply do not exist on mobile, and our
   cursor-line-based "Edit Excalidraw drawing" flow leans on the editor context menu. The
   mobile entry points have to be genuinely rethought (editor toolbar button + viewer tap),
   not ported. Mitigation: one shared core module + thin per-platform `registerDesktopUi()` /
   `registerMobileUi()`, so the divergence is explicit and testable rather than scattered
   through `onStart`.

---

## Appendix: files consulted

**Joplin (`dev`, 2026-09-11)**
`packages/lib/services/plugins/api/{Joplin,JoplinData,JoplinPlugins,JoplinImaging,JoplinFs,Global,JoplinViewsDialogs,JoplinViewsPanels,JoplinViewsEditor,JoplinViewsToolbarButtons,JoplinViewsMenuItems,JoplinViewsMenus,JoplinViewsNoteList,JoplinWindow,JoplinWorkspace,JoplinSettings,JoplinCommands,JoplinContentScripts,JoplinClipboard,JoplinInterop,types}.ts`;
`packages/lib/services/rest/{Api.ts,routes/resources.ts,routes/notes.ts,utils/defaultAction.ts}`;
`packages/lib/{shim.ts,shim-init-node.ts,mime-utils.ts,mime-utils-types.ts,markdownUtils.ts,markupLanguageUtils.ts}`;
`packages/renderer/MdToHtml/validateLinks.ts`;
`packages/app-mobile/utils/fs-driver/fs-driver-rn.ts`;
`packages/app-mobile/utils/shim-init-react/{index.ts,shimInitShared.ts}`;
`packages/app-mobile/services/plugins/PlatformImplementation.ts`;
`packages/app-mobile/components/plugins/{PluginRunnerWebView.tsx,backgroundPage/{pluginRunnerBackgroundPage,initializeDialogWebView,startStopPlugin}.ts,dialogs/{PluginUserWebView.tsx,PluginDialogWebView.tsx,hooks/useWebViewSetup.ts}}`;
`packages/app-mobile/contentScripts/rendererBundle/{useWebViewSetup.ts,types.ts,contentScript/index.ts}`;
`packages/app-mobile/utils/shim-init-react/shimInitShared.ts`;
`readme/api/references/{plugin_manifest.md,mobile_plugin_debugging.md}`.

**freehand-drawing (`7d3baea2`)**
`src/{manifest.json,index.ts,Resource.ts,TemporaryDirectory.ts,DrawingManager.ts,constants.ts}`, `README.md`.

**Ours**
`src/{index.ts,resources.ts,manifest.json,local-excalidraw/index.html,contentScripts/{markdownIt.ts,markdownIt-content.js,codeMirror.ts}}`.

**@excalidraw/excalidraw 0.18.1 (jsdelivr)**
`dist/types/excalidraw/{index.d.ts,types.d.ts,scene/export.d.ts,data/blob.d.ts,data/image.d.ts}`,
`dist/types/utils/export.d.ts`, `dist/prod/chunk-EIO257PC.js`.

**Web**
[discourse #47249 "Can an Android plugin access files using joplin.plugins.dataDir?"](https://discourse.joplinapp.org/t/can-an-android-plugin-access-files-using-joplin-plugins-datadir/47249),
[joplinapp.org/help/apps/drawing_tool/](https://joplinapp.org/help/apps/drawing_tool/),
[joplinapp.org/plugins/plugin/io.github.personalizedrefrigerator.js-draw/](https://joplinapp.org/plugins/plugin/io.github.personalizedrefrigerator.js-draw/).

**Marked unverified:** CM6 content-script behaviour on a real device; `insertText` on the
mobile editor; numeric theme IDs on mobile; `Buffer` availability in the mobile plugin
sandbox; whether an absolute `file://` iframe `src` resolves inside the Android dialog
WebView.
