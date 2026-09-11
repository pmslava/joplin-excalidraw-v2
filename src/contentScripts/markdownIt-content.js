// Companion asset for the Excalidraw markdown-it content script (markdownIt.ts).
//
// Runs inside the Joplin Markdown viewer AND the Rich Text Editor. As of
// laurent22/joplin#12106 (merged 2025-04-17) the Rich Text Editor enables a
// Content-Security-Policy that blocks inline event handlers (onclick="...",
// ondblclick="...", ...); the same PR started loading plugin assets in the Rich
// Text Editor too. So instead of stringifying handlers into inline attributes
// (which are silently killed by that CSP), we ship this asset and wire up all
// interactions with addEventListener / DOM event properties, which the CSP allows.
//
// The markdown-it renderer only *tags* the Excalidraw images; this file finds
// them and attaches the actions:
//   - v2 drawings:        <img class="excalidraw-plugin--editable" ...>            -> a hover toolbar
//                                                                                    (Edit, Edit in new
//                                                                                     window, Copy as
//                                                                                     image, Copy as
//                                                                                     JSON)
//   - legacy v1 diagrams: <img class="excalidraw-plugin--convertible"
//                              data-excalidraw-plugin-diagram-id="..." ...>        -> "Convert to v2"
//
// NOTE: this file is intentionally plain JavaScript, not TypeScript. The webpack
// "extraScripts" pipeline emits CommonJS modules (module.exports = ...), which is
// invalid for a browser-injected asset; instead this file is copied verbatim into
// dist/ by the copy-webpack-plugin. Keep it plain JS.

