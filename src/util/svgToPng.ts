// Rasterise a drawing's exported SVG into a PNG data URL.
//
// This runs in the plugin's main script, i.e. inside Joplin's hidden plugin
// BrowserWindow: PluginRunner.ts creates it with `show: false`,
// `nodeIntegration: true`, `contextIsolation: false` and loads
// `plugin_index.html` into it, so it is a real Chromium window and `Image`,
// `DOMParser`, `document` and `<canvas>` are all available here.
//
// WHY THIS EXISTS AT ALL
// ----------------------
// Joplin already has a "Copy image" action, but in the Markdown *editor* it
// decodes the resource with Electron's nativeImage, which cannot read SVG
// (laurent22/joplin#15878) — so for an Excalidraw drawing it silently copies
// nothing. (The *viewer*'s "Copy image" works, because there the browser copies
// the already-rendered bitmap.) `joplin.clipboard.writeImage()` likewise only
// takes a raster data URL. So to copy a drawing as an image the plugin has to
// produce the bitmap itself, which is what this file does.
//
// Dark drawings carry Excalidraw's invert filter on the root <svg>
// (`filter="invert(…) hue-rotate(180deg) …"`, written by `exportToSvg` when the
// scene's theme is dark). Chromium applies that filter while painting the SVG
// through an <img>, so a dark drawing rasterises dark with no extra handling —
// exactly what the note viewer already shows.

// Drawn at 2x so the PNG still looks crisp when pasted on a HiDPI screen...
export const PNG_SCALE = 2;
// ...but never larger than this on the longer side, to keep the clipboard sane.
export const PNG_MAX_SIDE = 4096;

const parseLength = (value: string | null): number => {
	if (!value) return 0;
	const parsed = parseFloat(String(value).replace(/[^0-9.eE+-]/g, ''));
	return isFinite(parsed) && parsed > 0 ? parsed : 0;
};

// Fallback for an SVG that DOMParser refuses: read one attribute off the
// opening <svg> tag. The leading \s matters — a bare \bwidth would also match
// "stroke-width".
const attributeFromOpenTag = (svgText: string, name: string): string | null => {
	const openTag = /<svg[\s>][^>]*>/i.exec(svgText);
	if (!openTag) return null;
	const pattern = new RegExp('[\\s]' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i');
	const match = pattern.exec(openTag[0]);
	if (!match) return null;
	return match[1] !== undefined ? match[1] : match[2];
};

// The drawing's size in CSS pixels: the root <svg>'s width/height, falling back
// to the last two numbers of its viewBox.
export const svgPixelSize = (svgText: string): { width: number, height: number } => {
	let root: Element | null = null;
	try {
		const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
		const element = parsed.documentElement;
		if (element && element.nodeName.toLowerCase() === 'svg') root = element;
	} catch (error) {
		// fall through to the regex
	}

	const attribute = (name: string): string | null =>
		root ? root.getAttribute(name) : attributeFromOpenTag(svgText, name);

	let width = parseLength(attribute('width'));
	let height = parseLength(attribute('height'));

	if (!width || !height) {
		const viewBox = String(attribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
		if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
			width = width || viewBox[2];
			height = height || viewBox[3];
		}
	}

	return { width: width || 1, height: height || 1 };
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('could not rasterise the drawing SVG'));
		image.src = url;
	});
};

export const svgToPngDataUrl = async (svgText: string): Promise<string> => {
	const { width, height } = svgPixelSize(svgText);

	// A data: URL keeps the SVG self-contained. An <img> cannot fetch external
	// resources anyway, so nothing is lost compared to a blob: URL.
	const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
	const image = await loadImage(url);

	const scale = Math.min(PNG_SCALE, PNG_MAX_SIDE / Math.max(width, height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));

	const context = canvas.getContext('2d');
	if (!context) throw new Error('could not get a 2d canvas context');
	context.drawImage(image, 0, 0, canvas.width, canvas.height);

	return canvas.toDataURL('image/png');
};
