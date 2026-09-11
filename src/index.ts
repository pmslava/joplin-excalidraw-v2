import joplin from 'api'
import { v4 as uuidv4 } from 'uuid';

import { ContentScriptType, MenuItemLocation, SettingItemType, ToolbarButtonLocation } from 'api/types'
import { createDiagramResource, getDiagramResource, updateDiagramResource, clearDiskCache, duplicateV1DiagramAsV2, generateId, readDiagramSvg } from './resources';
import { svgToPngDataUrl } from './util/svgToPng';
import { excalidrawClipboardPayload } from './util/excalidrawClipboard';

const Config = {
  ContentScriptId: 'io.github.pmslava.excalidraw.markdownIt',
  CodeMirrorScriptId: 'io.github.pmslava.excalidraw.codeMirror',
  SettingsSection: 'excalidraw',
  NewThemeSetting: 'newDrawingTheme',
  PreserveThemeSetting: 'preserveDrawingTheme',
  FullSizeSetting: 'fullSizeEditor',
}

type JoplinThemePref = 'light' | 'dark' | 'auto';

// Joplin's built-in dark theme ids (see @joplin/lib/theme). Known light ids are
// resolved directly; anything unknown (e.g. auto-detect, custom themes) is left
// to the editor, which detects light/dark from the dialog's actual colours.
const DARK_THEME_IDS = new Set([2, 4, 5, 6, 7, 22]);
const LIGHT_THEME_IDS = new Set([1, 3]);

const joplinThemePref = async (): Promise<JoplinThemePref> => {
  try {
    if (await joplin.settings.globalValue('themeAutoDetect')) return 'auto';
    const themeId = Number(await joplin.settings.globalValue('theme'));
    if (DARK_THEME_IDS.has(themeId)) return 'dark';
    if (LIGHT_THEME_IDS.has(themeId)) return 'light';
  } catch (error) {
    console.warn('excalidraw: could not read the Joplin theme:', error);
  }
  return 'auto';
}

const registerSettings = async (): Promise<void> => {
  await joplin.settings.registerSection(Config.SettingsSection, {
    label: 'Excalidraw',
    iconName: 'excalidraw-plugin-icon',
  });

  await joplin.settings.registerSettings({
    [Config.NewThemeSetting]: {
      value: 'joplin',
      type: SettingItemType.String,
      section: Config.SettingsSection,
      public: true,
      isEnum: true,
      options: { joplin: 'Follow Joplin theme', light: 'Light', dark: 'Dark' },
      label: 'Theme for new drawings',
    },
    [Config.PreserveThemeSetting]: {
      value: true,
      type: SettingItemType.Bool,
      section: Config.SettingsSection,
      public: true,
      label: "Keep each drawing's saved theme",
      description: 'When off, existing drawings also open using the "Theme for new drawings" setting.',
    },
    [Config.FullSizeSetting]: {
      value: true,
      type: SettingItemType.Bool,
      section: Config.SettingsSection,
      public: true,
      label: 'Open the editor full size',
      description: "Expand the drawing editor to the whole Joplin window. The button next to Save and Close, at the bottom right of the editor, toggles it, and the last choice is remembered.",
    },
  });
}

// Theme to open a NEW drawing with: an explicit Light/Dark choice, otherwise
// whatever Joplin is currently using.
const newDrawingThemePref = async (): Promise<JoplinThemePref> => {
  try {
    const setting = await joplin.settings.value(Config.NewThemeSetting);
    if (setting === 'light' || setting === 'dark') return setting;
  } catch (error) {
    console.warn('excalidraw: could not read the theme setting:', error);
  }
  return joplinThemePref();
}

const preserveDrawingTheme = async (): Promise<boolean> => {
  try {
    return (await joplin.settings.value(Config.PreserveThemeSetting)) !== false;
  } catch (error) {
    return true;
  }
}

// Whether the editor opens stretched over the whole Joplin window. The editor
// itself can toggle this while it is open; rememberFullSize() stores the result.
const fullSizeEditor = async (): Promise<boolean> => {
  try {
    return (await joplin.settings.value(Config.FullSizeSetting)) !== false;
  } catch (error) {
    return true;
  }
}

