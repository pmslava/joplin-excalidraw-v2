// CodeMirror 6 helpers exposed to the plugin via `editor.execCommand`:
//
//  - excalidrawCurrentLine: text of the line the cursor is on, so
//    "Edit Excalidraw drawing" can act on it without it being selected.
//  - excalidrawRefreshImage: bust the cachebreaker on a drawing's <img> after
//    it has been edited, so the editor's inline render reloads the new SVG
//    instead of showing a stale/broken image until the note is reopened.
//
// Plus two safety nets that need no command at all, because the refresh above
// can never be guaranteed to arrive. Both come out of one bug: saving a drawing
// from a *second* Joplin window left a broken image in the first window's
// Markdown editor. In Joplin v3.7.16:
//
//  - Updating a resource's content renames its file out of the way before the
//    new bytes are written (shim-init-node.ts:405-412 `fsDriver().move(targetPath,
//    tempPath)` then `Resource.updateResourceBlobContent`, which only copies the
//    new file in at Resource.ts:447) — and BOTH ResourceChange events are emitted
//    while the file is gone (shim-init-node.ts:409 and Resource.ts:436), with
//    none after the copy. Every window's CM6 reacts to ResourceChange
//    (v6/CodeMirror.tsx:252-261) by re-rendering the image with a new `?r=N`,
//    so it re-requests a file that does not exist; joplin-content:// answers
//    404 (handleCustomProtocols.ts:230-238). Core's image widget has no
//    `onerror` (renderBlockImages.ts:71-93) and never retries, so the broken
//    glyph stays until the note is reopened.
//  - `editor.execCommand` from a plugin is dispatched to ONE editor: the runtime
//    with the highest priority, and that priority is `containerDocument.hasFocus()`
//    (CommandService.ts:309-323 + getWindowCommandPriority.ts). So the refresh
//    lands in the window whose dialog was just saved, never in the other one —
//    nothing repairs the first window.
//
// Hence: a capture-phase `error` listener retries a drawing's image a few times
// with a fresh cachebuster (it is only ever a moment's absence), and a catch-up
// on window focus / tab visibility re-busts every drawing in this editor so a
// window that missed the refresh picks the new drawing up when you return to it.
//
// Only the CodeMirror 6 (Markdown) editor is supported; elsewhere the commands
// simply aren't registered and the plugin falls back gracefully.
import { drawingIdFromSrc, drawingIdsInText, textReferencesDrawing, withCacheBuster } from '../util/imageCacheBust';

// How many times a failed drawing image is retried, and how long we wait before
// each attempt. Joplin rewrites a resource's file in place, so a load that
// lands mid-write fails; by ~6 s the file is certainly back.
const MAX_RETRIES = 5;
const retryDelay = (attempt: number): number => 200 * Math.pow(2, attempt - 1);

// A refresh within this window of the previous one is dropped, so the focus
// catch-up cannot pile on top of a refresh that just ran (a save in this very
// window blurs and refocuses it).
const CATCH_UP_DEBOUNCE_MS = 750;

