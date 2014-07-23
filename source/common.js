function randomString(min, max) { // generates random alphanumeric string with a length between min and max - it never starts with a number so that results can be used as class names etc.
	var poss = "abcdefghijklmnopqrstuvwxyz0123456789",
		l = Math.round(Math.random()*(max-min))+min;
	for (var r = ""; r.length < l;)
		r += poss.charAt(Math.round(Math.random()*(poss.length-(r.length?1:11))));
	return r;
}

function nullFill(num, len) {
	num += "";
	while(num.length < len)
		num = "0"+num;
	return num;
}

if(typeof Element.prototype.matches !== "function")
	Element.prototype.matches = Element.prototype.webkitMatchesSelector;

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */

function rgbToHsl(r, g, b) {
	r /= 255, g /= 255, b /= 255;

	var max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
		case r:
			h = (g - b) / d + (g < b ? 6 : 0);
			break;
		case g:
			h = (b - r) / d + 2;
			break;
		case b:
			h = (r - g) / d + 4;
			break;
		}

		h /= 6;
	}

	return [h, s, l];
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 */

function hslToRgb(h, s, l) {
	var r, g, b;

	if (s == 0) {
		r = g = b = l; // achromatic
	} else {
		function hue2rgb(p, q, t) {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		}

		var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;

		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	return [r * 255, g * 255, b * 255];
}

function downloadFile(name, data, overwrite, callback) { // overwrite is not used currently
	setTimeout(function() {
		var a = document.createElement("a");
		a.download = a.innerHTML = name;
		a.href = data;
		a.click();
		if(typeof callback === "function")
			callback();
	}, 0);
}
/**
 * dataURLtoBlob by github.com/blueimp/JavaScript-Canvas-to-Blob
 * Released under the MIT License
 */
function dataURLtoBlob(dataURI) {
	var byteString,
		arrayBuffer,
		intArray,
		i,
		mimeString;
	if (dataURI.split(',')[0].indexOf('base64') >= 0) {
		// Convert base64 to raw binary data held in a string:
		byteString = atob(dataURI.split(',')[1]);
	} else {
		// Convert base64/URLEncoded data component to raw binary data:
		byteString = decodeURIComponent(dataURI.split(',')[1]);
	}
	// Write the bytes of the string to an ArrayBuffer:
	arrayBuffer = new ArrayBuffer(byteString.length);
	intArray = new Uint8Array(arrayBuffer);
	for (i = 0; i < byteString.length; i += 1) {
		intArray[i] = byteString.charCodeAt(i);
	}
	// Separate out the mime component:
	mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
	// Write the ArrayBuffer (or ArrayBufferView) to a blob:
	return new Blob([intArray], {type: mimeString});
}

// Queue implementation by code.stephenmorley.org
function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}};

// Custom communication API to enable callbacks in continous connections between content and background scripts:

var connector = Object.create(chrome.runtime);

connector.mutatePort = function(port) {
	
	var c = 1, l = new Queue(), callbacks = {}
	
	port.send = function(msg, callback) {
		var id = l.dequeue() || c++;
		callbacks[id] = callback;
		this.postMessage({ id:id, type:0, message:msg }); // type0 message: A transmits msg to B
	};
	
	port.receive = function(callback) {
		var t = this, called = false;
		t.onMessage.addListener(function(msg) {
			if(msg.id !== undefined && !msg.type && !callback(msg.message, function(response) { // if callback returns true => B's response will be sent asynchronous (A will wait for a response as long as B requires => RISK this could be endless!)
				called = true;
				t.postMessage({ id:msg.id, type:1, message:response }); // type1 message: B responds to A with response
			}) && !called)
				t.postMessage({ id:msg.id, type:2 }); // type2 message: B chose to not respond to A => A is notified, that no response will come
		});
	};
	
	port.onMessage.addListener(function(msg) {
		if(msg.id !== undefined && msg.type) {
			var f = callbacks[msg.id];
			delete callbacks[msg.id];
			if(typeof f === "function" && msg.type != 2)
				f(msg.message);
			l.enqueue(msg.id);
		}
	});
	
	return port;
};

connector.connect = function() {
	var p = chrome.tabs || chrome.runtime,
		port = p.connect.apply(p, arguments);
	return this.mutatePort(port);
};

connector.onConnect = {
	addListener: function(callback) {
		return chrome.runtime.onConnect.addListener(function(port) {
			callback.call(this, connector.mutatePort(port));
		});
	}
};