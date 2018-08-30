"use strict";

getSettings(function() {
	if(!settings.queueLength)
		settings.queueLength = 1;

	updateDialog();

	injectCss();

	init();

	new MutationObserver(function(mutations) {
		var reinit = false;
		mutations.forEach(function(mutation) {
			if(mutation.addedNodes && mutation.addedNodes.length || (mutation.attributeName && !mutation.target.matches(allButtonSelector)))
				reinit = true;
		});
		if(reinit)
			init();
	}).observe(document.getElementById("page_content_container"), {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["style"]
	});
});

function init() {
	Download.cleanUp();
	var readButtons = document.body.querySelectorAll(readButtonSelector);
	for(var i = 0; i < readButtons.length; i++)
		new Download(readButtons[i].href, readButtons[i]).show(readButtons[i]);
}

var cssClass = randomString(20, 40),
	allButtonSelector = "a.lv2-read-button",
	readButtonSelector = allButtonSelector + ":not(." + cssClass + ")",
	injectCss = function() {
		var style = document.createElement("style");
		style.type = "text/css";
		style.innerHTML = "." + cssClass + " span { transition:opacity 0.1s linear 0s; opacity:1; }\n." + cssClass + " .cancel { position:absolute; display:inline-block; left:0; right:0; }\n." + cssClass + ".cancel:hover span { transition-delay:0.3s; }\n." + cssClass + " .cancel { opacity:0; }\n." + cssClass + ".cancel:hover .cancel { opacity:1; }\n." + cssClass + ".cancel:hover .text { opacity:0; }";
		document.head.appendChild(style);
	},
	downloadEvents = {};

function Download(comicHref, readButton) {

	if(Download.connections[comicHref])
		return Download.connections[comicHref];

	//Metadata container, will be used in "show"
	var metaData = this.metaData = new MetaData();

	this.comicHref = comicHref;

	this.id = Download.counter++;

	this.buttons = new Map();

	Download.connections[comicHref] = this;
}

Download.cleanUp = function() {
	for(var href in Download.connections) {
		if(Download.connections[href] && Download.connections[href].stale) {
			Download.connections[href] = undefined;
		}
	}
};

Download.connections = {};

Download.counter = 0;
Download.activeDownloads = 0;

Download.updateParallelism = function(newLimit) {
	settings.queueLength = newLimit;
	if(newLimit > 0)
		for(var i = this.activeDownloads; i < newLimit; i++)
			this.queue.resume();
	else
		while(this.queue.resume());
};

// Queue definition: Stores all backup requests
Download.queue = new Queue();
Download.queue.resume = function() {
	var d;
	while((d = this.dequeue())) {
		if(d.canceled)
			continue;
		d.start();
		return true;
	}
	return false;
};

