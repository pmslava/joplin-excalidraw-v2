# Renaming and republishing the Excalidraw v2 Joplin plugin

Research date: **2026-09-11**. Local repo: `/home/mrsir/Lab/joplin-plugin-excalidraw`
(branch `excalidraw-0.18-theme-editor-menu`, fork of `neagix/joplin-excalidraw-v2`).

Registry snapshot used throughout: `https://raw.githubusercontent.com/joplin/plugins/master/manifests.json`
fetched 2026-09-11, **347 plugins**. Saved locally at
`/tmp/claude-1000/-home-mrsir-Lab-joplin-plugin-excalidraw/ab1e065d-0ef3-4054-9db4-307af746ce1d/scratchpad/manifests.json`.

---

## 1. Registry & conflict scan

### 1.1 Every registry plugin matching excalidraw / draw / drawing / sketch / whiteboard / diagram / canvas

Matched against `id`, `name`, `description`, `keywords`, `_npm_package_name`. 11 hits out of 347.

| id | name | ver | author | npm package | repo | `_recommended` |
|---|---|---|---|---|---|---|
| `com.joplin.excalidraw` | joplin-excalidraw | 1.3.0 | SkyfireLee | `joplin-plugin-joplin-excalidraw` | github.com/artikell/joplin-excalidraw | – |
| `com.joplin.excalidraw-v2` | joplin-excalidraw-v2 | 2.0.0 | neagix | `joplin-plugin-joplin-excalidraw-v2` | github.com/neagix/joplin-excalidraw-v2 | – |
| `io.github.personalizedrefrigerator.js-draw` | Freehand Drawing | 4.3.0 | Henry Heino | `joplin-plugin-freehand-drawing` | github.com/personalizedrefrigerator/joplin-draw | **true** |
| `com.github.marc0l92.joplin-plugin-drawio` | Draw.io | 2.2.0 | marc0l92 | `joplin-plugin-drawio` | github.com/marc0l92/joplin-plugin-drawio | – |
| `com.github.marc0l92.joplin-plugin-plantUML` | PlantUML2 | 1.11.0 | marc0l92 | `joplin-plugin-plantuml2` | github.com/marc0l92/joplin-plugin-plantUML | – |
| `com.github.marc0l92.joplin-plugin-bytefield-svg` | bytefield-svg | 1.1.0 | marc0l92 | `joplin-plugin-bytefield-svg` | github.com/marc0l92/joplin-plugin-bytefield-svg | – |
| `net.cwesson.joplin-plugin-typograms` | Typograms | 1.0.3 | Conlan Wesson | `joplin-plugin-typograms` | github.com/cwesson/joplin-plugin-typograms | – |
| `net.cwesson.joplin-plugin-wavedrom` | WaveDrom | 1.0.2 | Conlan Wesson | `joplin-plugin-wavedrom` | github.com/cwesson/joplin-plugin-wavedrom | – |
| `com.github.eugenelesnov.CanvasNotes` | Canvas Notes | 0.8.0 | Eugene Lesnov | `joplin-plugin-canvas-notes` | github.com/eugene-lesnov/joplin-plugin-canvas-notes | – |
| `com.chordpro.renderer` | ChordPro Renderer | 1.0.1 | Joel Ong | `joplin-plugin-chordpro-renderer` | github.com/ongkahyuan/JoplinChordPro | – |
| `com.github.comonduck.2docx` | 2docx | 1.0.0 | comonduck | `joplin-plugin-2docx` | github.com/comonduck/joplin-plugin-2docx | – |

**The registry's `manifests.json` carries no timestamp per plugin.** Fields present across the
whole file are: `_generatedAt`, `_npm_package_name`, `_publish_commit`, `_publish_hash`,
`_recommended`, plus manifest fields. There is **no `_updated_at` / last-published date** —
"last updated" per plugin **could not be verified from the registry file**; the npm registry
(`https://registry.npmjs.org/<pkg>` → `time.modified`) is the place to get that if needed.

`_recommended: true` is set on **30 of 347** plugins. Of the drawing-ish set, only **Freehand
Drawing** is recommended.

### 1.2 Are the two Excalidraw plugins in the registry? Yes — both.

```json
"com.joplin.excalidraw-v2": {
  "manifest_version": 1, "id": "com.joplin.excalidraw-v2", "app_min_version": "2.8",
  "version": "2.0.0", "name": "joplin-excalidraw-v2", "description": "Excalidraw in Joplin",
  "author": "neagix",
  "homepage_url": "https://github.com/neagix/joplin-excalidraw-v2",
  "repository_url": "https://github.com/neagix/joplin-excalidraw-v2",
  "keywords": ["excalidraw"],
  "_publish_hash": "sha256:08137a25840a609c895e0ce40c43bc8503b7ec83f098a3c6ca8c9d9449e9131f",
  "_publish_commit": "main:c00131460da334f0d481589f523e47ce25afc602",
  "_npm_package_name": "joplin-plugin-joplin-excalidraw-v2"
}
"com.joplin.excalidraw": {
  ... "version": "1.3.0", "name": "joplin-excalidraw", "author": "SkyfireLee",
  "repository_url": "https://github.com/artikell/joplin-excalidraw",
  "_npm_package_name": "joplin-plugin-joplin-excalidraw"
}
```

Notes:
- The registry entry for v2 is pinned at `_publish_commit main:c0013146…`, which is
  **neagix's 2025-10-04 "fix: add npm registry URL" commit** — i.e. the registry copy predates
  even the last upstream commit (`441080ee`, 2025-10-26). The published npm package has not been
  refreshed since the initial 2.0.0 release.
- Neither entry declares `categories`, `platforms`, `screenshots` or `license`.
- Both use `app_min_version: "2.8"` and `manifest_version: 1`.

### 1.3 Slava's existing plugins in the registry (the convention to match)

| id | name | ver | npm | `app_min_version` | categories |
|---|---|---|---|---|---|
| `io.github.pmslava.cockpit` | Cockpit | 2.5.1 | `joplin-plugin-cockpit` | 2.9 | productivity, personal knowledge management |
| `io.github.pmslava.harper` | Harper | 1.5.1 | `joplin-plugin-harper` | 3.1 | editor, productivity |
| `io.github.pmslava.ridgeline` | Ridgeline | 0.3.0 | `joplin-plugin-ridgeline` | 3.3 | editor |
| `io.github.pmslava.whereabouts` | Whereabouts | 0.3.0 | `joplin-plugin-whereabouts` | 3.7 | appearance |

(There is also `io.github.copynoteid` / "Copy Note ID" in the registry, npm
`joplin-plugin-copy-note-id` — id does not follow the `io.github.pmslava.*` pattern, authorship
not verified here.)

Slava's manifests consistently include `categories`, `platforms: ["desktop"]`, a rich multi-sentence
`description`, 5–6 `keywords`, and a `screenshots` array of `{src, label}` pointing at
`docs/images/*.png` inside the repo. Example (`io.github.pmslava.ridgeline`):

```json
{
  "manifest_version": 1, "id": "io.github.pmslava.ridgeline", "app_min_version": "3.3",
  "version": "0.3.0", "name": "Ridgeline", "description": "A hover-expanding minimap …",
  "author": "pmslava",
  "homepage_url": "https://github.com/pmslava/joplin-plugin-ridgeline",
  "repository_url": "https://github.com/pmslava/joplin-plugin-ridgeline",
  "keywords": ["outline","minimap","toc","heading","navigation"],
  "categories": ["editor"], "platforms": ["desktop"],
  "screenshots": [{ "src": "docs/images/minimap-editor.png", "label": "…" }, …]
}
```

**Implication for the fork:** the new manifest should gain what the neagix one lacks —
`categories`, `platforms`, `screenshots`, a real `description` — because those are what Slava's
other four plugins do and what makes a registry card look finished.

---

## 2. Upstream status

### `neagix/joplin-excalidraw-v2` (API: `https://api.github.com/repos/neagix/joplin-excalidraw-v2`)