// Joplin collects the dialog's form data for whichever button closed it — every
// button's onClick calls formData() in UserWebviewDialog.tsx — so the size the
// user left the editor in is remembered even when the drawing is not saved.
const rememberFullSize = async (dialogResult: any, previous: boolean): Promise<void> => {
  const value = dialogResult?.formData?.main?.excalidraw_full_size;
  if (value !== 'true' && value !== 'false' && value !== true && value !== false) return;

  const chosen = (value === 'true' || value === true);
  if (chosen === previous) return;

  try {
    await joplin.settings.setValue(Config.FullSizeSetting, chosen);
  } catch (error) {
    console.warn('excalidraw: could not remember the editor size:', error);
  }
}

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const buildDialogHTML = (diagramBody: string, theme: JoplinThemePref, preserveTheme: boolean, fullSize: boolean): string => {
  return `
		<form name="main" style="display:none">
			<input type="hidden" name="excalidraw_diagram_json" id="excalidraw_diagram_json" value="${escapeAttribute(diagramBody)}">
			<input type="hidden" name="excalidraw_diagram_svg" id="excalidraw_diagram_svg" value="">
			<input type="hidden" name="excalidraw_theme" id="excalidraw_theme" value="${theme}">
			<input type="hidden" name="excalidraw_preserve_theme" id="excalidraw_preserve_theme" value="${preserveTheme}">
			<input type="hidden" name="excalidraw_full_size" id="excalidraw_full_size" value="${fullSize}">
		</form>
		`
}

function diagramMarkdown(diagramId: string) {
  return `![excalidraw.svg](:/${diagramId})`
}

const openDialog = async (svgResourceId: string = null): Promise<string | null> => {
  let diagramBody = "{}";
  const appPath = await joplin.plugins.installationDir();
  const theme = await newDrawingThemePref();
  const preserveTheme = await preserveDrawingTheme();
  const fullSize = await fullSizeEditor();

  const isNewDiagram = (svgResourceId === null);
  if (!isNewDiagram) {
    const diagramResource = await getDiagramResource(svgResourceId);
    diagramBody = diagramResource.dataJson;
  }

  let dialogs = joplin.views.dialogs;
  let dialogHandle = await dialogs.create(`excalidraw-dialog-${uuidv4()}`);

  let header = buildDialogHTML(diagramBody, theme, preserveTheme, fullSize);
  let iframe = `<iframe id="excalidraw_iframe" style="position:absolute;border:0;width:100%;height:100%;" src="${appPath}/local-excalidraw/index.html" title="Excalidraw frame"></iframe>`

  await dialogs.setHtml(dialogHandle, header + iframe);
  await dialogs.setButtons(dialogHandle, [
    { id: 'ok', title: 'Save' },
    { id: 'cancel', title: 'Close' }
  ]);
  await dialogs.setFitToContent(dialogHandle, false);

  let dialogResult = await dialogs.open(dialogHandle);
  await rememberFullSize(dialogResult, fullSize);

  if (dialogResult.id === 'ok') {
    if (isNewDiagram) {
      let diagramJson = dialogResult.formData.main.excalidraw_diagram_json;
      let diagramSvg = dialogResult.formData.main.excalidraw_diagram_svg;
      const jsonResourceId = generateId();
      svgResourceId = await createDiagramResource(jsonResourceId, diagramJson, diagramSvg)
      await joplin.commands.execute('insertText', diagramMarkdown(svgResourceId))
    } else {
      let diagramJson = dialogResult.formData.main.excalidraw_diagram_json;
      let diagramSvg = dialogResult.formData.main.excalidraw_diagram_svg;
      await updateDiagramResource(svgResourceId, diagramJson, diagramSvg)
      await refreshDrawingImage(svgResourceId);
    }
  }

  return svgResourceId;
}

// After updating the resource the already-rendered <img> still points at the
// old content, and Joplin won't reload a note that's open in the editor. Bust
// the image's cachebreaker (via the CodeMirror content script) so the new SVG
// appears in the editor's inline render without reopening the note.
const refreshDrawingImage = async (svgResourceId: string): Promise<void> => {
  try {
    await joplin.commands.execute('editor.execCommand', {
      name: 'excalidrawRefreshImage',
      args: [svgResourceId],
    });
  } catch (error) {
    console.warn('excalidraw: could not refresh the drawing image:', error);
  }
}

// Resource ids of v2 Excalidraw drawings (![excalidraw.svg](:/id)) in some text.
const excalidrawSvgIds = (text: string): string[] => {
  const ids: string[] = [];
  const regex = /!\[excalidraw\.svg\]\(:\/([a-zA-Z0-9]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text ?? '')) !== null) ids.push(match[1]);
  return ids;
}