(function () {
	// Must match Config.ContentScriptId in src/index.ts.
	var contentScriptId = 'io.github.pmslava.excalidraw.markdownIt';

	// webviewApi is injected by Joplin into the viewer / Rich Text Editor webview.
	function getWebviewApi() {
		try {
			return typeof webviewApi !== 'undefined' ? webviewApi : null;
		} catch (e) {
			return null;
		}
	}

	// Post a message to the plugin. Prefers webviewApi; falls back to the
	// PluginService hack for older Joplin Rich Text Editor webviews that don't
	// expose a webviewApi. Returns a Promise, or null if no channel is available.
	function postMessage(message) {
		var api = getWebviewApi();
		if (api && typeof api.postMessage === 'function') {
			return api.postMessage(contentScriptId, message);
		}
		try {
			var PluginService = top.require('@joplin/lib/services/plugins/PluginService').default;
			var service = PluginService.instance();
			var pluginId = service.pluginIdByContentScriptId(contentScriptId);
			return service.pluginById(pluginId).emitContentScriptMessage(contentScriptId, message);
		} catch (e) {
			return null;
		}
	}

	// Give an edited drawing's <img> a fresh cachebreaker so the new SVG loads.
	function bustCachebreaker(src) {
		var base = src.split('?')[0];
		return base + '?t=' + Date.now();
	}

	function resolveImage(arg) {
		if (arg && arg.nodeType === 1) return arg;
		return arg && arg.currentTarget ? arg.currentTarget : null;
	}

	// v2: open the editor for an existing drawing. The message format is just the
	// encoded image src, unchanged since the first version of the plugin.
	function onEdit(arg) {
		var image = resolveImage(arg);
		if (!image) return;
		var message = encodeURIComponent(image.src);
		var result = postMessage(message);
		if (!result) return;
		result
			.then(function (resourceId) {
				if (!resourceId) return;
				var toRefresh = document.querySelectorAll('img[data-resource-id="' + resourceId + '"]');
				Array.prototype.forEach.call(toRefresh, function (el) {
					el.src = bustCachebreaker(el.src);
				});
			})
			.catch(function (err) {
				console.error('Error posting message for editing:', err, '\nMessage: ', message);
			});
	}

	// The other three actions carry the same encoded src behind a prefix; the
	// plugin decodes the whole message, strips the prefix and parses the resource
	// id out of what is left (same shape as 'convert_v1_').
	function sendWithPrefix(prefix, image, what) {
		var message = prefix + encodeURIComponent(image.src);
		var result = postMessage(message);
		if (!result) return;
		result.catch(function (err) {
			console.error('Error posting message for ' + what + ':', err, '\nMessage: ', message);
		});
	}

	// v2: open the editor in a second Joplin window, so the note and the drawing
	// can be worked on side by side.
	function onEditInNewWindow(arg) {
		var image = resolveImage(arg);
		if (image) sendWithPrefix('excalidraw_new_window_', image, 'editing in a new window');
	}

	// v2: put the drawing on the clipboard as a PNG.
	function onCopyImage(arg) {
		var image = resolveImage(arg);
		if (image) sendWithPrefix('excalidraw_copy_image_', image, 'copying as an image');
	}

	// v2: put the drawing on the clipboard as Excalidraw's own JSON clipboard
	// format, whose elements paste back as real, editable shapes.
	function onCopyExcalidraw(arg) {
		var image = resolveImage(arg);
		if (image) sendWithPrefix('excalidraw_copy_excalidraw_', image, 'copying as JSON');
	}

	// v1: convert a legacy diagram to v2. The note update refreshes the preview.
	function onConvert(arg) {
		var image = resolveImage(arg);
		if (!image) return;
		var diagramId = image.getAttribute('data-excalidraw-plugin-diagram-id');
		if (!diagramId) return;
		var message = 'convert_v1_' + encodeURIComponent(diagramId);
		var result = postMessage(message);
		if (!result) return;
		result
			.then(function (svgResourceId) {
				console.log('successfully converted v1', diagramId, 'into v2', svgResourceId);
			})
			.catch(function (err) {
				console.error('Error posting message for conversion:', err, '\nMessage: ', message);
			});
	}

	function isRichTextEditor() {
		return document.body.classList.contains('mce-content-body') || document.body.id === 'tinymce';
	}

	// True for HTML notes and exported HTML, where an injected wrapper/button would
	// be undesirable (always visible, or saved into the note).
	function isHtmlNote() {
		return !document.body.querySelector('#rendered-md');
	}

	function hasFocus(element) {
		return element.contains(document.activeElement);
	}

	// 16 px line icons, drawn with the current text colour so they follow Joplin's
	// theme. Static markup assigned through innerHTML: no inline event attributes,
	// so the Rich Text editor's CSP has nothing to strip (it doesn't get a toolbar
	// anyway, but the viewer shares this code).
	function icon(paths) {
		return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"' +
			' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
			paths + '</svg>';
	}

	// pencil
	var ICON_EDIT = icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>');
	// window with an arrow leaving it
	var ICON_NEW_WINDOW = icon('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
		'<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>');
	// picture frame
	var ICON_IMAGE = icon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
		'<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>');
	// curly braces: the drawing's own data, not a picture of it
	var ICON_EXCALIDRAW = icon('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/>' +
		'<path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>');

	var EDIT_ACTIONS = [
		{ title: 'Edit drawing', icon: ICON_EDIT, handler: onEdit },
		{ title: 'Edit drawing in a new window', icon: ICON_NEW_WINDOW, handler: onEditInNewWindow },
		{ title: 'Copy drawing as image', icon: ICON_IMAGE, handler: onCopyImage },
		{ title: 'Copy as JSON', icon: ICON_EXCALIDRAW, handler: onCopyExcalidraw },
	];

	// Legacy v1 diagrams get the same island, holding one text button.
	var CONVERT_ACTIONS = [
		{ title: 'Convert this diagram to the current format', label: 'Convert to v2 🔄', handler: onConvert },
	];

	// Float a hover/focus toolbar over the drawing's corner (Markdown viewer only).
	// The image is NEVER wrapped or moved: it stays exactly where Joplin rendered
	// it, so a right-click still lands on the <img> and Joplin's "Copy image"
	// context-menu action keeps working. The toolbar lives in a sibling container
	// and is positioned over the image here in JS.
	function addToolbar(image, actions) {
		var next = image.nextElementSibling;
		if (next && next.classList && next.classList.contains('excalidraw-plugin--toolbarContainer')) {
			return;
		}

		var container = document.createElement('span');
		container.className = 'excalidraw-plugin--toolbarContainer';

		var toolbar = document.createElement('span');
		toolbar.className = 'excalidraw-plugin--toolbar';
		container.appendChild(toolbar);

		var buttons = actions.map(function (action) {
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'excalidraw-plugin--toolbarButton';
			button.title = action.title;
			button.setAttribute('aria-label', action.title);
			if (action.icon) {
				button.classList.add('-icon');
				button.innerHTML = action.icon;
			} else {
				button.classList.add('-text');
				button.textContent = action.label;
			}
			button.addEventListener('click', function () {
				action.handler(image);
			});
			toolbar.appendChild(button);
			return button;
		});

		image.insertAdjacentElement('afterend', container);

		var pointers = new Set();
		function updateVisible() {
			var show =
				pointers.size > 0 ||
				toolbar.matches(':hover') ||
				hasFocus(toolbar) ||
				hasFocus(image);
			container.classList.toggle('-show', show);
		}
		function updatePosition() {
			var imageBox = image.getBoundingClientRect();
			var containerBox = container.getBoundingClientRect();
			// A larger `right` moves the island left, i.e. inside the image; the
			// 6 px keeps it off the very corner.
			toolbar.style.right = imageBox.right - containerBox.right + 6 + 'px';
			toolbar.style.top = imageBox.top - containerBox.top + 6 + 'px';
		}

		image.addEventListener('pointerenter', function (event) {
			pointers.add(event.pointerId);
			updateVisible();
			updatePosition();
		});
		image.addEventListener('pointerleave', function (event) {
			pointers.delete(event.pointerId);
			updateVisible();
		});
		[image].concat(buttons).forEach(function (el) {
			el.addEventListener('focus', function () {
				updateVisible();
				updatePosition();
			});
			el.addEventListener('blur', function () {
				// Delay so tabbing image -> toolbar doesn't flash the toolbar away.
				requestAnimationFrame(updateVisible);
			});
		});
	}

	function processImage(image, handler, actions) {
		// Already processed? Use the event-listener property as the marker: unlike a
		// data-attribute or a class, the Rich Text Editor does not serialise it back
		// into the note content.
		if (image.ondblclick === handler) return;
		image.ondblclick = handler;

		if (isRichTextEditor() || isHtmlNote()) {
			// Don't inject a toolbar here: in the Rich Text Editor the extra DOM is
			// saved into the note; in HTML notes it would always be visible.
			// Double-click still edits.
			image.style.cursor = 'pointer';
		} else if (getWebviewApi()) {
			addToolbar(image, actions);
		}
	}

	function processImages() {
		if (!document.body) return;

		var editable = document.querySelectorAll('img.excalidraw-plugin--editable');
		Array.prototype.forEach.call(editable, function (image) {
			processImage(image, onEdit, EDIT_ACTIONS);
		});

		var convertible = document.querySelectorAll('img.excalidraw-plugin--convertible');
		Array.prototype.forEach.call(convertible, function (image) {
			processImage(image, onConvert, CONVERT_ACTIONS);
		});
	}

	// Joplin re-fires this when the rendered note changes.
	document.addEventListener('joplin-noteDidUpdate', processImages);

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', processImages);
	} else {
		processImages();
	}
})();