- `created_at` 2025-10-03, **`pushed_at` 2025-10-26T13:58:34Z** — no code pushed in ~10.5 months.
- Last 5 commits on `main`, all by neagix: `441080ee` 2025-10-26 "fix: mention incompatibility with
  Freehand Drawing plugin", `921035ee` 2025-10-04, `c0013146` 2025-10-04, `59e42f8e` 2025-10-04,
  `add3ffd4` 2025-10-04. **All maintainer activity is confined to Oct 2025.**
- `has_issues: true` (issues are enabled), `open_issues_count: 6`, 12 stars, 1 fork, not archived,
  `fork: true` with `parent: artikell/joplin-excalidraw`, license MIT, default branch `main`.
- Open issues: #3 "Mermaid to Excalidraw function not working" (2025-11-12, 0 comments),
  #4 "can't use Insert image" (2025-12-08, 0 comments), #5 "Compatibility for Joplin Mobile?"
  (2026-02-15, 1 comment, last touched 2026-09-08), #7 "Excalidraw inserts text 'Edit 🖊️' after the
  saved image" (2026-06-25, 1 comment), #8 "Excalidraw window does not properly utilize available
  space" (2026-07-23, 0 comments). **None answered by neagix.**
- PRs: #1 (neagix, merged 2025-10-04), **#6 (pmslava, open since 2026-06-07, 7 comments)**,
  #9 (DiegoBM "fix: theme from system preferences", opened 2026-08-17, **closed unmerged**
  2026-08-18).
- **PR #6 has received zero maintainer response.** All 7 comments are between `pmslava` and
  `Akiyamka` (a third-party tester): Akiyamka 2026-06-20, 2026-07-02, 2026-07-03 ×2;
  pmslava 2026-07-02 ×2, 2026-07-09. `neagix` has not commented, reviewed, labelled or merged.
  Last activity on the PR: 2026-07-09, i.e. ~2 months stale.

Conclusion: upstream is **unmaintained but not archived**. Forking under a new name is the only
route that ships; there is no risk of the maintainer "beating" a rename to it, and PR #9 being
closed unmerged a day after opening (by whom was not checked) is the only 2026 event in the repo.

### `artikell/joplin-excalidraw` (v1, the original)

- `created_at` 2022-10-05, **`pushed_at` 2024-05-26T09:20:23Z** — ~2.3 years dormant.
- `has_issues: true`, `open_issues_count: 13`, 49 stars, 7 forks, not archived.
- Still listed in the registry at 1.3.0 (registry is behind the repo's own 1.5.1 changelog line).

---

## 3. Name candidates

### 3.0 What Joplin's plugin search actually matches — VERIFIED, and it changes the advice

`packages/lib/services/plugins/RepositoryApi.ts` (shared by desktop **and** mobile) is the whole
implementation:

```ts
public async search(query: string): Promise<PluginManifest[]> {
	query = query.toLowerCase().trim();
	const manifests = await this.manifests();
	const output: PluginManifest[] = [];
	for (const manifest of manifests) {
		if (this.isBlockedByInstallMode(manifest)) continue;
		for (const field of ['name', 'description'] as const) {
			const v = manifest[field];
			if (!v) continue;
			if (v.toLowerCase().indexOf(query) >= 0) { output.push(manifest); break; }
		}
	}
	output.sort((m1, m2) => {
		const m1Compatible = isCompatible(this.appVersion_, this.appType_, m1);
		const m2Compatible = isCompatible(this.appVersion_, this.appType_, m2);
		if (m1Compatible && !m2Compatible) return -1;
		if (!m1Compatible && m2Compatible) return 1;
		if (m1._recommended && !m2._recommended) return -1;
		if (!m1._recommended && m2._recommended) return +1;
		return m1.name.toLowerCase() < m2.name.toLowerCase() ? -1 : +1;
	});
	return output;
}
```

Consequences, all load-bearing for the naming decision:

- **Only `name` and `description` are searched.** `keywords`, `id`, `author` and `categories` are
  **not**. The plugin-manifest doc's claim that keywords "are used in search in particular" is
  contradicted by the code — **`keywords` is dead weight for in-app discoverability.** (Still worth
  filling in for the plugins website / general tidiness, but it buys nothing in the app.)
- **Case-insensitive contiguous substring** over the *whole trimmed query*, not token matching. A
  user typing `excalidraw` matches; a user typing `excalidraw editor` matches nothing unless that
  exact phrase appears.
- **Ranking is fixed and has no relevance scoring**: compatible-first → `_recommended` → then
  **alphabetical by `name`**. So among all plugins whose description contains "excalidraw", a name
  sorting before `joplin-excalidraw` / `joplin-excalidraw-v2` (i.e. anything starting with a letter
  before `j`) appears *above* both incumbents. That is a small but real, free advantage for
  **E**tch and **I**nkwell over **S**quiggle.
- `SearchPlugins.tsx` is a thin debounced wrapper over this; there is no second client-side filter.
- **Could not verify:** how the separate plugins *website* search at `joplinapp.org/plugins/`
  matches — its source was not located.

**Therefore: the word `excalidraw` must appear literally in the manifest `description`.** That is
the entire discoverability requirement; putting it in the `name` buys only the alphabetical tiebreak
and matching on a sub-phrase of the name itself.

### 3.1 Availability matrix

All npm checks are `GET https://registry.npmjs.org/joplin-plugin-<name>` → **404 = free**.
Registry checks are substring matches on `id` + `name` + `_npm_package_name` across all 347
manifests. GitHub checks are `GET /search/repositories?q=joplin-plugin-<name>+in:name`.

| Candidate | Meaning / why | npm `joplin-plugin-<name>` | Registry id/name | GitHub `joplin-plugin-<name>` repos | Known product collision | Verdict |
|---|---|---|---|---|---|---|
| **Squiggle** | A wobbly hand-drawn line — exactly Excalidraw's rough.js signature look | 404 free | free | 0 results | Squiggle (QURI probabilistic-estimation language, niche), squiggle.city. No registered software mark found. | **Top pick** |
| **Etch** | To draw by scoring a surface; "Etch A Sketch" resonance without the mark | 404 free | free | 0 results | "ETCH A SKETCH" is Spin Master's mark; "Etch" alone is a common verb. balenaEtcher is *Etcher*, not Etch. | **Strong** |
| **Inkwell** | Hand-drawn ink; warm, concrete noun in the style of Cockpit/Ridgeline | 404 free | free | 0 results | Apple "Inkwell" = discontinued Mac OS X 10.2 handwriting feature; no live product. | **Strong** |
| **Chalkline** | Whiteboard/chalkboard + line; whiteboard metaphor is Excalidraw's own self-description | 404 free | free | 0 results | Chalkline Inc. (B2B sports-betting marketing) — unrelated category. | Good; but shares the `-line` suffix with Ridgeline |
| **Penstroke** | A single drawn stroke; fully descriptive of hand-drawn diagrams | 404 free | free | 0 results | None found (bare npm `penstroke` is also 404 — essentially unused everywhere) | Good, slightly bland |
| **Foolscap** | A sheet of paper to draw on; distinctive, unclaimed | 404 free | free | 0 results | Foolscap = Python RPC library (Twisted ecosystem), unrelated | Good; "fool-" reads oddly as a brand |
| **Slate** | A writing/drawing slate — the cleanest whiteboard metaphor, 5 letters | 404 free | free | 0 results | **Slate.js** (very prominent open-source rich-text editor framework), Slate magazine, Slate Auto. High ambiguity inside the JS/editor space. | Avoid |
| **Easel** | The stand a drawing sits on; perfect metaphor, 5 letters | 404 free | free | 0 results | **Easel®** — *registered* mark, Inventables/Easel Software Inc., CNC design software (easel.com, easel.inventables.com). Also easel.ly. | Avoid (live registered mark) |
| **Vellum** | Fine drawing/writing surface | 404 free | free | 0 results | **Vellum** — live commercial macOS book-formatting app ($199–$250, vellum.pub). Adjacent category (writing tools). | Avoid |
| **Scrawl** | Rough hand-drawn marks | 404 free | free | 0 results | **SCRAWL®** registered by Scrawl Inc. for *downloadable browser software and application extensions for annotating online content* — adjacent category. | Avoid |
| Doodle | Casual sketch | 404 free | free | not checked | Doodle.com (scheduling), Google Doodle | Avoid |
| Napkin | Napkin sketch | 404 free | free | not checked | napkin.ai — an AI *diagramming* product, i.e. the same category | Avoid |
| Sketchpad / Whiteboard / Scratchpad / Chalkboard / Stencil / Whimsy / Cartouche / Tracepaper / Sketchline | (checked for completeness) | all 404 free | all free | not checked | Sketchpad/Whiteboard are generic, not brandable; Stencil = Stencil.js (Ionic) | — |

Descriptive alternatives keeping the word:

| Candidate | npm | Registry | Note |
|---|---|---|---|
| `Excalidraw Board` (npm `joplin-plugin-excalidraw-board`) | 404 free | free | Free, but see trade-off below |
| `Excalidraw` (npm `joplin-plugin-excalidraw`) | **404 free** — the name `joplin-plugin-excalidraw` is *unclaimed*; the two existing plugins sit on `joplin-plugin-joplin-excalidraw` and `joplin-plugin-joplin-excalidraw-v2` | registry `name` "joplin-excalidraw"/"joplin-excalidraw-v2" exist, plain "Excalidraw" does not | Maximal discoverability, maximal brand-confusion risk |
| `Excalidraw Studio` / `Excalidraw Notes` | not checked | free | Same trade-off |

### 3.2 The "keep Excalidraw in the name" trade-off

**For:** in-app plugin search is the only discovery surface most Joplin users ever touch, and users
look for the tool by the name of the upstream product ("excalidraw"), not by a brand they've never
heard of. There are already two entries with "excalidraw" in the *name*; a third that omits it
ranks purely on description/keywords matching.

**Against:**
1. **Brand collision with the two incumbents.** A third registry row called "Excalidraw *something*"
   sitting next to "joplin-excalidraw" and "joplin-excalidraw-v2" reads as a confusing third fork,
   not as a successor. A distinct one-word brand is the *only* thing that visually separates
   Slava's version from two abandoned ones.
2. **Consistency with the existing four plugins** (Cockpit / Whereabouts / Ridgeline / Harper). A
   descriptive fifth name breaks a set that reads as a coherent product line.
3. **Trademark/name-usage of "Excalidraw"** — see §4 for the verified finding. Even without a formal
   policy, using another project's product name as the *leading* word of your own product name is
   the classic pattern that invites a takedown request; "for Excalidraw" / "Excalidraw support"
   phrasing inside the *description* is nominative use and is normal and safe.

**Recommended resolution:** brand name in `name`, **"Excalidraw" as an early word of the
`description`** (this is the part that actually does the work — see §3.0), keywords filled in
anyway for the website, and "Excalidraw" in the GitHub repo description and README H1 subtitle.
This gets full search coverage without the brand collision. Slava already ships this pattern —
Ridgeline's manifest description is a full sentence naming "minimap", "table of contents", etc.

Concretely, something like:

```json
"name": "Squiggle",
"description": "Excalidraw drawings inside your notes: create and edit hand-drawn sketches, diagrams and whiteboards without leaving Joplin. Theme-aware, saves an SVG preview next to the source.",
"keywords": ["excalidraw","drawing","sketch","diagram","whiteboard","svg"],
"categories": ["editor","integrations"],
"platforms": ["desktop"]
```

A precedent already in the registry for exactly this shape: `com.github.marc0l92.joplin-plugin-drawio`
ships under the display name **"Draw.io"** with description "Draw.io (aka Diagram.net) integration
for Joplin" — i.e. third-party integrations do put the upstream product name front and centre in
this registry, and have gone unchallenged.

### 3.3 Top 3, in order

**1. Squiggle** — `io.github.pmslava.squiggle` / `pmslava/joplin-plugin-squiggle` /
`joplin-plugin-squiggle`. Everything is free: npm 404, no registry id or name collision, zero
GitHub repos named `joplin-plugin-squiggle`, and no registered software trademark surfaced. The
word describes *precisely* what makes Excalidraw recognisable — the deliberately wobbly, rough.js
hand-drawn stroke — so the name explains the product to anyone who has seen an Excalidraw drawing,
which is exactly the trick "Ridgeline" and "Cockpit" pull off. Eight lowercase letters, no
ambiguous spelling, no hyphen, trivially typed. The only real cost is that "squiggle" is playful
where "diagram tool" is serious; that reads as a feature for a plugin whose entire aesthetic is
deliberately informal.

**2. Etch** — `io.github.pmslava.etch` / `joplin-plugin-etch`. The shortest and most typeable
option at four characters, and a real drawing verb rather than a metaphor once removed. The "Etch
A Sketch" echo is an asset: it primes exactly the right mental image (hand-drawn, playful, a board
you draw on) while the mark itself belongs to the three-word phrase, not to "etch", which is an
ordinary English verb that cannot be monopolised for a note-taking plugin. npm, registry and GitHub
are all clear. The downside is discoverability in reverse: "etch" is such a common word that
searching the web for "joplin etch" will surface noise, and the name carries no whiteboard or
diagram signal on its own — it leans harder on the description doing the work.