// Text of the editor's current line, via the CodeMirror content script.
const editorCurrentLine = async (): Promise<string> => {
  try {
    const line = await joplin.commands.execute('editor.execCommand', { name: 'excalidrawCurrentLine' });
    return typeof line === 'string' ? line : '';
  } catch (error) {
    return '';
  }
}

// Resolve which drawing the "Edit Excalidraw drawing" command should open: the
// drawing on the cursor's current line first, then the selection, then the
// note's only drawing.
const findExcalidrawForEditing = async (): Promise<string | null> => {
  const onLine = excalidrawSvgIds(await editorCurrentLine());
  if (onLine.length >= 1) return onLine[0];

  const selection = await joplin.commands.execute('selectedText').catch(() => '');
  const inSelection = excalidrawSvgIds(typeof selection === 'string' ? selection : '');
  if (inSelection.length === 1) return inSelection[0];

  const note = await joplin.workspace.selectedNote();
  const inNote = excalidrawSvgIds(note?.body ?? '');
  if (inNote.length === 1) return inNote[0];

  await joplin.views.dialogs.showMessageBox(
    inNote.length === 0
      ? 'No Excalidraw drawing was found in this note.'
      : 'Put the cursor on the line of the Excalidraw drawing you want to edit, then run the command again.'
  );
  return null;
}

// showToast() was added to the plugin API after the api/ typings vendored in
// this repository were generated, so it is called dynamically. Signature at
// Joplin v3.7.16 (packages/lib/services/plugins/api/JoplinViewsDialogs.ts:81 and
// types.ts): showToast(toast: { message: string; type?: ToastType; duration?:
// number; timestamp?: number }), with ToastType.Success === 'success'. On an
// older Joplin the call simply does nothing.
const showToast = async (message: string): Promise<void> => {
  try {
    await (joplin.views.dialogs as any).showToast({ message, type: 'success', duration: 2500 });
  } catch (error) {
    console.info('excalidraw:', message);
  }
}

// Drawings that currently have an editor dialog open, by SVG resource id. Two
// editors on one drawing would both write the same resource pair on save, last
// write silently winning — so the second request is refused.
//
// CAVEAT: if the user closes a *window* that holds an open dialog with its
// title-bar button, Joplin never settles that dialog's open() promise (nothing
// calls WebviewController.setOpen(false) on WINDOW_CLOSE), the unsaved changes
// are lost silently, and the `finally` below never runs — so that drawing stays
// marked as open until Joplin restarts. Closing with the editor's own Close
// button (or Escape) is the clean path.
const openDrawings = new Set<string>();

const openDrawingDialog = async (svgResourceId: string): Promise<string | null> => {
  if (openDrawings.has(svgResourceId)) {
    await joplin.views.dialogs.showMessageBox('This Excalidraw drawing is already open in an editor.');
    return null;
  }

  openDrawings.add(svgResourceId);
  try {
    return await openDialog(svgResourceId);
  } finally {
    openDrawings.delete(svgResourceId);
  }
}

// One-shot waiters resolved by the single onNoteSelectionChange listener that is
// registered at onStart. A listener *per call* would leak:
// JoplinWorkspace.onNoteSelectionChange returns an empty Disposable and only
// unregisters on plugin unload (laurent22/joplin#14919).
const noteSelectionWaiters = new Set<() => void>();

const waitForNextNoteSelectionChange = (timeoutMs: number): Promise<void> => {
  return new Promise<void>(resolve => {
    const waiter = () => {
      clearTimeout(timer);
      noteSelectionWaiters.delete(waiter);
      resolve();
    };
    const timer = setTimeout(waiter, timeoutMs);
    noteSelectionWaiters.add(waiter);
  });
}

