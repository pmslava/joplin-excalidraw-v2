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

// --- The Joplin dialog around this editor ----------------------------------
// This editor runs inside one of Joplin's plugin dialogs: 90vw x 90vh, padded
// all round, with a Save / Close button bar underneath the content. Putting
// classes on the dialog element lets excalidraw.css — loaded into Joplin's main
// window as chrome CSS — hide that bar (this editor draws its own Save and
// Close, see the action island below) and, in full-size mode, stretch the
// dialog to the whole window. Both names are shared with that stylesheet.
const DIALOG_CLASS = 'excalidraw-plugin-dialog';
const FULL_SIZE_CLASS = 'excalidraw-plugin-full';

// The dialog element sits two documents up: this iframe -> Joplin's plugin
// webview -> Joplin's main window. Any step can fail, most likely with the
// "isolatePluginWebViews" setting on, which puts the parent on another origin.
// Then nothing is marked: the dialog keeps Joplin's own size and its own
// buttons, and this editor renders no controls of its own.
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
  console.warn('excalidraw: the Joplin dialog is out of reach, keeping its own buttons and size.');
}

// Joplin's own Save / Close buttons live in that dialog's button bar, as
// siblings of the plugin webview iframe — one document further up than
// window.parent, which is only the webview's own document. (The previous
// version listened for clicks on window.parent.document to intercept Save; the
// bar is not in that document, so the listener could never fire.) Clicking one
// of those buttons is what resolves dialogs.open() on the plugin side, so our
// own Save and Close end by clicking them.
const joplinDialogButton = (title: string, fallback: 'first' | 'last'): HTMLElement | null => {
  try {
    const buttons = dialogElement?.querySelectorAll<HTMLElement>('.user-dialog-button-bar button');
    if (!buttons || buttons.length === 0) return null;
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent?.trim() === title) return buttons[i];
    }
    return fallback === 'first' ? buttons[0] : buttons[buttons.length - 1];
  } catch (error) {
    console.warn('excalidraw: could not reach the Joplin dialog buttons:', error);
    return null;
  }
};