Download.prototype = {
	id: 0,
	comicHref: null,
	buttons: null,
	tab: null,
	queued: false,
	downloading: false,
	cancelable: false,
	canceled: false,
	currentButtonUI: null,

	get stale() {
		this.cleanUp();

		return this.buttons.size === 0 && !this.downloading && !this.queued;
	},

	cleanUp() {
		for(var button of this.buttons.keys()) {
			if(!document.contains(button))
				this.buttons.delete(button);
		}
	},

	show(button) {
		if(button.href !== this.comicHref || this.buttons.has(button)) // after switching pages via ajax new button html elements are created, those will be linked to the internal download object
			return;

		//Get Metadata
		this.metaData.scanMeta(button.parentNode);

		var clone = button.cloneNode(false),
			buttonComputedStyle = window.getComputedStyle(button);

		var randomId = randomString(20, 40); // make sure cmxlgy can not break button text rendering by changing class names
		clone.innerHTML = button.innerHTML.replace(button.innerHTML.trim(), "<span class='text " + randomId + "'></span><span class='cancel'>Stop</span>");
		clone.style.position = "relative";
		clone.style.textAlign = button.style.textAlign = "center";
		clone.href = "javascript:";

		clone.setAttribute("class", button.getAttribute("class"));

		clone.classList.add(cssClass);

		var buttonWidth = parseInt(button.style.width = buttonComputedStyle.width);

		clone.style.width = isFinite(buttonWidth) ? buttonWidth + "px" : button.style.width;

		this.buttons.set(button, {
			button: clone,
			text: clone.querySelector("span.text." + randomId),
			progressBG: "linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.4) {X}%, rgba(0,0,0,0) {X}%, rgba(0,0,0,0) 100%), " + buttonComputedStyle.background
		});
		if(settings.selectors || settings.selectors == null) {
			clone.addEventListener("click", function() {
				this[this.cancelable ? "cancel" : "start"]();
			}.bind(this), false);
			if(!this.currentButtonUI)
				this.showDefault();
			else
				this.setButtonUI.apply(this, this.currentButtonUI);
		}
		else {
			this.inactive = true;
			clone.addEventListener("click", this.openTab.bind(this, true), false);
			this.showInactive();
		}

		var parent = button.parentElement,
			parentClone = parent && parent.cloneNode(false);

		parentClone.appendChild(clone);

		parent.parentElement.insertBefore(parentClone, parent.nextSibling);
	},

	setDownloading(bool) {
		if(bool && !this.downloading)
			Download.activeDownloads++;
		else if(!bool && this.downloading) {
			Download.activeDownloads--;
			Download.queue.resume();
		}
		this.downloading = bool;
	},

	openTab(active) {
		var t = this;
		port.send({
			what: "open_background_tab",
			url: t.comicHref,
			active: active
		}, function(tab) {
			t.tab = tab;
			downloadEvents[tab] = t;
		});
	},

	start() {
		var t = this;
		if(t.downloading)
			return;
		if(Download.activeDownloads >= settings.queueLength && settings.queueLength > 0) {
			t.canceled = false;
			t.queued = true;
			t.showQueued();
			return Download.queue.enqueue(t);
		}
		t.queued = false;
		t.setDownloading(true);
		t.openTab(false);
		t.showPrepare();
	},

	cancel() {
		this.canceled = true;
		this.queued = false;
		this.showDefault();
		if(!this.downloading)
			return;
		port.send({
			what: "close_background_tab",
			tab: this.tab
		});
		delete downloadEvents[this.tab];
		this.tab = null;
		this.setDownloading(false);
	},

	// event handlers (receiving messages from the downloading tab):

	events: {
		ready_to_download(callback, comicName) {
			if(this.inactive)
				callback({
					exploit: true
				});
			else {
				callback({
					download: true,
					metaData: this.metaData.addTitle(comicName).toString()
				});
				this.showProgress(0);
			}
		},
		finished_download() {
			port.send({
				what: "close_background_tab",
				tab: this.tab
			});
			delete downloadEvents[this.tab];
			this.tab = null;
			this.setDownloading(false);
			this.showDone();
		},
		download_failed() {
			port.send({
				what: "close_background_tab",
				tab: this.tab
			});
			delete downloadEvents[this.tab];
			this.tab = null;
			this.setDownloading(false);
			this.showError();
		},
		closed_background_tab() {
			if(!this.downloading)
				return;
			delete downloadEvents[this.tab];
			this.tab = null;
			this.setDownloading(false);
			this.showError();
		},
		download_progress(callback, percentage) {
			this["show" + (percentage == "zip" ? "Zipping" : percentage == "save" ? "Saving" : "Progress")](percentage);
		}
	},

	// UI behaviour:

	setButtonUI(text, style, cancelable) {
		for(var entry of this.buttons.values()) {
			entry.text.innerHTML = text;
			entry.button.classList.toggle("cancel", cancelable);

			if("filter" in style)
				style["-webkit-filter"] = style.filter;

			if(style.background === "progress") {
				style.background = entry.progressBG.replace(/\{X\}/g, style.progress);
				delete style.progress;
			}

			for(var key in style) {
				var val = style[key];
				
				if(val == null)
					entry.button.style.removeProperty(key);
				else
					entry.button.style.setProperty(
						key,
						typeof val === "function"
							? val(window.getComputedStyle(entry.button).getPropertyValue(key))
							: val
					);
			}
		}
		this.currentButtonUI = arguments;
		this.cancelable = cancelable;
	},

	showQueued() {
		this.setButtonUI("Queued", {
			background: null,
			"padding-left": minPxVal("10px"),
			"padding-right": minPxVal("10px"),
			filter: "hue-rotate(220deg)"
		}, true);
	},
	showPrepare() {
		this.setButtonUI("Preparing", {
			background: null,
			"padding-left": minPxVal("2px"),
			"padding-right": minPxVal("2px"),
			filter: "hue-rotate(245deg)"
		}, true);
	},
	showProgress(percentage) {
		this.setButtonUI(percentage + "%", {
			background: "progress",
			progress: percentage,
			"padding-left": null,
			"padding-right": null,
			filter: "hue-rotate(245deg)"
		}, true);
	},
	showDefault() {
		this.setButtonUI("Scan", {
			background: null,
			"padding-left": null,
			"padding-right": null,
			filter: "hue-rotate(55deg)"
		}, false);
	},
	showDone() {
		this.setButtonUI("Rescan", {
			background: null,
			"padding-left": minPxVal("10px"),
			"padding-right": minPxVal("10px"),
			filter: "hue-rotate(280deg)"
		}, false);
	},
	showError() {
		this.setButtonUI("Failed", {
			background: null,
			"padding-left": null,
			"padding-right": null,
			filter: "hue-rotate(195deg)"
		}, false);
	},
	showZipping() {
		this.setButtonUI("Zipping", {
			background: null,
			"padding-left": minPxVal("10px"),
			"padding-right": minPxVal("10px"),
			filter: "hue-rotate(260deg)"
		}, true);
	},
	showSaving() {
		this.setButtonUI("Saving", {
			background: null,
			"padding-left": minPxVal("10px"),
			"padding-right": minPxVal("10px"),
			filter: "hue-rotate(270deg)"
		}, false);
	},
	showInactive() {
		this.setButtonUI("Setup", {
			background: null,
			"padding-left": null,
			"padding-right": null,
			filter: "hue-rotate(195deg)"
		}, false);
	}
};

var port = connector.connect({
	name: "controller"
});

port.receive(function(request, callback) {
	if(request.what == "child_message")
		return downloadEvents[request.tab] && typeof downloadEvents[request.tab].events[request.message.what] == "function" &&
			downloadEvents[request.tab].events[request.message.what].call(
				downloadEvents[request.tab],
				callback,
				request.message.data
			);
	else if((request.what == "child_broadcast" && request.message.what == "finished_scan") || request.what == "reload_page")
		location.reload();
	else if(request.what == "update_queue")
		Download.updateParallelism(request.data);
});

window.onbeforeunload = function() {
	if(Download.activeDownloads > 0 || Download.queue.getLength() > 0)
		return "If you close this page all backups will be canceled.";
};
