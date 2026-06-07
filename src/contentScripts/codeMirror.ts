// CodeMirror 6 helpers exposed to the plugin via `editor.execCommand`:
//
//  - excalidrawCurrentLine: text of the line the cursor is on, so
//    "Edit Excalidraw drawing" can act on it without it being selected.
//  - excalidrawRefreshImage: bust the cachebreaker on a drawing's <img> after
//    it has been edited, so the editor's inline render reloads the new SVG
//    instead of showing a stale/broken image until the note is reopened.
//
// Only the CodeMirror 6 (Markdown) editor is supported; elsewhere the commands
// simply aren't registered and the plugin falls back gracefully.
export default () => {
  return {
    plugin: (editorControl: any) => {
      if (!editorControl || typeof editorControl.registerCommand !== 'function') return;

      const editorView = () => editorControl.editor ?? editorControl.cm6 ?? editorControl.view;

      editorControl.registerCommand('excalidrawCurrentLine', () => {
        const state = editorView()?.state;
        if (!state) return '';
        return state.doc.lineAt(state.selection.main.head).text;
      });

      editorControl.registerCommand('excalidrawRefreshImage', (resourceId: string) => {
        const id = Array.isArray(resourceId) ? resourceId[0] : resourceId;
        if (!id) return;

        const root: ParentNode = editorView()?.dom ?? document;
        const images = root.querySelectorAll(`img[data-resource-id="${id}"], img[src*="${id}"]`);
        images.forEach((image: any) => {
          const src = image.getAttribute('src') || '';
          const base = src.split('?')[0];
          if (base) image.setAttribute('src', `${base}?t=${Date.now()}`);
        });
      });
    },
  };
};