**3. Inkwell** — `io.github.pmslava.inkwell` / `joplin-plugin-inkwell`. A concrete, slightly
old-fashioned object noun, which is the exact register of Cockpit and Ridgeline, and it evokes the
ink-on-paper look of an Excalidraw export. All three namespaces are free and the only collision is
Apple's Inkwell, a handwriting-recognition feature discontinued with Mac OS X more than fifteen
years ago — dead brand, no live product, no enforcement risk. It ranks third only because "inkwell"
points at *writing* slightly more than at *drawing*, so it needs the description to carry the
"drawings and diagrams" message, and because it is the least distinctive of the three in a plugin
list already containing "Freehand Drawing".

Runner-up worth keeping on the shortlist: **Chalkline** (free everywhere, whiteboard metaphor,
unrelated-category company only) — demoted because it repeats Ridgeline's `-line` ending.

**Tiebreak footnote (§3.0):** among plugins matching a search, ranking after compatibility and
`_recommended` is plain alphabetical by `name`. Searching "excalidraw", the incumbents sort under
`j` ("joplin-excalidraw", "joplin-excalidraw-v2"). **Etch** (E), **Inkwell** (I) and **Chalkline**
(C) would therefore be listed *above* both abandoned plugins; **Squiggle** (S) would be listed
*below* them. That is a real, free advantage — worth perhaps one rank, not enough to displace
Squiggle's much better fit to the product, but decisive if the top two are otherwise a coin flip.

### 3.4 Verification gaps in §3

- **Joplin forum sanity check was partial.** A forum search surfaced only the existing Excalidraw
  threads (`discourse.joplinapp.org/t/excalidraw-plugin-v2/47465`,
  `…/plugin-support-excalidraw-in-joplin/27686`). Individual candidate names were **not** each
  searched on the forum; the registry `manifests.json` scan is the authoritative collision check
  and it is clean for every candidate.
- **npm "last modified" dates** for the two incumbent packages were not fetched.
- Trademark checks were web searches, **not** USPTO/EUIPO register lookups. Treat the "Avoid"
  verdicts as risk signals, not legal conclusions.

---

## 4. Publishing mechanics for a renamed fork

### 4.1 How the registry actually ingests plugins (npm scan, not PRs)

`joplin/plugins` is rebuilt by a GitHub Action running `@joplin/plugin-repo-cli build`.

- Workflow `https://github.com/joplin/plugins/blob/master/.github/workflows/update-repo.yml` —
  `cron: "*/30 * * * *"` plus `workflow_dispatch`. The README states it plainly: *"It is updated
  every 30 minutes on the hour and half-hour."* **→ a new plugin appears in-app within ~30 minutes
  of a successful `npm publish`, with no human review.**