// Last resort: if Joplin's buttons cannot be found, show its button bar again
// rather than leaving the dialog with no way out.
const clickJoplinButton = (title: string, fallback: 'first' | 'last'): void => {
  const button = joplinDialogButton(title, fallback);
  if (button) {
    button.click();
    return;
  }
  console.warn('excalidraw: no Joplin "' + title + '" button found, restoring the dialog buttons.');
  try {
    dialogElement?.classList.remove(DIALOG_CLASS);
  } catch (error) { /* the dialog is already gone */ }
};

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
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const svgTimer = React.useRef<number | null>(null);
  const measureFrame = React.useRef<number | null>(null);
  const savingRef = React.useRef(false);
  const [fullSize, setFullSize] = React.useState(InitialFullSize);
  const [saving, setSaving] = React.useState(false);
  const [theme, setTheme] = React.useState<Theme>(InitialData.appState.theme);

  // Hide Joplin's Save / Close bar only once this editor is really on screen,
  // and give it back if the editor is ever torn down. useLayoutEffect, so the
  // bar is gone before the first paint.
  React.useLayoutEffect(() => {
    if (!dialogElement) return;
    try {
      dialogElement.classList.add(DIALOG_CLASS);
    } catch (error) {
      console.warn('excalidraw: could not mark the Joplin dialog:', error);
    }
    return () => {
      try {
        dialogElement.classList.remove(DIALOG_CLASS);
      } catch (error) { /* the dialog is already gone */ }
    };
  }, []);

  // Keep the dialog and the hidden input in step with the toggle.
  // useLayoutEffect, so the dialog is resized before the browser paints.
  React.useLayoutEffect(() => {
    applyFullSize(fullSize);
  }, [fullSize]);

  const toggleFullSize = React.useCallback(() => setFullSize(value => !value), []);

  // Excalidraw's mobile layout (below 730px, or a short landscape window) fills
  // the bottom of the editor with .App-bottom-bar: the tool row, plus the
  // properties panel while something is selected, so how far up it reaches
  // changes as you work. Publish that distance — measured to the island's top
  // edge, since Excalidraw also insets the bar from the bottom — and style.css
  // keeps the action island just above it, with a fallback of its own.
  const measureBottomBar = React.useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const bar = wrapper.querySelector('.App-bottom-bar > .Island') as HTMLElement | null;
    const reach = bar
      ? Math.round(wrapper.getBoundingClientRect().bottom - bar.getBoundingClientRect().top)
      : 0;
    if (reach > 0) wrapper.style.setProperty('--excalidraw-plugin-bottom-bar', reach + 'px');
    else wrapper.style.removeProperty('--excalidraw-plugin-bottom-bar');
  }, []);

  const scheduleMeasure = React.useCallback(() => {
    if (measureFrame.current !== null) return;
    measureFrame.current = window.requestAnimationFrame(() => {
      measureFrame.current = null;
      measureBottomBar();
    });
  }, [measureBottomBar]);

  React.useLayoutEffect(() => {
    measureBottomBar();
    // The wrapper resizes when the dialog does, which is what switches
    // Excalidraw between its desktop and mobile layouts.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleMeasure);
      return () => window.removeEventListener('resize', scheduleMeasure);
    }
    const observer = new ResizeObserver(scheduleMeasure);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [measureBottomBar, scheduleMeasure]);

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

  const onChange = React.useCallback((_elements: any, appState: any) => {
    writeJson();
    scheduleSvg();
    if (appState?.theme) setTheme(appState.theme);
    // Selecting an element opens the mobile properties panel, which makes the
    // bottom bar taller.
    scheduleMeasure();
  }, [writeJson, scheduleSvg, scheduleMeasure]);

  // Save: the plugin reads the hidden inputs the moment a Joplin button closes
  // the dialog, and exporting the SVG is asynchronous — so finish the export
  // first, then click Joplin's own Save button, which is what resolves
  // dialogs.open() with the form data.
  const onSave = React.useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      cancelScheduledSvg();
      writeJson();
      await writeSvg();
    } catch (error) {
      console.error('excalidraw: could not export the drawing:', error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    clickJoplinButton('Save', 'first');
  }, [cancelScheduledSvg, writeJson, writeSvg]);

  // Close: discard whatever the hidden inputs hold and let Joplin dismiss the
  // dialog. Escape does the same thing through Joplin itself.
  const onClose = React.useCallback(() => {
    if (savingRef.current) return;
    clickJoplinButton('Close', 'last');
  }, []);

  // Our own controls: one island at the bottom right of the canvas, drawn by
  // this app rather than borrowed from Excalidraw's top-right slot or from
  // Joplin's button bar, so nothing can collide with Excalidraw's own UI.
  // Nothing is rendered when the Joplin dialog is out of reach — there would be
  // no dialog to resize and no buttons to click, and Joplin's own bar is then
  // still visible.
  const actions = () => {
    if (!dialogElement) return null;
    const sizeLabel = fullSize ? 'Normal size' : 'Full size';
    return React.createElement(
      'div',
      {
        // The `excalidraw` and `theme--dark` classes are what make Excalidraw's
        // design tokens (--island-bg-color, --color-primary, --lg-button-size,
        // ...) resolve here: they are declared on the editor's root element,
        // and this island is its sibling, not its descendant.
        className: 'excalidraw excalidraw-plugin-actions' + (theme === 'dark' ? ' theme--dark' : ''),
      },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'excalidraw-plugin-action excalidraw-plugin-action--icon',
          title: sizeLabel,
          'aria-label': sizeLabel,
          disabled: saving,
          onClick: toggleFullSize,
        },
        fullSize ? collapseIcon() : expandIcon(),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'excalidraw-plugin-action excalidraw-plugin-action--primary',
          title: 'Save the drawing and close the editor',
          disabled: saving,
          'aria-busy': saving,
          onClick: onSave,
        },
        'Save',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'excalidraw-plugin-action',
          title: 'Close the editor without saving',
          disabled: saving,
          onClick: onClose,
        },
        'Close',
      ),
    );
  };

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "excalidraw-wrapper", ref: wrapperRef },
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
      actions(),
    ),
  );
};

ReactDOM.render(React.createElement(App), document.getElementById("app"));