// Open a drawing in a second Joplin window, so the note and the drawing can be
// worked on side by side. Existing drawings only: a new drawing has to insert
// markdown into the note body, and if the first window has unsaved edits it
// would later overwrite that insertion (Joplin saves whole note bodies).
//
// dialogs.open() renders the dialog in whichever window has focus at that
// instant, and openNoteInNewWindow only dispatches WINDOW_OPEN — the focus swap
// comes back asynchronously through a main-process IPC round trip. The only
// proxy a plugin can observe for it is onNoteSelectionChange, which fires on
// WINDOW_FOCUS; hence wait for that, then let the new window's portal mount.
const editInNewWindow = async (svgResourceId: string): Promise<string | null> => {
  if (openDrawings.has(svgResourceId)) {
    await joplin.views.dialogs.showMessageBox('This Excalidraw drawing is already open in an editor.');
    return null;
  }

  let openedWindow = false;
  try {
    const note = await joplin.workspace.selectedNote();
    if (note?.id) {
      await joplin.commands.execute('openNoteInNewWindow', note.id);
      openedWindow = true;
    }
  } catch (error) {
    // Older Joplin versions have no openNoteInNewWindow; fall back to editing
    // in this window rather than doing nothing.
    console.warn('excalidraw: could not open the note in a new window:', error);
  }

  if (openedWindow) {
    await waitForNextNoteSelectionChange(1500);
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  return openDrawingDialog(svgResourceId);
}

const copyDrawingAsImage = async (svgResourceId: string): Promise<void> => {
  try {
    const dataUrl = await svgToPngDataUrl(await readDiagramSvg(svgResourceId));
    await joplin.clipboard.writeImage(dataUrl);
    await showToast('Copied as PNG');
  } catch (error) {
    console.error('excalidraw: could not copy the drawing as an image:', error);
    await joplin.views.dialogs.showMessageBox('Could not copy this Excalidraw drawing as an image.');
  }
}

const copyDrawingAsExcalidraw = async (svgResourceId: string): Promise<void> => {
  try {
    const { dataJson } = await getDiagramResource(svgResourceId);
    await joplin.clipboard.writeText(excalidrawClipboardPayload(dataJson));
    await showToast('Copied as JSON');
  } catch (error) {
    console.error('excalidraw: could not copy the drawing as JSON:', error);
    await joplin.views.dialogs.showMessageBox('Could not copy this Excalidraw drawing as JSON.');
  }
}

// The SVG resource id inside a message from the viewer: either an image src
// (file:// or joplin-content://) or a plain resource link.
const svgResourceIdFromMessage = (text: string): string | null => {
  const fileURLMatch = /^(?:file|joplin[-a-z]+):\/\/.*\/([a-zA-Z0-9]+)[.]\w+(?:[?#]|$)/.exec(text);
  if (fileURLMatch) return fileURLMatch[1];

  const resourceLinkMatch = /^:\/([a-zA-Z0-9]+)$/.exec(text);
  if (resourceLinkMatch) return resourceLinkMatch[1];

  return null;
}

joplin.plugins.register({
  onStart: async () => {

    clearDiskCache();
    await registerSettings();

    const installDir = await joplin.plugins.installationDir();
    const excalidrawCssFilePath = installDir + '/excalidraw.css';
    await (joplin as any).window.loadChromeCssFile(excalidrawCssFilePath);

    /* support excalidraw dialog */
    await joplin.contentScripts.register(
      ContentScriptType.MarkdownItPlugin,
      Config.ContentScriptId,
      './contentScripts/markdownIt.js',
    );

    // exposes the editor's current line, so "Edit Excalidraw drawing" can act on
    // the line the cursor is on without it having to be selected
    await joplin.contentScripts.register(
      ContentScriptType.CodeMirrorPlugin,
      Config.CodeMirrorScriptId,
      './contentScripts/codeMirror.js',
    );

    // One listener for the whole plugin, resolving whatever one-shot waiters are
    // pending (see waitForNextNoteSelectionChange).
    await joplin.workspace.onNoteSelectionChange(() => {
      const waiters = Array.from(noteSelectionWaiters);
      noteSelectionWaiters.clear();
      waiters.forEach(waiter => waiter());
    });

    // this is the main message processing function
    await joplin.contentScripts.onMessage(Config.ContentScriptId, async (message: any) => {
      // decode message
      message = decodeURIComponent(message)

      let svgResourceId: string | null = null;

      // The viewer's toolbar buttons other than Edit prefix the image src; Edit
      // keeps sending the bare src, as it always has.
      for (const [prefix, action] of [
        ['excalidraw_new_window_', editInNewWindow],
        ['excalidraw_copy_image_', copyDrawingAsImage],
        ['excalidraw_copy_excalidraw_', copyDrawingAsExcalidraw],
      ] as [string, (id: string) => Promise<unknown>][]) {
        if (!message.startsWith(prefix)) continue;

        svgResourceId = svgResourceIdFromMessage(message.slice(prefix.length));
        if (svgResourceId === null) {
          console.error('could not parse SVG resource id from:', message);
          return null;
        }
        return (await action(svgResourceId)) ?? null;
      }

      if (message.startsWith("convert_v1_")) {
        const jsonResourceId = message.slice("convert_v1_".length);

        // will create SVG resource and change title of existing JSON one
        svgResourceId = await duplicateV1DiagramAsV2(jsonResourceId);

        // edit original markdown in document
        const note = await joplin.workspace.selectedNote();

        const updatedBody = note.body.replace(
          `![excalidraw](excalidraw://${jsonResourceId})`,
          `![excalidraw.svg](:/${svgResourceId})`
        );
        
        // Update the note
        await joplin.data.put(['notes', note.id], null, {
          body: updatedBody
        });

        // no editing happens here; return the new resource id
        return svgResourceId;
      } else {
        // Extract the ID
        svgResourceId = svgResourceIdFromMessage(message);
      }

      if (svgResourceId === null) {
        // cannot create new resource, something went wrong in parsing
        console.error("could not parse SVG resource id from:", message);
        return null;
      }

      return openDrawingDialog(svgResourceId);
    });

    await joplin.commands.register({
      name: 'excalidraw.add',
      label: 'Add Excalidraw drawing',
      iconName: 'excalidraw-plugin-icon',
      execute: async () => {
        // return as promise
        return openDialog();
      }
    });

    await joplin.commands.register({
      name: 'excalidraw.edit',
      label: 'Edit Excalidraw drawing',
      iconName: 'excalidraw-plugin-icon',
      execute: async () => {
        const svgResourceId = await findExcalidrawForEditing();
        return svgResourceId ? openDrawingDialog(svgResourceId) : null;
      }
    });

    await joplin.commands.register({
      name: 'excalidraw.editInNewWindow',
      label: 'Edit Excalidraw drawing in new window',
      iconName: 'excalidraw-plugin-icon',
      execute: async () => {
        const svgResourceId = await findExcalidrawForEditing();
        return svgResourceId ? editInNewWindow(svgResourceId) : null;
      }
    });

    await joplin.commands.register({
      name: 'excalidraw.copyImage',
      label: 'Copy Excalidraw drawing as image',
      iconName: 'fas fa-image',
      execute: async () => {
        const svgResourceId = await findExcalidrawForEditing();
        if (svgResourceId) await copyDrawingAsImage(svgResourceId);
      }
    });

    await joplin.commands.register({
      name: 'excalidraw.copyExcalidraw',
      label: 'Copy Excalidraw drawing as JSON',
      iconName: 'fas fa-code',
      execute: async () => {
        const svgResourceId = await findExcalidrawForEditing();
        if (svgResourceId) await copyDrawingAsExcalidraw(svgResourceId);
      }
    });

    await joplin.views.toolbarButtons.create('excalidraw.add', 'excalidraw.add', ToolbarButtonLocation.EditorToolbar);

    // Group every command under a single Tools > Excalidraw submenu.
    await joplin.views.menus.create('excalidrawMenu', 'Excalidraw', [
      { commandName: 'excalidraw.add' },
      { commandName: 'excalidraw.edit' },
      { commandName: 'excalidraw.editInNewWindow' },
      { commandName: 'excalidraw.copyImage' },
      { commandName: 'excalidraw.copyExcalidraw' },
    ], MenuItemLocation.Tools);

    // Offer the drawing actions in the editor's right-click menu, but only when
    // the cursor's current line actually holds a drawing.
    joplin.workspace.filterEditorContextMenu(async (contextMenu: any) => {
      if (excalidrawSvgIds(await editorCurrentLine()).length > 0) {
        contextMenu.items.push(
          { type: 'separator' },
          { commandName: 'excalidraw.edit', label: 'Edit Excalidraw drawing' },
          { commandName: 'excalidraw.editInNewWindow', label: 'Edit Excalidraw drawing in new window' },
          { commandName: 'excalidraw.copyImage', label: 'Copy Excalidraw drawing as image' },
          { commandName: 'excalidraw.copyExcalidraw', label: 'Copy Excalidraw drawing as JSON' },
        );
      }
      return contextMenu;
    });
  },
})