- Discovery (`packages/plugin-repo-cli/lib/searchPlugins.ts`):
  `https://registry.npmjs.org/-/v1/search?text=keywords:joplin-plugin&size=100&from=<n>`, paged.
- Filter (`packages/plugin-repo-cli/lib/utils.ts`):

  ```ts
  export function isJoplinPluginPackage(pack: { keywords?: string[]; name: string }): boolean {
      if (!pack.keywords || !pack.keywords.includes('joplin-plugin')) return false;
      if (stripOffPackageOrg(pack.name).indexOf('joplin-plugin') !== 0) return false;
      return true;
  }
  ```

  Both conditions required: the `joplin-plugin` **keyword** and a package **name** starting with
  `joplin-plugin` (a scope like `@pmslava/joplin-plugin-x` is allowed — the org is stripped).
- Ingestion (`packages/plugin-repo-cli/index.ts`): `npm install <pkg> --save --ignore-scripts`, then
  it reads `node_modules/<pkg>/publish/` and takes **the first `.json` and the first `.jpl`** found
  there. Output lands at `plugins/<manifest.id>/manifest.json` + `plugins/<manifest.id>/plugin.jpl`,
  and the manifest is merged into `manifests.json` with `_npm_package_name` injected.
  **→ `publish/` must be inside the npm tarball, and must hold exactly one `.json` and one `.jpl`.**
  **→ `--ignore-scripts` means a `postinstall` build will not run; use `prepare` (webpack warns
  about this too).**
- There is **no blocklist/allowlist data file**. Repo root is only `README.md`, `manifests.json`,
  `manifestOverrides.json`, `stats.json`, `plugins/`, `readme/`, `.github/`.
- **PRs are essentially not accepted.** `.github/pull_request_template.md`: *"In general, WE DO NOT
  ACCEPT ANY PULL REQUEST ON THIS REPOSITORY! … Currently we accept pull requests for this specific
  case only: To mark a plugin as obsolete."*

### 4.2 The ownership check — why a new id is mandatory

`packages/plugin-repo-cli/lib/checkIfPluginCanBeAdded.ts`, matching **case-insensitively on
manifest `id`**:

```ts
if (originalManifest._npm_package_name !== manifest._npm_package_name) {
    throw new Error(`Plugin "${manifest.id}" from npm package "${manifest._npm_package_name}" has already been published under npm package "${originalManifest._npm_package_name}". …`);
}
…
if (originalRepo && (!newRepo || originalRepo !== newRepo)) {
    throw new Error(`Plugin "${manifest.id}" from repository "${manifest.repository_url}" has already been published under repository "${originalManifest.repository_url}".`);
}
…
if (originalManifest.id !== manifest.id) {
    throw new Error(`Plugin "${manifest.id}" cannot be published because there is already a plugin with ID "${originalManifest.id}". A new package, under a different name, should be published if the plugin ID needs to change.`);
}
```

`normalizeRepoUrl` lowercases and strips `https://`, `www.`, `github.com/`, `.git` and a trailing
slash — so `github.com/pmslava/X` ≠ `github.com/neagix/X`.

**Consequence:** publishing under `com.joplin.excalidraw-v2` from Slava's npm package would be
rejected on **all three** checks. A new `id` + a new npm package name is the only path.
Corollary: once ingested, **`repository_url` is frozen** — changing it later permanently blocks
updates for that id. Pick the final repo URL before the first publish.

The upstream comment explains the design: *"if a plugin is removed from npm, it's not possible to
highjack it by creating a new npm package with the same plugin ID."*

### 4.3 Rules about forks, duplicates and attribution

- **De-duplication is on `id` only.** There is no check on `name`, `description` or `keywords`, and
  no spam heuristic in the code. A third Excalidraw plugin is structurally fine.
- **Forks are demonstrably accepted.** Live examples in today's `manifests.json`, all with a fresh
  id, a fresh npm name and explicit attribution *in the description*:
  - `com.victorwiebe.embed-search-notebook-grouping` — name "Embed Search (Notebook Grouping Fork)",
    description "…Fork of ambrt's Embed Search plugin…"
  - `com.victorwiebe.joplin.plugin.gtd-calendar` — "A GTD-friendly fork of Event Calendar by Franco
    Speziali."
  - `io.github.pb-strawberries.habit-tracker-plus` — "Independent, AI-assisted fork of Daily Habits
    by pulsarnomada9 (MIT) - see README for credit and details."
  - `com.plugin.randomNoteReloadedPlugin` — `author` is literally `"Fork: Marph, Original: Azamah Junior"`.

  **→ Naming the origin in the `description` is the established community norm, not an enforced
  rule.** It is also free discoverability, since `description` *is* searched.
- **Obsoleting / superseding** are the only human-in-the-loop levers, both via PR to
  `manifestOverrides.json`:
  - `readme/obsoletes.md` — move the block to `manifestOverrides.json` with `"_obsolete": true`
    (+ optional `"_obsolete_reason"`): *"Marking a plugin as obsolete means it will no longer show
    up in search results."* Listed reasons include **"Plugins that have been superseded by a
    different, better plugin."** This is the mechanism if Slava ever wants the abandoned v2 entry
    hidden — but that is a request about *someone else's* plugin and should not be filed unilaterally.
  - `readme/superseded.md` — `"_superseded_package"` in the override plus changing
    `_npm_package_name` in `manifests.json` reassigns an existing id's update source to a different
    npm package. **This is the sanctioned way to take over an existing plugin id**, and one of the
    few PR types the repo accepts — but it effectively needs neagix's cooperation or a maintainer's
    judgement call. A fresh id is the low-friction route.

### 4.4 `_recommended`

`readme/recommended.md`: *"Those are the plugins recommended by the Joplin team because they meet
our standards for security and performance. Currently there is no review process so the selected
plugins are those developed by either the Joplin team or by frequent contributors."*

- Granted **only** by a Joplin-team edit to `manifestOverrides.json` (30 of 347 today).
- Self-setting is rejected: `validateUntrustedManifest.ts` throws
  `Plugin ${manifest.id} cannot mark itself as recommended.`
- Effects: sorts above non-recommended in search, **and it is the install gate on iOS**
  (`isBlockedByInstallMode()` under `InstallMode.Restricted`, which mobile sets for iOS).
  Not recommended → invisible and uninstallable on iOS. Irrelevant here: this plugin is
  `platforms: ["desktop"]`.

### 4.5 Manifest fields — exact checklist for the rename

Reference: `https://joplinapp.org/help/api/references/plugin_manifest/`.

| Field | Req. | Change to | Notes |
|---|---|---|---|
| `manifest_version` | **yes** | `1` (unchanged) | "For now should always be 1" |
| `id` | **yes** (enforced in code, *absent from the docs table*) | **NEW**, e.g. `io.github.pmslava.squiggle` | See rules below |
| `name` | **yes** | **NEW** brand, e.g. `Squiggle` | "user-friendly string, as it will be displayed in the UI"; **is searched** |
| `version` | **yes** | see §4.6 | `^[0-9a-zA-Z-.]+$`, ≤64, must start & end alphanumeric |
| `app_min_version` | **yes** | **raise from `2.8`** | See §4.7 |
| `app_min_version_mobile` | no | omit | desktop-only plugin |
| `platforms` | no | `["desktop"]` | matches Slava's other four; also the default |
| `description` | no (but critical) | **NEW**, must contain the literal `excalidraw` | the only real search surface besides `name` |
| `author` | no | `pmslava` | matches the other four |
| `homepage_url` | no | `https://github.com/pmslava/joplin-plugin-<name>` | |
| `repository_url` | no per docs, **de-facto load-bearing** | `https://github.com/pmslava/joplin-plugin-<name>` | frozen after first ingestion |
| `keywords` | no | `["excalidraw","drawing","sketch","diagram","whiteboard","svg"]` | **not searched in-app** (§3.0); website only |
| `categories` | no | `["editor","integrations"]` (or `["editor"]`) | closed vocabulary, see below |
| `screenshots` | no | `[{src:"docs/images/*.png", label:"…"}]` | needs `repository_url`/`homepage_url` to be a GitHub repo for the website to show them |
| `icons` | no | PNG only, keys `16`/`32`/`48`/`128`, paths relative to repo root | "at least a main icon, ideally 48x48 px" |
| `promo_tile` | no | **exactly 440×280**, JPEG or PNG, **no alpha** | website listing |

