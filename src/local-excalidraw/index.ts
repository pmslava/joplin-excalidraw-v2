/*eslint-disable */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ExcalidrawLib from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./style.css";
import svgElementToString from '../util/svgElementToString'

// --- React 17 / Excalidraw 0.18 ---------------------------------------------
// Excalidraw 0.18's "Mermaid to Excalidraw" dialog imports useDeferredValue,
// a React 18 hook, with no fallback (unlike useTransition, which it guards).
// This plugin bundles React 17, so opening that dialog throws
// "useDeferredValue is not a function" and tears the whole editor down.
// React 17 has no concurrent rendering, so the hook is the identity function.
const identity = (value: any): any => value;

const installUseDeferredValue = (): void => {
  // The `import * as React` namespace exposes read-only getters onto the
  // CommonJS module the bundler wraps; `default` is that module itself, and
  // that is the object Excalidraw's own import reads through. Patch it first,
  // then confirm the hook is visible through the namespace we share with it.
  for (const target of [(React as any).default, React as any]) {
    if (!target || typeof target.useState !== 'function') continue;
    if (typeof target.useDeferredValue === 'function') return;
    try {
      target.useDeferredValue = identity;
    } catch (error) {
      try {
        Object.defineProperty(target, 'useDeferredValue', { value: identity, configurable: true });
      } catch (nested) { /* frozen namespace, try the next candidate */ }
    }
    if (typeof (React as any).useDeferredValue === 'function') return;
  }
  console.warn('excalidraw: could not add React.useDeferredValue; the Mermaid importer may fail.');
};

installUseDeferredValue();

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

// Theme for a new drawing: the configured Light/Dark choice, or Joplin's theme.
const newDrawingTheme = (): Theme => {
  const pref = parentInput('excalidraw_theme')?.value;
  return pref === 'light' || pref === 'dark' ? pref : detectJoplinTheme();
};

const preserveSavedTheme = (): boolean =>
  parentInput('excalidraw_preserve_theme')?.value !== 'false';

// --- Full-size mode --------------------------------------------------------
// This editor lives in one of Joplin's plugin dialogs: 90vw x 90vh, padded all
// round, with a button bar underneath. Putting a class on the dialog element
// lets excalidraw.css (loaded into Joplin's main window as chrome CSS) stretch
// it to the whole window and float Joplin's Save / Close buttons over the
// canvas instead. The class name is shared with that stylesheet.
const FULL_SIZE_CLASS = 'excalidraw-plugin-full';

// The dialog element sits two documents up: this iframe -> Joplin's plugin
// webview -> Joplin's main window. Any step can fail, most likely with the
// "isolatePluginWebViews" setting on, which puts the parent on another origin.
// Then the dialog simply stays at Joplin's default size and no button is shown.
const findDialogElement = (): HTMLElement | null => {
  try {
    const webviewFrame = window.parent.frameElement;
    return (webviewFrame?.closest('.user-webview-dialog') as HTMLElement | null) ?? null;
  } catch (error) {
    return null;
  }
};

const dialogElement = findDialogElement();
if (!dialogElement) {
  console.warn('excalidraw: the Joplin dialog is out of reach, hiding the full-size button.');
}

// The plugin seeds this input from the "Open the editor full size" setting and
// reads it back when the dialog closes, so the last choice is remembered.
const readFullSize = (): boolean => {
  try {
    return parentInput('excalidraw_full_size')?.value === 'true';
  } catch (error) {
    return false;
  }
};

const applyFullSize = (fullSize: boolean): void => {
  try {
    dialogElement?.classList.toggle(FULL_SIZE_CLASS, fullSize);
    const input = parentInput('excalidraw_full_size');
    if (input) input.value = String(fullSize);
  } catch (error) {
    console.warn('excalidraw: could not switch the dialog size:', error);
  }
};

const InitialFullSize = dialogElement !== null && readFullSize();

// Applied before React's first render, so the normal size barely flashes.
if (InitialFullSize) applyFullSize(true);

// Lucide-style maximize / minimize, stroked like Excalidraw's own icons.
const icon = (...paths: string[]) =>
  React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: 'false',
    },
    ...paths.map((d, index) => React.createElement('path', { key: index, d })),
  );

const expandIcon = () => icon(
  'M8 3H5a2 2 0 0 0-2 2v3',
  'M21 8V5a2 2 0 0 0-2-2h-3',
  'M3 16v3a2 2 0 0 0 2 2h3',
  'M16 21h3a2 2 0 0 0 2-2v-3',
);

const collapseIcon = () => icon(
  'M8 3v3a2 2 0 0 1-2 2H3',
  'M21 8h-3a2 2 0 0 1-2-2V3',
  'M3 16h3a2 2 0 0 1 2 2v3',
  'M16 21v-3a2 2 0 0 1 2-2h3',
);

const readInitialData = (): any => {
  let data: any = {};
  try {
    data = JSON.parse(parentInput('excalidraw_diagram_json')!.value);
  } catch (error) {
    console.error("excalidraw: could not parse the initial diagram:", error);
  }
  // Existing drawings reopen with the theme they were saved with (we persist it
  // in writeJson, since Excalidraw drops appState.theme on export) — unless the
  // user disabled that, in which case they, like new drawings, use the
  // configured new-drawing theme.
  data.appState = data.appState ?? {};
  const saved = data.appState.theme;
  const keepSaved = preserveSavedTheme() && (saved === 'light' || saved === 'dark');
  if (!keepSaved) {
    data.appState.theme = newDrawingTheme();
  }
  return data;
};

const InitialData = readInitialData();

const App = () => {
  const apiRef = React.useRef<any>(null);
  const svgTimer = React.useRef<number | null>(null);
  const [fullSize, setFullSize] = React.useState(InitialFullSize);

  // Keep the dialog and the hidden input in step with the toggle.
  // useLayoutEffect, so the dialog is resized before the browser paints.
  React.useLayoutEffect(() => {
    applyFullSize(fullSize);
  }, [fullSize]);

  const toggleFullSize = React.useCallback(() => setFullSize(value => !value), []);

  // A single button beside Excalidraw's Library button (renderTopRightUI renders
  // into .layer-ui__wrapper__top-right, just before it). Nothing is rendered when
  // the Joplin dialog is out of reach, since there would be nothing to resize.
  const renderTopRightUI = React.useCallback(() => {
    if (!dialogElement) return null;
    const label = fullSize ? 'Normal size' : 'Full size';
    return React.createElement(
      'button',
      {
        type: 'button',
        className: 'excalidraw-full-size-button',
        title: label,
        'aria-label': label,
        onClick: toggleFullSize,
      },
      fullSize ? collapseIcon() : expandIcon(),
    );
  }, [fullSize, toggleFullSize]);

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
        renderTopRightUI,
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
