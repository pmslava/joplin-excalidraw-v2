// Build the payload Excalidraw itself puts on the clipboard when you copy
// elements, so that pasting into excalidraw.com, another drawing here, or any
// other Excalidraw host inserts real *elements* rather than a picture.
//
// Verified against the bundled @excalidraw/excalidraw 0.18
// (dist/prod/chunk-K2UTITRG.js, readable in dist/dev/chunk-4FTI6OG3.js):
//
//   EXPORT_DATA_TYPES.excalidrawClipboard === 'excalidraw/clipboard'
//
//   clipboardContainsElements = (data) =>
//     [EXPORT_DATA_TYPES.excalidraw,
//      EXPORT_DATA_TYPES.excalidrawClipboard,
//      EXPORT_DATA_TYPES.excalidrawClipboardWithAPI].includes(data?.type) &&
//     Array.isArray(data.elements)
//
//   parseClipboard(event) reads clipboardData's text/plain, JSON.parses it and,
//   if clipboardContainsElements() says yes, returns { elements, files }.
//
// So: plain text, `type: 'excalidraw/clipboard'`, an `elements` array, and a
// `files` map keyed by the fileId of the image elements being copied — which is
// exactly what Excalidraw's own serializeAsClipboardJSON() writes.
export const EXCALIDRAW_CLIPBOARD_TYPE = 'excalidraw/clipboard';

export const excalidrawClipboardPayload = (dataJson: string): string => {
	let scene: any = {};
	try {
		scene = JSON.parse(dataJson || '{}') ?? {};
	} catch (error) {
		throw new Error('the drawing source is not valid JSON');
	}

	// Excalidraw keeps deleted elements in the scene as tombstones; copying them
	// would paste invisible junk.
	const elements = (Array.isArray(scene.elements) ? scene.elements : [])
		.filter((element: any) => element && !element.isDeleted);

	// Only the binary files actually referenced by the copied elements travel
	// with them, same as serializeAsClipboardJSON().
	const sceneFiles = (scene.files && typeof scene.files === 'object') ? scene.files : {};
	const files: Record<string, any> = {};
	for (const element of elements) {
		const fileId = element.fileId;
		if (fileId && sceneFiles[fileId]) files[fileId] = sceneFiles[fileId];
	}

	return JSON.stringify({ type: EXCALIDRAW_CLIPBOARD_TYPE, elements, files });
};