**`id` rules** (`packages/lib/services/plugins/utils/validatePluginId.ts`): non-empty; **≥ 16
characters** (only `Outline`, `outline`, `MyPlugin` are grandfathered); ≤ 256; charset
`0-9a-zA-Z._-`; must start *and* end with an alphanumeric. It is used as a filesystem directory
name and as the object key in `manifests.json`. All three recommended ids pass:
`io.github.pmslava.squiggle` (26), `io.github.pmslava.etch` (22), `io.github.pmslava.inkwell` (25).

**`categories` allowed values** — closed vocabulary, hard-enforced by `validateCategories()` in
`webpack.config.js` (throws on unknown or duplicate; must be lowercase). The list is in the local
`webpack.config.js` verbatim:

```js
const allPossibleCategories = ['appearance', 'developer tools', 'productivity', 'themes',
  'integrations', 'viewer', 'search', 'tags', 'editor', 'files',
  'personal knowledge management'];
```

**Registry-injected private fields** (do not hand-write): `_publish_hash` (sha256 of the .jpl,
written by the local webpack), `_publish_commit` (`branch:sha`, from local git), `_npm_package_name`
(injected by the CLI), and override-only `_recommended`, `_obsolete`, `_obsolete_reason`,
`_superseded_package`.

### 4.6 Version: reset or continue?

**Nothing in the registry forces either.** The id is new, so there is no version-monotonicity
constraint inherited from `com.joplin.excalidraw-v2`. Both are defensible:

- **Continue at `2.1.0` / `3.0.0`** — preserves the lineage, signals "this is where v2 went", and
  makes the changelog continuous. Risk: users see a "2.x" first release of a brand-new plugin and
  reasonably ask what 1.x was.
- **Reset to `1.0.0`** — matches how Slava's own plugins started (Ridgeline and Whereabouts are
  still `0.3.0`, Harper `1.5.1`, Cockpit `2.5.1`), and reads honestly as "first release of this
  plugin". The lineage lives in the README and the changelog instead.

**Recommendation: reset to `1.0.0`** (or `0.9.0` if a beta window is wanted), and keep
`changelog.md` intact with the full artikell → neagix → pmslava history above the new entry. It is
a new plugin id with a new name; pretending otherwise only confuses the version story. Note
`package.json.version` and `manifest.json.version` must match — the release workflow reads the
version from `package.json` (`jq -r .version package.json`) while the `.jpl`/registry version comes
from the manifest.

### 4.7 `app_min_version`