export default () => {
  return {
    plugin: (editorControl: any) => {
      if (!editorControl || typeof editorControl.registerCommand !== 'function') return;

      const editorView = () => editorControl.editor ?? editorControl.cm6 ?? editorControl.view;

      // The editor's own DOM when we can reach it, so we never touch images in
      // the rest of the app; `document` only as a fallback.
      const root = (): ParentNode => editorView()?.dom ?? document;

      // A second Joplin window is a `window.open()` portal that shares this JS
      // context, so the global `window` / `document` always belong to the MAIN
      // window — the focus of an editor in a second window would never be seen.
      // Go through the editor's own element instead.
      const editorDocument = (): Document => editorView()?.dom?.ownerDocument ?? document;
      const editorWindow = (): Window => editorDocument().defaultView ?? window;

      // The note's markdown, used to tell our drawings from any other image.
      const documentText = (): string => {
        try {
          return editorView()?.state?.doc?.toString() ?? '';
        } catch (error) {
          return '';
        }
      };

      const imagesFor = (id: string): Element[] => {
        try {
          return Array.prototype.slice.call(
            root().querySelectorAll(`img[data-resource-id="${id}"], img[src*="${id}"]`),
          );
        } catch (error) {
          return [];
        }
      };

      // Reload one drawing's images by moving its cachebuster on. Every other
      // query parameter survives: Joplin puts its own there when a resource
      // changes, and dropping it used to leave an unloadable src behind.
      const bust = (id: string): void => {
        imagesFor(id).forEach((image: any) => {
          const src = image.getAttribute('src') || '';
          if (!src) return;
          image.setAttribute('src', withCacheBuster(src));
        });
      };

      let lastRefreshAt = 0;

      const refresh = (id: string): void => {
        lastRefreshAt = Date.now();
        bust(id);
      };

      const refreshAll = (): void => {
        const ids = drawingIdsInText(documentText());
        if (!ids.length) return;
        lastRefreshAt = Date.now();
        ids.forEach(bust);
      };

      editorControl.registerCommand('excalidrawCurrentLine', () => {
        const state = editorView()?.state;
        if (!state) return '';
        return state.doc.lineAt(state.selection.main.head).text;
      });

      editorControl.registerCommand('excalidrawRefreshImage', (resourceId: string) => {
        const id = Array.isArray(resourceId) ? resourceId[0] : resourceId;
        if (!id) return;
        refresh(id);
      });

      // --- Self-healing ------------------------------------------------------
      // An <img> that failed to load is retried with a fresh cachebuster: the
      // resource file is renamed away and rewritten when a drawing is saved, so
      // a load started at that instant gets a 404 and the editor shows the
      // browser's broken-image icon until the note is reopened.
      const attempts = typeof WeakMap === 'function' ? new WeakMap<any, number>() : null;
      const attemptsOf = (image: any): number => (attempts ? attempts.get(image) ?? 0 : image.__excalidrawRetries ?? 0);
      const setAttempts = (image: any, value: number): void => {
        if (attempts) attempts.set(image, value);
        else image.__excalidrawRetries = value;
      };

      const ourImage = (target: any): string | null => {
        if (!target || target.tagName !== 'IMG') return null;
        const id = drawingIdFromSrc(target.getAttribute('src') || '');
        if (!id) return null;
        // Only heal images the note actually references as a drawing, so an
        // unrelated broken image is left to the editor that drew it.
        return textReferencesDrawing(documentText(), id) ? id : null;
      };

      const onImageError = (event: Event): void => {
        const image: any = event.target;
        if (!ourImage(image)) return;

        const attempt = attemptsOf(image) + 1;
        if (attempt > MAX_RETRIES) return;
        setAttempts(image, attempt);

        setTimeout(() => {
          const src = image.getAttribute('src') || '';
          if (src) image.setAttribute('src', withCacheBuster(src));
        }, retryDelay(attempt));
      };

      // A successful load ends the retries and gives the image a fresh budget
      // for any later failure.
      const onImageLoad = (event: Event): void => {
        const image: any = event.target;
        if (image && image.tagName === 'IMG' && attemptsOf(image) > 0) setAttempts(image, 0);
      };

      // `error` and `load` don't bubble, but they do capture, so one listener
      // on the editor's root covers every image inside it — including ones
      // added later by Joplin's block-image renderer or the Rich Markdown
      // plugin.
      const listenerTarget: any = editorView()?.dom ?? document;
      listenerTarget.addEventListener('error', onImageError, true);
      listenerTarget.addEventListener('load', onImageLoad, true);

      // --- Catch-up ----------------------------------------------------------
      // `editor.execCommand` is dispatched to the editor of the window that has
      // focus, so a drawing saved from a second Joplin window never refreshes
      // the first window's editor. Re-bust everything when this window is
      // looked at again.
      const catchUp = (): void => {
        if (Date.now() - lastRefreshAt < CATCH_UP_DEBOUNCE_MS) return;
        refreshAll();
      };

      try {
        const ownDocument = editorDocument();
        editorWindow().addEventListener('focus', catchUp);
        ownDocument.addEventListener('visibilitychange', () => {
          if (!ownDocument.hidden) catchUp();
        });
      } catch (error) {
        console.warn('excalidraw: could not watch for window focus:', error);
      }
    },
  };
};
