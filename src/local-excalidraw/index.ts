/*eslint-disable */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ExcalidrawLib from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./style.css";
import svgElementToString from '../util/svgElementToString'

// The dialog hands the existing drawing to this iframe, and reads the result
// back, through hidden inputs in the parent (dialog) document.
const parentInput = (id: string): HTMLInputElement | null =>
  window.parent.document.getElementById(id) as HTMLInputElement | null;

const readInitialData = (): any => {
  try {
    return JSON.parse(parentInput('excalidraw_diagram_json')!.value);
  } catch (error) {
    console.error("excalidraw: could not parse the initial diagram:", error);
    return {};
  }
};

const InitialData = readInitialData();

const App = () => {
  const apiRef = React.useRef<any>(null);
  const svgTimer = React.useRef<number | null>(null);

  // Serializing to JSON is cheap and synchronous, so we keep the hidden input
  // up to date on every change.
  const writeJson = React.useCallback(() => {
    const api = apiRef.current;
    const input = parentInput('excalidraw_diagram_json');
    if (!api || !input) return;
    input.value = ExcalidrawLib.serializeAsJSON(
      api.getSceneElements(), api.getAppState(), api.getFiles(), "local",
    );
  }, []);

  // Exporting to SVG is async and comparatively expensive.
  const writeSvg = React.useCallback(async () => {
    const api = apiRef.current;
    const input = parentInput('excalidraw_diagram_svg');
    if (!api || !input) return;
    const svg = await ExcalidrawLib.exportToSvg({
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles(),
    });
    input.value = svgElementToString(svg);
  }, []);

  const cancelScheduledSvg = React.useCallback(() => {
    if (svgTimer.current !== null) {
      window.clearTimeout(svgTimer.current);
      svgTimer.current = null;
    }
  }, []);

  // Refresh the SVG in the background while drawing (debounced) so it is never
  // far out of date. The authoritative export happens on Save, below.
  const scheduleSvg = React.useCallback(() => {
    cancelScheduledSvg();
    svgTimer.current = window.setTimeout(() => {
      svgTimer.current = null;
      void writeSvg();
    }, 500);
  }, [cancelScheduledSvg, writeSvg]);

  const onChange = React.useCallback(() => {
    writeJson();
    scheduleSvg();
  }, [writeJson, scheduleSvg]);

  // The Joplin dialog reads the hidden inputs the instant Save is clicked, but
  // exporting the SVG is asynchronous. Intercept that click, finish a final
  // JSON + SVG export, then replay the click so the dialog closes with current
  // data. ChangeCanvasBackground/ToggleTheme buttons live inside this iframe,
  // so matching on the parent "Save" button is unambiguous.
  React.useEffect(() => {
    const parentDocument = window.parent.document;
    let saving = false;

    const onParentClick = (event: MouseEvent) => {
      if (saving) return;
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (button?.textContent?.trim() !== 'Save') return;

      event.preventDefault();
      event.stopImmediatePropagation();

      cancelScheduledSvg();
      writeJson();
      void writeSvg().finally(() => {
        saving = true;
        button.click();
        saving = false;
      });
    };

    parentDocument.addEventListener('click', onParentClick, true);
    return () => parentDocument.removeEventListener('click', onParentClick, true);
  }, [cancelScheduledSvg, writeJson, writeSvg]);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "excalidraw-wrapper" },
      React.createElement(ExcalidrawLib.Excalidraw, {
        initialData: InitialData,
        excalidrawAPI: (api: any) => { apiRef.current = api; },
        onChange,
      },
        React.createElement(
          ExcalidrawLib.MainMenu, null,
          React.createElement(ExcalidrawLib.MainMenu.DefaultItems.ChangeCanvasBackground),
        ),
      ),
    ),
  );
};

ReactDOM.render(React.createElement(App), document.getElementById("app"));