Currently `"2.8"` (inherited from artikell's 2022 plugin). That is almost certainly wrong for this
branch: the code uses `joplin.window.loadChromeCssFile()`, CodeMirror **6** `editor.execCommand`
registration, `joplin.workspace.filterEditorContextMenu`, and relies on the Rich-Text-Editor asset
loading added by laurent22/joplin#12106 (merged 2025-04-17). **Raise it.** Slava's own recent
plugins use `3.1`–`3.7`. A concrete floor was **not verified** in this pass — determine it by
checking when `loadChromeCssFile` and RTE asset loading landed, then set `app_min_version` to that
release. Setting it too low is worse than too high: `isCompatible()` only demotes incompatible
plugins in search ranking, it does not stop a broken install.

### 4.8 package.json

```jsonc
{
  "name": "joplin-plugin-<name>",     // MUST start with joplin-plugin-
  "version": "1.0.0",                  // must match manifest.json
  "license": "MIT",
  "keywords": ["joplin-plugin", "excalidraw"],   // MUST include "joplin-plugin"
  "files": ["publish"],                // puts publish/ in the tarball; overrides .npmignore
  "author": "pmslava",
  "repository": { "type": "git", "url": "https://github.com/pmslava/joplin-plugin-<name>" },
  // no "postinstall" script — the registry installs with --ignore-scripts; use "prepare"
}
```

The canonical statement of the publish conditions is in `GENERATOR_DOC.md` ("Publishing the
plugin"), **not** in the getting-started page: run `npm publish`; the registry picks it up as long
as the package name starts with `joplin-plugin-`, the keywords include `joplin-plugin`, and
`publish/` contains a `.jpl` and a `.json`. `webpack.config.js`'s `validatePackageJson()` warns
about all three plus `postinstall`.

Note `https://joplinapp.org/help/api/get_started/plugins/` covers only env setup, `yo joplin`,
`npm run dist` and dev-mode install — **it has no publishing section at all**. It does warn: *"You
can edit this at any time, but editing it after it has been published may cause users to have to
download it again."*

**Blocker in the current state:** `package.json.name` is `joplin-plugin-joplin-excalidraw-v2`,
which is **taken on npm by neagix** — `npm publish` would fail with 403. The rename is not optional.

### 4.9 Does the `.jpl` filename / `publish/` folder depend on the id? — YES for the `.jpl`, NO for the folder

`/home/mrsir/Lab/joplin-plugin-excalidraw/webpack.config.js`:

```js
const publishDir = path.resolve(rootDir, 'publish');
const manifest = readManifest(manifestPath);
const pluginArchiveFilePath = path.resolve(publishDir, `${manifest.id}.jpl`);
const pluginInfoFilePath = path.resolve(publishDir, `${manifest.id}.json`);
```

- The **folder name `publish/` is hard-coded** and never changes.
- The **two filenames inside it are `${manifest.id}.jpl` and `${manifest.id}.json`**. Today that is
  `publish/com.joplin.excalidraw-v2.jpl`. Changing `src/manifest.json`'s `id` renames both
  automatically; **no other file in the repo references the archive name**, and
  `.github/workflows/build-release.yaml` globs it (`ls publish/*.jpl`), so the workflow needs no
  edit. `buildMain` wipes `dist/` and `publish/` first and `onBuildCompleted()` removes
  `publish/index.js`, so no stale artifact can survive to confuse the "first .jpl found" ingester.
- Downstream, the registry serves the archive as `plugins/<id>/plugin.jpl` and as a GitHub release
  asset named `<id>@<version>.jpl` (`RepositoryApi.assetFileUrl` splits on `@` and pops the last
  segment to recover the id) — **so the id must not contain an `@`.**
- The `.jpl` itself is a plain tar of `dist/**/*`; only contents matter, not names.
- `plugin.config.json` (`extraScripts: ["contentScripts/markdownIt.ts", "contentScripts/codeMirror.ts"]`)
  is unaffected by an id rename — paths are relative to `src/`, each compiled by a separate webpack
  pass to `dist/<same path>.js`.

### 4.10 MIT / credits obligations

- Upstream `LICENSE` is **MIT, `Copyright (c) 2025 neagix`**. MIT §"The above copyright notice and
  this permission notice shall be included in all copies or substantial portions of the Software" —
  **the neagix copyright line must stay in `LICENSE`.** Add Slava's own line alongside it, e.g.:

  ```
  MIT License

  Copyright (c) 2025 neagix
  Copyright (c) 2026 pmslava
  ```

  Do **not** replace the neagix line. artikell's original v1 had no separate LICENSE line carried
  into this repo (the file names only neagix); the artikell lineage is acknowledged in the README
  instead, which is where it should stay, plus a line for the v1 code that survives.
- Bundled `@excalidraw/excalidraw@0.18.1` is also MIT (`Copyright (c) 2020 Excalidraw`). Since the
  library is **bundled into the .jpl**, its MIT notice should be shipped too — the README already
  says "The excalidraw library is bundled into the plugin, together with fonts and assets"; add the
  Excalidraw copyright/notice to a `THIRD-PARTY` section or file. Fonts (Excalifont, Xiaolai) carry
  their own licences in the upstream package headers.
- Retain the existing README credits: artikell (original), ThibaultJanBeyer/joplin-sheets, @Winbee
  (vite refactor), @smallzh (SVG preview). Add neagix (v2) and @Akiyamka (PR #6 testing).

### 4.11 "Excalidraw" name / trademark — what exists

- **The library is MIT** (`https://raw.githubusercontent.com/excalidraw/excalidraw/master/LICENSE`,
  "Copyright (c) 2020 Excalidraw"; npm `@excalidraw/excalidraw@0.18.1` `"license": "MIT"`).
  **MIT grants no trademark rights** — it is a copyright licence and is silent on names and marks.
- **No `TRADEMARK.md` and no brand/naming guidelines in the repo.** The root of
  `excalidraw/excalidraw@master` contains only `LICENSE`, `README.md`, `CONTRIBUTING.md`,
  `AGENTS.md`, `CLAUDE.md`, `dev-docs/`. A code search for `trademark` in that repo returns exactly
  2 hits, both font-licence headers (`packages/excalidraw/fonts/Excalifont/index.ts`,
  `.../Xiaolai/index.ts`). The README has no trademark or naming section.
- **A trademark claim does exist on the commercial side.** `https://plus.excalidraw.com/terms-of-service`,
  operated by **Excalidraw s.r.o.** (Brno, Czech Republic), asserts that "the trademarks, service
  marks, and logos contained therein (the 'Marks') are owned or controlled by us or licensed to us"
  and that no Content or Marks may be "copied, reproduced, aggregated, republished … or otherwise
  exploited for any commercial purpose whatsoever, without our express prior written permission."
  By its own scope that clause governs the *website*, not the MIT-licensed library — but it is an
  explicit assertion of ownership over the name and logo.
- A web search surfaced a claim that "Excalidraw S.r.o. has 1 trademark application for
  'EXCALIDRAW'" via uspto.report. **Could not verify** — `https://uspto.report/company/Excalidraw-S-R-O`
  returned HTTP 403. Serial number, class and status are unconfirmed.

**Practical read:** no published policy forbids or permits third-party naming, so *nominative*
use — "Excalidraw drawings in Joplin", "powered by Excalidraw", the word inside a `description` —
is the low-risk framing, and is what every comparable integration does. A product whose *name*
leads with "Excalidraw" reads as first-party and is the higher-risk framing. Precedent is
permissive in both directions: the VS Code marketplace lists `pomdtr.excalidraw-editor` (linked
from Excalidraw's own README as "VScode extension"), and `com.joplin.excalidraw` /
`com.joplin.excalidraw-v2` have stood in the Joplin registry unchallenged for years. **This
reinforces the §3.2 recommendation:** brand name in `name`, Excalidraw in `description`.

### 4.12 The publish checklist, in order

1. `git mv` / rename the GitHub repo to `pmslava/joplin-plugin-<name>`; set its GitHub description
   to mention Excalidraw. **This URL is frozen after first ingestion — decide now.**
2. `src/manifest.json`: new `id`, `name`, `description` (containing `excalidraw`), `author`,
   `homepage_url`, `repository_url`, `keywords`, add `categories`, `platforms: ["desktop"]`,
   `screenshots`; raise `app_min_version`; set `version` (recommend `1.0.0`).
3. `package.json`: `name` → `joplin-plugin-<name>`, matching `version`, keep
   `keywords: ["joplin-plugin", …]` and `files: ["publish"]`, add `repository`/`author`.
4. Rename the internal identifiers that would otherwise collide with the old plugin (§5.3):
   content script ids, CSS classes + the literal in `markdownIt-content.js`, command names, view
   ids, Tools submenu label, settings section id + label, temp folder name. **Do not touch the
   note-level markup or the resource title prefix (§5.2).**
5. `LICENSE`: keep the neagix copyright line, add Slava's.
6. README: rewrite the H1/intro for the new brand, add the migration note (§5.4) and the credits.
7. `npm run dist` → verify `publish/` contains exactly `<new-id>.jpl` and `<new-id>.json` and
   nothing else.
8. Install the `.jpl` locally and test against a note that already contains a v2 drawing **and** a
   v1 `excalidraw://` drawing, with the old plugin **uninstalled**.
9. `npm publish` (the existing `.github/workflows/build-release.yaml` already does this on push to
   `main` when the release tag doesn't exist — it needs the `NPM_TOKEN` secret set on the new repo).
10. Wait ≤30 minutes, then confirm the entry appears in
    `https://raw.githubusercontent.com/joplin/plugins/master/manifests.json` and that searching
    "excalidraw" in Tools → Options → Plugins finds it.
11. Announce on the Joplin forum (Plugins category); the existing threads
    `discourse.joplinapp.org/t/excalidraw-plugin-v2/47465` and `…/27686` are where the audience is.

---

## 5. Compatibility & migration for existing users

### 5.1 How a drawing is stored (verified from source)

Files: `/home/mrsir/Lab/joplin-plugin-excalidraw/src/resources.ts`,
`/home/mrsir/Lab/joplin-plugin-excalidraw/src/index.ts`,
`/home/mrsir/Lab/joplin-plugin-excalidraw/src/contentScripts/markdownIt.ts`,
`/home/mrsir/Lab/joplin-plugin-excalidraw/src/contentScripts/markdownIt-content.js`.

**Two resources per drawing, linked by a naming convention, not by metadata.**

`src/resources.ts`:

```ts
const Config = {
    TempFolder: `${tmpdir}${sep}joplin-excalidraw-plugin${sep}`,
    TitlePrefix: 'excalidraw-'
}
```

`createDiagramResource(jsonResourceId, dataJson, dataSvg)`:
- writes `excalidraw-<jsonResourceId>.json` and POSTs it as a resource **with an explicitly forced
  id**: `joplin.data.post(['resources'], null, { id: jsonResourceId, title: jsonFn }, …)`.
- writes `excalidraw-<jsonResourceId>.svg` (note: **the SVG's filename carries the JSON resource
  id**, not its own) and POSTs it with a *different*, freshly generated id `svgResourceId`.
- returns `svgResourceId`.

So the invariant is:

> **SVG resource title == `excalidraw-` + `<jsonResourceId>` + `.svg`.**
> The JSON resource id is recovered by stripping the `excalidraw-` prefix and the extension from
> the *SVG resource's title*.

`getDiagramResource(svgResourceId)` does exactly that:

```ts
let resourceData = await joplin.data.get(['resources', resourceId], { fields: ['id', 'title'] });
const jsonResourceId = resourceData.title
    .slice(0, resourceData.title.lastIndexOf('.'))
    .slice(Config.TitlePrefix.length);
const data = await joplin.data.get(['resources', jsonResourceId, 'file']);
```

`updateDiagramResource(svgResourceId, …)` re-derives the same way and PUTs both resources,
re-writing both titles to the same convention.

Resource ids are 32 hex chars: `uuidv4().replace(/-/g, '')` (`generateId()`).

**Note body markup (v2):**

```ts
function diagramMarkdown(diagramId: string) {
  return `![excalidraw.svg](:/${diagramId})`
}
```

i.e. `![excalidraw.svg](:/<svgResourceId>)` — a **standard Joplin resource link**. The alt text
`excalidraw.svg` is the marker the renderer keys on.

**Legacy v1 format:** `![excalidraw](excalidraw://<jsonResourceId>)`. The alt text is `excalidraw`
and the URL is a custom `excalidraw://` scheme pointing straight at the *JSON* resource, with no
SVG at all. `excalidraw://` URLs cannot be loaded as an image, so the markdown-it renderer swaps in
a base64 Excalidraw logo placeholder and tags the `<img>` with
`class="excalidraw--convertible" data-excalidraw-diagram-id="<jsonResourceId>"`.

**The Convert path** (`src/index.ts`, message prefix `convert_v1_`):
1. content script posts `convert_v1_<jsonResourceId>`;
2. `duplicateV1DiagramAsV2()` reads the old JSON resource's bytes, generates a **new** JSON resource
   id, and calls `createDiagramResource()` with a hard-coded `convertedSvgPlaceholder` SVG that
   literally reads "Edit & Save to update this SVG preview" — the v1 original is **never modified**
   (comment in source: "cannot modify the existing resource because multiple notes might be using
   it");
3. the plugin then rewrites the note body in place via `joplin.data.put(['notes', note.id], …)`,
   replacing `![excalidraw](excalidraw://<id>)` with `![excalidraw.svg](:/<newSvgId>)`.

**Renderer contract** (`markdownIt.ts`): it overrides `markdownIt.renderer.rules.image` and
dispatches purely on `token.content` (the alt text): `'excalidraw'` → v1 convertible,
`'excalidraw.svg'` → v2 editable. It adds only CSS classes (`excalidraw--editable` /
`excalidraw--convertible`); all behaviour is attached at view time by the asset
`markdownIt-content.js`, because Joplin's Rich Text Editor CSP (laurent22/joplin#12106) kills inline
`on*` handlers. The asset hard-codes the channel id:

```js
// Must match Config.ContentScriptId in src/index.ts.
var contentScriptId = 'excalidraw-script';
```

### 5.2 What a renamed plugin MUST keep byte-identical

Everything below is written into the user's notes or resources and is therefore **data format**,
not implementation detail. Changing any of it orphans existing drawings.

1. **The markdown link shape** `![excalidraw.svg](:/<svgResourceId>)` — the alt text literal
   `excalidraw.svg` **must not change** (e.g. not to `![squiggle.svg]`). It is both what the
   renderer dispatches on and what `excalidrawSvgIds()` in `index.ts` regex-matches:
   `/!\[excalidraw\.svg\]\(:\/([a-zA-Z0-9]+)\)/g`.
2. **`Config.TitlePrefix = 'excalidraw-'`** and the `excalidraw-<jsonResourceId>.svg` /
   `.json` resource-title convention — this is the *only* link between the two resources. Renaming
   the prefix breaks `getDiagramResource()` for every pre-existing drawing.
3. **The legacy v1 recognition** (alt text `excalidraw`, `excalidraw://` scheme) and the Convert
   path, so users coming from artikell's v1 are still served.
4. **Resource id format** (32 hex chars, no dashes) and the forced-id POST for the JSON resource.

Safe to change freely: the settings section id and keys, the content script ids, the command names,
the toolbar/menu ids, the temp folder name, the CSS class names (`excalidraw--editable` etc. are
re-generated on every render and never persisted — *except* see the RTE caveat below), the plugin
id, the npm package name, the `.jpl` name.

> **RTE caveat:** `markdownIt-content.js` deliberately marks processed images with the
> `image.ondblclick` property rather than a class or data-attribute, "unlike a data-attribute or a
> class, the Rich Text Editor does not serialise it back into the note content". Keep that
> approach; the classes added by the renderer *are* re-added on each render, so they are not
> persisted state.

### 5.3 What happens if BOTH the old and new plugin are installed

Confirmed from Joplin source. This is the single strongest argument for a prominent "uninstall the
old one" note.

**a) Content script id collision — messages can be routed to the wrong plugin.** Content script ids
are chosen by the plugin author and are *not* namespaced by plugin id. Both plugins would register
`'excalidraw-script'`. `packages/lib/services/PostMessageService.ts`:

```ts
if (message.from === MessageParticipant.ContentScript && message.to === MessageParticipant.Plugin) {
    const pluginId = PluginService.instance().pluginIdByContentScriptId(message.contentScriptId);
    if (!pluginId) throw new Error(`Could not find plugin associated with content script "${message.contentScriptId}"`);
    response = await PluginService.instance().pluginById(pluginId).emitContentScriptMessage(message.contentScriptId, message.content);
}
```

and `packages/lib/services/plugins/PluginService.ts`:

```ts
public pluginIdByContentScriptId(contentScriptId: string): string {
    for (const pluginId in this.plugins_) {
        const plugin = this.plugins_[pluginId];
        const contentScript = plugin.contentScriptById(contentScriptId);
        if (contentScript) return pluginId;
    }
    return null;
}
```

It returns the **first** plugin found iterating `this.plugins_` — an arbitrary winner. An Edit click
rendered by the new plugin can be handled by the old plugin's dialog, and vice versa.
**→ Rename the content script ids** (e.g. `squiggle-script`, `squiggle-codemirror`) and update the
matching literal in `markdownIt-content.js`.

**b) Duplicate markdown-it rule — double-wrapping.** Both plugins' markdown-it plugins chain onto
`markdownIt.renderer.rules.image`. Each one calls the previous renderer and then does
`defaultHtml.replace('<img ', '<img class="excalidraw--editable" ')`, so the `<img>` ends up with
the class twice and *both* assets run `processImages()` on it. The asset's re-entrancy guard is
per-file-instance (`if (image.ondblclick === handler) return;` — `handler` is a different function
object in each copy), so **two Edit buttons** are appended to the same image, each posting on the
same colliding channel id. This matches the already-reported upstream symptom class (issue #7,
"Excalidraw inserts text 'Edit 🖊️' after the saved image").
**→ Rename the CSS classes too** (`squiggle--editable`, `squiggle--convertible`,
`squiggle--editButton`, `squiggle--editButtonContainer`) so each plugin only ever sees its own tags.

**c) Command name collision — last writer wins, silently.** Joplin's `CommandService` keys commands
by bare name in a global map, with no per-plugin namespace and no duplicate check
(`packages/lib/services/CommandService.ts`):

```ts
public registerDeclaration(declaration: CommandDeclaration) {
    declaration = { ...declaration };
    …
    this.commands_[declaration.name] = { declaration: declaration, …
```

and `registerRuntime()` does `command.runtime = runtime` unless `allowMultiple` (plugins do not pass
it). So `addExcalidraw` / `editExcalidraw` registered by both plugins resolve to whichever loaded
last. **→ Rename the commands** (`squiggleAdd`, `squiggleEdit`).

**d) Toolbar button and Tools submenu — duplicated.** `joplin.views.toolbarButtons.create('addExcalidraw', …)`
and `joplin.views.menus.create('excalidrawMenu', 'Excalidraw', …)` are per-plugin view ids, so both
plugins create their own: the user sees **two identical pencil toolbar buttons** and **two Tools →
Excalidraw submenus**, both of which may invoke the same (collided) command. Harmless but very
confusing. **→ Rename the view ids and the submenu label** to the new brand.

**e) Settings section & keys — namespaced by plugin id, so no data corruption.** Confirmed:
`packages/lib/services/plugins/utils/getPluginSettingKeyPrefix.ts`

```ts
export default (pluginId: string): string => {
	return `plugin-${pluginId}.`;
};
```

`packages/lib/services/plugins/utils/getPluginNamespacedSettingKey.ts`

```ts
// Ensures that the plugin settings and sections are within their own namespace,
// to prevent them from overwriting other plugin settings or the default settings.
export default (pluginId: string, key: string): string => {
	return `${getPluginSettingKeyPrefix(pluginId)}${key}`;
};
```

`packages/lib/services/plugins/api/JoplinSettings.ts` applies it to `registerSettings`,
**`registerSection`**, `value`, `values`, `setValue` and `onChange` (which filters events by
prefix):

```ts
await Setting.registerSetting(getPluginNamespacedSettingKey(this.plugin_.id, key), internalSettingItem);
…
return Setting.registerSection(getPluginNamespacedSettingKey(this.plugin_.id, name), SettingSectionSource.Plugin, section);
…
public async value(key: string): Promise<any> {
	return Setting.value(getPluginNamespacedSettingKey(this.plugin_.id, key));
}
```

Stored key format is `plugin-<manifest.id>.<key>` — today
`plugin-com.joplin.excalidraw-v2.newDrawingTheme` and
`plugin-com.joplin.excalidraw-v2.preserveDrawingTheme`. The two plugins therefore **cannot**
overwrite each other's values, and even the *section* id is namespaced. The only visible artefact
with both installed is two identically-**labelled** "Excalidraw" sections in Tools → Options (both
pass `label: 'Excalidraw'`). **→ Rename the section label** (and, cosmetically, the section id) to
the new brand so the two are distinguishable.

**The corollary is the migration cost: because the id changes, every stored setting is orphaned and
silently falls back to its default.** Two options:
- **Do nothing** and say so in the README (two settings, ten seconds to redo). Simplest.
- **Migrate on first run.** `joplin.settings.globalValue()` / `globalValues()` are *unnamespaced*
  (they only block `Setting.isSecureKey(key)`), so the new plugin can read the old plugin's values
  directly:
  ```ts
  const old = await joplin.settings.globalValue('plugin-com.joplin.excalidraw-v2.newDrawingTheme');
  ```
  and seed its own settings once, guarded by a `migrated` flag. **Not verified:** whether
  `globalValue` throws or returns `undefined`/`null` for a key that was never registered (i.e. when
  the old plugin was never installed) — wrap it in try/catch either way.

Separately, note `registerSettingAllowedPluginIds` in `JoplinSettings.ts`: the deprecated
**singular** `registerSetting()` API is allowlisted to ~50 legacy ids ("any new plugin after that
will not be able to use the registerSetting API"). Neither excalidraw id is on the list and a new id
certainly will not be — the code already uses the plural `registerSettings()`, so this is a
non-issue, but do not "simplify" to the singular form.

**f) Chrome CSS injection — doubled.** Both call
`joplin.window.loadChromeCssFile(installDir + '/excalidraw.css')` from their own install dirs; the
same rules are injected twice. Harmless.

**g) Temp folder — shared and destructively cleared.** `Config.TempFolder` is
`${tmpdir}/joplin-excalidraw-plugin/` and `clearDiskCache()` runs `fs.rmSync(TempFolder, { recursive: true })`
on **every** `onStart`. With both plugins installed, whichever starts second wipes the other's temp
folder. Files are short-lived (written then `fs.unlink`ed immediately), so the practical risk is a
race during a concurrent save. **→ Rename the temp folder** (`joplin-squiggle-plugin`).

