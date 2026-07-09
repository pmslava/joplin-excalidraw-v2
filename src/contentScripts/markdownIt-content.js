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
//   - v2 drawings:        <img class="excalidraw--editable" ...>            -> "Edit"
//   - legacy v1 diagrams: <img class="excalidraw--convertible"
//                              data-excalidraw-diagram-id="..." ...>        -> "Convert to v2"
//
// NOTE: this file is intentionally plain JavaScript, not TypeScript. The webpack
// "extraScripts" pipeline emits CommonJS modules (module.exports = ...), which is
// invalid for a browser-injected asset; instead this file is copied verbatim into
// dist/ by the copy-webpack-plugin. Keep it plain JS.

(function () {
	// Must match Config.ContentScriptId in src/index.ts.
	var contentScriptId = 'excalidraw-script';

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

	// v2: open the editor for an existing drawing.
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

	// v1: convert a legacy diagram to v2. The note update refreshes the preview.
	function onConvert(arg) {
		var image = resolveImage(arg);
		if (!image) return;
		var diagramId = image.getAttribute('data-excalidraw-diagram-id');
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

	// Float a hover/focus button over the drawing's corner (Markdown viewer only).
	// The image is NEVER wrapped or moved: it stays exactly where Joplin rendered
	// it, so a right-click still lands on the <img> and Joplin's "Copy image"
	// context-menu action keeps working. The button lives in a sibling container
	// and is positioned over the image here in JS.
	function addButton(image, label, handler) {
		var next = image.nextElementSibling;
		if (next && next.classList && next.classList.contains('excalidraw--editButtonContainer')) {
			return;
		}

		var container = document.createElement('span');
		container.className = 'excalidraw--editButtonContainer';

		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'excalidraw--editButton';
		button.textContent = label;
		container.appendChild(button);

		image.insertAdjacentElement('afterend', container);
		button.addEventListener('click', function () {
			handler(image);
		});

		var pointers = new Set();
		function updateVisible() {
			var show =
				pointers.size > 0 ||
				button.matches(':hover, :focus') ||
				hasFocus(button) ||
				hasFocus(image);
			container.classList.toggle('-show', show);
		}
		function updatePosition() {
			var imageBox = image.getBoundingClientRect();
			var containerBox = container.getBoundingClientRect();
			button.style.right = imageBox.right - containerBox.right + 'px';
			button.style.top = imageBox.top - containerBox.top + 'px';
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
		[image, button].forEach(function (el) {
			el.addEventListener('focus', function () {
				updateVisible();
				updatePosition();
			});
			el.addEventListener('blur', function () {
				// Delay so tabbing image -> button doesn't flash the button away.
				requestAnimationFrame(updateVisible);
			});
		});
	}

	function processImage(image, handler, label) {
		// Already processed? Use the event-listener property as the marker: unlike a
		// data-attribute or a class, the Rich Text Editor does not serialise it back
		// into the note content.
		if (image.ondblclick === handler) return;
		image.ondblclick = handler;

		if (isRichTextEditor() || isHtmlNote()) {
			// Don't inject a button here: in the Rich Text Editor the extra DOM is
			// saved into the note; in HTML notes it would always be visible.
			// Double-click still edits.
			image.style.cursor = 'pointer';
		} else if (getWebviewApi()) {
			addButton(image, label, handler);
		}
	}

	function processImages() {
		if (!document.body) return;

		var editable = document.querySelectorAll('img.excalidraw--editable');
		Array.prototype.forEach.call(editable, function (image) {
			processImage(image, onEdit, 'Edit 🖊️');
		});

		var convertible = document.querySelectorAll('img.excalidraw--convertible');
		Array.prototype.forEach.call(convertible, function (image) {
			processImage(image, onConvert, 'Convert to v2 🔄');
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
