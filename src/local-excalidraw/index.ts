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

type Theme = 'light' | 'dark';

// Luminance of a CSS rgb/rgba colour, or null when it carries no real colour
// (unparseable, or fully transparent).
const backgroundLuminance = (color: string): number | null => {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\)/i.exec(color);
  if (!match || match[4] === '0') return null;
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// Used when the plugin couldn't resolve Joplin's theme from settings (the
// "auto-detect" option, or a custom theme): read the dialog's real colours.
const detectJoplinTheme = (): Theme => {
  try {
    const parent = window.parent;
    for (const el of [parent.document.body, parent.document.documentElement]) {
      const luminance = backgroundLuminance(parent.getComputedStyle(el).backgroundColor);
      if (luminance !== null) return luminance < 0.5 ? 'dark' : 'light';
    }
  } catch (error) {
    console.warn('excalidraw: could not detect the Joplin theme:', error);
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

const initialTheme = (): Theme => {
  const pref = parentInput('excalidraw_theme')?.value;
  return pref === 'light' || pref === 'dark' ? pref : detectJoplinTheme();
};

const readInitialData = (): any => {
  let data: any = {};
  try {
    data = JSON.parse(parentInput('excalidraw_diagram_json')!.value);
  } catch (error) {
    console.error("excalidraw: could not parse the initial diagram:", error);
  }
  // New drawings open in Joplin's theme; existing drawings keep the theme they
  // were saved with (we persist it ourselves in writeJson, below, because
  // Excalidraw drops appState.theme when it exports JSON).
  data.appState = data.appState ?? {};
  if (data.appState.theme !== 'light' && data.appState.theme !== 'dark') {
    data.appState.theme = initialTheme();
  }
  return data;
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
    const json = JSON.parse(ExcalidrawLib.serializeAsJSON(
      api.getSceneElements(), api.getAppState(), api.getFiles(), "local",
    ));
    // Excalidraw omits the theme from exported JSON, so store it ourselves to
    // reopen the drawing with the same theme next time.
    json.appState = json.appState ?? {};
    json.appState.theme = api.getAppState().theme;
    input.value = JSON.stringify(json);
  }, []);

  // Exporting to SVG is async and comparatively expensive.
  const writeSvg = React.useCallback(async () => {
    const api = apiRef.current;
    const input = parentInput('excalidraw_diagram_svg');
    if (!api || !input) return;
    const appState = api.getAppState();
    const svg = await ExcalidrawLib.exportToSvg({
      elements: api.getSceneElements(),
      appState: {
        ...appState,
        exportBackground: true,
        // Export in the drawing's own theme so the SVG matches what was drawn
        // (dark drawings get Excalidraw's invert filter on the root <svg>).
        exportWithDarkMode: appState.theme === 'dark',
      },
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
          React.createElement(ExcalidrawLib.MainMenu.DefaultItems.ToggleTheme),
          React.createElement(ExcalidrawLib.MainMenu.DefaultItems.ChangeCanvasBackground),
        ),
      ),
    ),
  );
};

ReactDOM.render(React.createElement(App), document.getElementById("app"));