**h) Freehand Drawing incompatibility persists.** The upstream README carries a CAUTION that the
plugin is "Not compatible with the Freehand Drawing plugin, it causes glitches when both are
enabled" (upstream issue #2, closed 2025-10-25). Carry that warning over verbatim; it is unrelated
to the rename but it is the registry's `_recommended` drawing plugin, so users are likely to have it.

### 5.4 What the README migration note must say

Suggested content:

- **"This plugin is a continuation of `joplin-excalidraw-v2` by neagix, which is no longer
  maintained (last commit October 2025)."** State it plainly — it is the reason the plugin exists
  and it satisfies the MIT attribution expectation socially as well as legally.
- **"Uninstall Excalidraw v2 (and the original `joplin-excalidraw`) before installing this."**
  Not optional: list the concrete symptoms from §5.3 — duplicate Edit buttons on every drawing,
  two toolbar pencils, two Tools submenus, and Edit clicks that may open the *other* plugin's
  editor.
- **"Your existing drawings keep working — no conversion needed."** Both `![excalidraw.svg](:/id)`
  links and the `excalidraw-<id>.json/.svg` resource pairs are read unchanged. Nothing is rewritten
  on install.
- **"Drawings from the original v1 plugin (`![excalidraw](excalidraw://…)`) still show a Convert
  button."** The converted copy starts with a placeholder SVG that says "Edit & Save to update this
  SVG preview" — the user must open and save once to get a real preview. The original v1 resource is
  left untouched, so other notes referencing it are unaffected.
