// Cachebusting for the <img> elements that show a drawing, and the small
// pattern helpers that decide whether an image is one of ours.
//
// Pure functions with no DOM and no Joplin API, so they can be unit-tested with
// plain `node` and shared between the CodeMirror content script and anything
// else that needs them.
//
// WHY THE CAREFUL QUERY HANDLING: the editor's own <img> src is not a bare
// path. Joplin (and the Rich Markdown plugin) append their own cachebuster —
// historically `?r=<n>` — when a resource changes, and the URL may be a
// `joplin-content://` one. Rewriting the src as `src.split('?')[0] + '?t=…'`
// therefore throws away a parameter the host put there on purpose. Here we only
// ever set/replace our own parameter and leave every other one alone.

// The one query parameter this module owns.
export const CACHE_BUSTER_PARAM = 't';

// A Joplin resource id: 32 hex characters.
const RESOURCE_ID = '[0-9a-fA-F]{32}';

// The markdown a v2 Excalidraw drawing is written as, e.g.
// `![excalidraw.svg](:/0123…ef)`.
// Kept flagless: drawingIdsInText() builds its own /g copy, so no lastIndex
// state is shared between calls.
const DRAWING_LINK = `!\\[excalidraw\\.svg\\]\\(:\\/(${RESOURCE_ID})\\)`;

// The same drawing seen as an image src: `…/<id>.svg`, optionally followed by a
// query string or a fragment. Matches `file://`, `joplin-content://` and plain
// relative paths alike.
const DRAWING_SRC = new RegExp(`(${RESOURCE_ID})\\.svg(?:[?#]|$)`);

/**
 * Set (or replace) this module's own cachebuster on an image src, preserving
 * every other query parameter and the fragment.
 *
 * Uses the WHATWG URL parser when the src is an absolute URL — which keeps
 * `joplin-content://` and `file://` intact, including escaping — and falls back
 * to string surgery for relative srcs, which URL cannot parse without a base.
 */
export function withCacheBuster(src: string, token: string | number = Date.now()): string {
  if (!src) return src;
  const value = String(token);

  // Split the fragment off first: it must stay last, and the string-surgery
  // path below would otherwise treat it as part of the query.
  const hashAt = src.indexOf('#');
  const hash = hashAt === -1 ? '' : src.slice(hashAt);
  const withoutHash = hashAt === -1 ? src : src.slice(0, hashAt);

  try {
    const url = new URL(withoutHash);
    url.searchParams.set(CACHE_BUSTER_PARAM, value);
    return url.href + hash;
  } catch (error) {
    // Not an absolute URL (a relative src, or a scheme the parser rejects):
    // rewrite the query by hand rather than give up.
  }

  const queryAt = withoutHash.indexOf('?');
  if (queryAt === -1) return `${withoutHash}?${CACHE_BUSTER_PARAM}=${value}${hash}`;

  const parameters = withoutHash
    .slice(queryAt + 1)
    .split('&')
    .filter(part => part !== '' && part !== CACHE_BUSTER_PARAM && !part.startsWith(`${CACHE_BUSTER_PARAM}=`));
  parameters.push(`${CACHE_BUSTER_PARAM}=${value}`);

  return `${withoutHash.slice(0, queryAt)}?${parameters.join('&')}${hash}`;
}

/**
 * The resource id of the Excalidraw SVG an image src points at, or null when
 * the src is not one of our drawings.
 */
export function drawingIdFromSrc(src: string): string | null {
  const match = DRAWING_SRC.exec(src ?? '');
  return match ? match[1] : null;
}

/**
 * Resource ids of the v2 Excalidraw drawings referenced by some markdown, in
 * document order and without duplicates.
 */
export function drawingIdsInText(text: string): string[] {
  const ids: string[] = [];
  const regex = new RegExp(DRAWING_LINK, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text ?? '')) !== null) {
    if (ids.indexOf(match[1]) === -1) ids.push(match[1]);
  }
  return ids;
}

/**
 * Whether some markdown references this drawing — the check that keeps the
 * self-healing retry from touching images that are not ours.
 */
export function textReferencesDrawing(text: string, id: string): boolean {
  if (!id) return false;
  return drawingIdsInText(text).indexOf(id) !== -1;
}
