var current_version = 111,
	div, linkStyle = "color:#ffffff;font-weight:bold;background:linear-gradient(to bottom, rgb(115, 152, 200) 0%,rgb(179, 206, 233) 1%,rgb(82, 142, 204) 5%,rgb(79, 137, 200) 20%,rgb(66, 120, 184) 50%,rgb(49, 97, 161) 100%);padding:3px;text-decoration:none;display:inline-block;width:70px;text-align:center;height:22px;box-sizing:border-box;line-height:14px;border:1px solid rgb(49,96,166);",
	settings;

function getSettings(callback) {
	chrome.storage.local.get(null, function(data) {
		settings = data;
		callback();
	});
}

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

// checks for updates and calls callback with true = new update available or false = no updates
function checkVersion(callback) {
	var xhr = new XMLHttpRequest();
	if(settings.updateServer) {
		xhr.open("GET", settings.updateServer+"/version", true);
		xhr.responseType = 'text';

		xhr.onreadystatechange = function() {

			if (xhr.readyState == 4) {
				if(xhr.status != 200)
					callback(false);
				var version = this.response*1;
				if (version > current_version)
					callback(true);
				else
					callback(false);
			}
		};
		xhr.send();
	}
	else
		callback(false);
}

function addTopBar() {
	if(div)
		return;
	
	div = document.createElement("div");
	
	div.id = randomString(20,40);
	
	div.style.fontSize = "13px";
	div.style.top = "50%";
	div.style.width = "100%";
	div.style.height = "54px";
	div.style.marginTop = "-150px";
	div.style.paddingTop = "4px";
	
	div.style.background = "linear-gradient(to bottom, rgba(0,0,0,0.9) 50%,rgba(0,0,0,0.7) 100%)";
	div.style.color = "#ffffff";
	div.style.textAlign = "center";
	div.style.lineHeight = "25px";
	div.style.zIndex = 2147483648;
	div.style.cursor = "default";
	div.style.overflow = "hidden";
	
	div.style.position = "fixed";
	
	document.documentElement.appendChild(div);
}

function updateDialog() {
	checkVersion(function(update) {
		if(update) {
			addTopBar();
			div.innerHTML = "This version of the \"Comixology Backup\" extension is outdated.<br><a href=\""+settings.updateServer+"/download.zip\" style='"+linkStyle+"' target='_blank'>Update</a>";
		}
	});
}

if(typeof Element.prototype.matches !== "function")
	Element.prototype.matches = Element.prototype.webkitMatchesSelector;

// Converts an RGB (0-255) color value to HSL (0-1)
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

// Converts an HSL (0-1) color value to RGB (0-255)
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

// Download files:
function downloadFile(name, data, overwrite, callback) { // overwrite is not used currently
	if(chrome.downloads) {
		chrome.downloads.download({
			url: data,
			filename: name,
			method: "GET",
			conflictAction: (overwrite?"overwrite":"uniquify")
		}, function(downloadId) {
			downloadFile.handlers[downloadId] = function(delta) {
				if(!delta.state || delta.state.current == "in_progress")
					return;
				delete downloadFile.handlers[downloadId];
				URL.revokeObjectURL(data);
			};
		});
	}
	else
		downloadFile.port.send({ name:name, data:data, overwrite:overwrite });
	if(typeof callback === "function")
		setTimeout(callback, 0);
}

if(chrome.downloads) {
	downloadFile.handlers = {};
	chrome.downloads.onChanged.addListener(function(downloadDelta) {
		console.log(downloadDelta);
		var a = downloadFile.handlers[downloadDelta.id];
		if(typeof a === "function")
			a(downloadDelta);
	});
}
else
	downloadFile.port = connector.connect({ name:"download" });