- **"Settings are not carried over."** Joplin namespaces settings as `plugin-<id>.<key>` (verified,
  §5.3e), so a new plugin id starts at its defaults ("Follow Joplin theme" / "Keep each drawing's
  saved theme"). Two settings, ten seconds to redo — but say so or users will file it as a bug.
  (A one-time auto-migration via `globalValue('plugin-com.joplin.excalidraw-v2.<key>')` is possible
  if it's worth the code.)
- **"Not compatible with the Freehand Drawing plugin"** (carried over from upstream).
- Credits block: retain neagix's MIT copyright line, the artikell lineage, and the existing thanks
  to ThibaultJanBeyer/joplin-sheets, @Winbee and @smallzh, plus @Akiyamka for testing PR #6.

---

## 6. Appendix: sources

- Joplin plugin registry manifests — `https://raw.githubusercontent.com/joplin/plugins/master/manifests.json` (fetched 2026-09-11, 347 entries)
- `https://api.github.com/repos/neagix/joplin-excalidraw-v2` (+ `/pulls`, `/issues`, `/issues/6/comments`, `/commits`)
- `https://api.github.com/repos/artikell/joplin-excalidraw`
- `https://registry.npmjs.org/joplin-plugin-<name>` — availability probes
- `https://api.github.com/search/repositories?q=joplin-plugin-<name>+in:name`
- `https://github.com/joplin/plugins` — `README.md`, `.github/workflows/update-repo.yml`,
  `.github/pull_request_template.md`, `readme/recommended.md`, `readme/obsoletes.md`,
  `readme/superseded.md`, `manifestOverrides.json`
- `https://joplinapp.org/help/api/references/plugin_manifest/`
- `https://joplinapp.org/help/api/get_started/plugins/` (no publishing section)
- `GENERATOR_DOC.md` "Publishing the plugin" (local copy + generator-joplin template)
- Joplin source (branch `dev`):
  - `packages/lib/services/PostMessageService.ts`
  - `packages/lib/services/plugins/PluginService.ts`
  - `packages/lib/services/plugins/Plugin.ts`
  - `packages/lib/services/CommandService.ts`
  - `packages/lib/services/plugins/RepositoryApi.ts` (search + install mode)
  - `packages/lib/services/plugins/api/JoplinSettings.ts`
  - `packages/lib/services/plugins/utils/getPluginSettingKeyPrefix.ts`
  - `packages/lib/services/plugins/utils/getPluginNamespacedSettingKey.ts`
  - `packages/lib/services/plugins/utils/validatePluginId.ts`, `validatePluginVersion.ts`,
    `manifestFromObject.ts`
  - `packages/plugin-repo-cli/index.ts`, `lib/searchPlugins.ts`, `lib/utils.ts`,
    `lib/checkIfPluginCanBeAdded.ts`, `lib/validateUntrustedManifest.ts`
  - `packages/app-desktop/gui/ConfigScreen/controls/plugins/SearchPlugins.tsx`
  - `packages/app-mobile/components/screens/ConfigScreen/plugins/utils/useRepoApi.ts`
- `https://raw.githubusercontent.com/excalidraw/excalidraw/master/LICENSE` (MIT, © 2020 Excalidraw);
  no TRADEMARK.md in that repo
- `https://plus.excalidraw.com/terms-of-service` (Excalidraw s.r.o., Marks clause)
- `https://uspto.report/company/Excalidraw-S-R-O` — **HTTP 403, could not verify**
- Local repo: `src/index.ts`, `src/resources.ts`, `src/contentScripts/markdownIt.ts`,
  `src/contentScripts/markdownIt-content.js`, `src/contentScripts/codeMirror.ts`,
  `src/manifest.json`, `package.json`, `webpack.config.js`, `plugin.config.json`, `.npmignore`,
  `LICENSE`, `README.md`, `changelog.md`, `.github/workflows/build-release.yaml`
- `https://discourse.joplinapp.org/t/excalidraw-plugin-v2/47465`
- Trademark sanity checks via web search (Easel®/Inventables, SCRAWL®/Scrawl Inc., Vellum/vellum.pub)
