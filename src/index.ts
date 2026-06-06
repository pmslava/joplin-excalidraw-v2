import joplin from 'api'
import { v4 as uuidv4 } from 'uuid';

import { ContentScriptType, ToolbarButtonLocation } from 'api/types'
import { createDiagramResource, getDiagramResource, updateDiagramResource, clearDiskCache, duplicateV1DiagramAsV2, generateId } from './resources';

const Config = {
  ContentScriptId: 'excalidraw-script',
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

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const buildDialogHTML = (diagramBody: string, theme: JoplinThemePref): string => {
  return `
		<form name="main" style="display:none">
			<input type="hidden" name="excalidraw_diagram_json" id="excalidraw_diagram_json" value="${escapeAttribute(diagramBody)}">
			<input type="hidden" name="excalidraw_diagram_svg" id="excalidraw_diagram_svg" value="">
			<input type="hidden" name="excalidraw_theme" id="excalidraw_theme" value="${theme}">
		</form>
		`
}

function diagramMarkdown(diagramId: string) {
  return `![excalidraw.svg](:/${diagramId})`
}

const openDialog = async (svgResourceId: string = null): Promise<string | null> => {
  let diagramBody = "{}";
  const appPath = await joplin.plugins.installationDir();
  const theme = await joplinThemePref();

  const isNewDiagram = (svgResourceId === null);
  if (!isNewDiagram) {
    const diagramResource = await getDiagramResource(svgResourceId);
    diagramBody = diagramResource.dataJson;
  }

  let dialogs = joplin.views.dialogs;
  let dialogHandle = await dialogs.create(`excalidraw-dialog-${uuidv4()}`);

  let header = buildDialogHTML(diagramBody, theme);
  let iframe = `<iframe id="excalidraw_iframe" style="position:absolute;border:0;width:100%;height:100%;" src="${appPath}/local-excalidraw/index.html" title="Excalidraw frame"></iframe>`

  await dialogs.setHtml(dialogHandle, header + iframe);
  await dialogs.setButtons(dialogHandle, [
    { id: 'ok', title: 'Save' },
    { id: 'cancel', title: 'Close' }
  ]);
  await dialogs.setFitToContent(dialogHandle, false);

  let dialogResult = await dialogs.open(dialogHandle);
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
    }
  }

  return svgResourceId;
}

joplin.plugins.register({
  onStart: async () => {

    clearDiskCache();

    const installDir = await joplin.plugins.installationDir();
    const excalidrawCssFilePath = installDir + '/excalidraw.css';
    await (joplin as any).window.loadChromeCssFile(excalidrawCssFilePath);

    /* support excalidraw dialog */
    await joplin.contentScripts.register(
      ContentScriptType.MarkdownItPlugin,
      Config.ContentScriptId,
      './contentScripts/markdownIt.js',
    );

    // this is the main message processing function
    await joplin.contentScripts.onMessage(Config.ContentScriptId, async (message: any) => {
      // decode message
      message = decodeURIComponent(message)

      let svgResourceId: string | null = null;

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
        const fileURLMatch = /^(?:file|joplin[-a-z]+):\/\/.*\/([a-zA-Z0-9]+)[.]\w+(?:[?#]|$)/.exec(message);
        const resourceLinkMatch = /^:\/([a-zA-Z0-9]+)$/.exec(message);

        if (fileURLMatch) {
          svgResourceId = fileURLMatch[1];
        } else if (resourceLinkMatch) {
          svgResourceId = resourceLinkMatch[1];
        }
      }

      if (svgResourceId === null) {
        // cannot create new resource, something went wrong in parsing
        console.error("could not parse SVG resource id from:", message);
        return null;
      }

      return openDialog(svgResourceId);
    });

    await joplin.commands.register({
      name: 'addExcalidraw',
      label: 'add excalidraw panel',
      iconName: 'icon-excalidraw-plus-icon-filled',
      execute: async () => {
        // return as promise
        return openDialog();
      }
    });

    await joplin.views.toolbarButtons.create('addExcalidraw', 'addExcalidraw', ToolbarButtonLocation.EditorToolbar);
  },
})
