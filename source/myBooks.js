"use strict";

function MetaData() {

	//We may want to support different outputmodes later on
	//For now, there is only one: https://code.google.com/p/comicbookinfo/wiki/Example
	//This is used by Calibre
	this.outputMode = "CBI";

	//Metadata, credits - CSV
	this.writer = "";
	this.inks = "";
	this.pencils = "";
	this.colors = "";
	this.cover = "";
	this.editor = "";



	this.series = "";
	this.issue = "";
	
	//As yet unused
	this.title = "";
	this.publisher = "";
	this.pubMonth = "";
	this.pubYear = "";

	this.numberOfIssues = "";
	this.volume = "";
	this.numberOfVolumes = "";
	this.rating = "";
	this.genre = "";
	this.language = "";
	this.country = "";
}

MetaData.prototype = {
	addWriter(newWriter) {
		if(this.writer !== "")
			this.writer = this.writer + ",";

		this.writer += newWriter;
	},
	
	addEditor(newEditor) {
		if(this.editor !== "")
			this.editor = this.editor + ",";

		this.editor += newEditor;
	},
	
	addInks(newInks) {
		if(this.inks !== "")
			this.inks = this.inks + ",";

		this.inks += newInks;
	},

	addCover(newCover) {
		if(this.cover !== "")
			this.cover = this.cover + ",";

		this.cover += newCover;
	},

	addPencil(newPencil) {
		if(this.pencils !== "")
			this.pencils = this.pencils + ",";

		this.pencils += newPencil;
	},

	addColor(newColor) {
		if(this.colors !== "")
			this.colors = this.colors + ",";

		this.colors += newColor;
	},

	//Add a list of allowed modes to check against?
	changeOutputMode(newOutputMode) {
		this.outputMode = newOutputMode;
	},

	//Is there a better way? Maybe a util class?
	q(value) {
		return "\"" + value + "\"";
	},

	q2(val1, val2) {
		return this.q(val1) + ":" + this.q(val2);
	},

	JSONPerson(personArray, role, JSONString) {
		var tmpJSON = "";
		var first = true;

		for(var i = 0; i < personArray.length; i++) {
			if(personArray[i] === undefined || personArray[i] === "")
				continue;

			tmpJSON += "{";
			tmpJSON += this.q2("person", personArray[i]) + ",";
			tmpJSON += this.q2("role", role);

			//Sometimes we may get arrays with empty lines before the first contentline
			if(first == true)
				tmpJSON += "," + this.q2("primary", true);
		    first = false;

			tmpJSON += "}";
		}

		//Maybe we've been called before, maybe something else added persons before this function
		//in any case, we need to check if we have to put a comma  before us or not
		if(tmpJSON !== "" && JSONString.substr(JSONString.length - 1) == "}")
			tmpJSON = "," + tmpJSON;

		JSONString += tmpJSON;
		return JSONString;
	},

	toString(outputMode) {
		var useMode = outputMode;

		if(useMode === undefined)
			useMode = this.outputMode;

		//I suppose it would be possible to create an object that contains the right
		//names already and just have JSON.stringify do the job.
		//It wouldn't be able to set primaries, though, would it?
		//Maybe do that later on

		var CBIJSON = "";

		//No XOR?
		//Calibre doesn't accept metadata where issue but not volume has content, so we have to supply both
		//I don't think this is right and I'll ask the author of Calibre. For now, I'll leave this in, as a bugfix
		//Calibre actually doesn't read in any metadata when this is not filled
		if (this.issue == "" || this.volume == "")
		  if (this.issue == "" && this.volume != "")
		     this.issue = this.volume;
		  else
		     this.volume = this.issue;

		if(useMode == "CBI") {
			var myDate = new Date();
			CBIJSON += "{";
			CBIJSON += this.q2("appID", "Comixology Backup") + ",";
			CBIJSON += this.q2("lastModified", myDate.toJSON()) + ",";
			CBIJSON += this.q("ComicBookInfo/1.0") + ": {";

			CBIJSON += this.q2("series", this.series) + ",";			
			CBIJSON += this.q2("title", this.title) + ",";
			CBIJSON += this.q2("publisher", this.publisher) + ",";
			CBIJSON += this.q2("publicationMonth", this.pubMonth) + ",";
			CBIJSON += this.q2("publicationYear", this.pubYear) + ",";
			CBIJSON += this.q2("issue", this.issue) + ",";
			CBIJSON += this.q2("numberOfIssues", this.numberOfIssues) + ",";
			CBIJSON += this.q2("volume", this.volume) + ",";
			CBIJSON += this.q2("numberOfVolumes", this.numberOfVolumes) + ",";
			CBIJSON += this.q2("rating", this.rating) + ",";
			CBIJSON += this.q2("genre", this.genre) + ",";
			CBIJSON += this.q2("language", this.language) + ",";
			CBIJSON += this.q2("country", this.country) + ",";

			CBIJSON += this.q("credits") + ":" + "[";
			CBIJSON = this.JSONPerson(this.writer.split(","), "Writer", CBIJSON);
			CBIJSON = this.JSONPerson((this.inks + "," + this.pencils).split(","), "Artist", CBIJSON);
			CBIJSON = this.JSONPerson(this.colors.split(","), "Colorer", CBIJSON);
			CBIJSON = this.JSONPerson(this.editor.split(","), "Editor", CBIJSON);

			//Not defined in the example, hopefully supported?
			CBIJSON = this.JSONPerson(this.cover.split(","), "Cover", CBIJSON);

			//We don't have those - yet?
			

			//CBIJSON = this.JSONPerson(this.???.split(","), "Letterer", CBIJSON);

			CBIJSON += "]}}";
		}

		return CBIJSON;
	}
};

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

	//Metadata container
	var metaData = this.metaData = new MetaData();

	//To find the metadata, we need to find the top container for this comic
	//unfortunately, they're not marked with a special id :-(
	var bookItem = readButton.parentNode;

	//Try to find the detail container, do nothing if it's not there - it means we're not on a detail page
	if(bookItem.className != null)
	 try
	 {
		if(bookItem.className == "lv2-item-action-row") {
			while(bookItem !== undefined && bookItem.className != "lv2-item-detail")
				bookItem = bookItem.parentNode;

			//A bit of a gamble, I'm assuming there's always just one

			var itemTitleRaw = bookItem.getElementsByClassName("lv2-title-container")[0];
			var itemCreditRaw = bookItem.getElementsByTagName("aside")[0];

			//Ignore the actual hierarchy, just take all DLs, which should contain DD/DT pairs with credits
			var allCredits = itemCreditRaw.getElementsByTagName("dl");
			for(var i = 0; i < allCredits.length; i++) {
				//There should be only one DT/DD anyway
				var oneDT = allCredits[i].getElementsByTagName("dt")[0];
				var oneDD = allCredits[i].getElementsByTagName("dd")[0];
				var oneDTlc = oneDT.innerText.toLowerCase();
				
				if (oneDTlc == "full series"){
				   metaData.series = oneDD.innerText;
				}
				else if(oneDTlc == "writer" || oneDTlc == "written by" || oneDTlc == "by") {
					metaData.addWriter(oneDD.innerText);
				}
				else if(oneDTlc == "inks") {
					metaData.addInks(oneDD.innerText);
				}
				else if(oneDTlc == "cover by" || oneDTlc == "cover") {
					metaData.addCover(oneDD.innerText);
				}
				else if(oneDTlc == "art" || oneDTlc == "penciler" || oneDTlc == "pencils") {
					metaData.addPencil(oneDD.innerText);
				}
				else if(oneDTlc == "colored by" || oneDTlc == "colorist") {
					metaData.addColor(oneDD.innerText);
				}
				else if(oneDTlc == "editor") {
					metaData.addEditor(oneDD.innerText);
				}
			}
			
			//We know that under lv2-title-container there should be a single node with lv2-item-number
			var itemNumber = itemTitleRaw.getElementsByClassName("lv2-item-number")[0].innerText;
			//This will only work in some cases - apparently sometimes there are title additions in the issue field
			//still, better than nothing?
			itemNumber = parseInt(itemNumber.replace("#",""));
			if (!isNaN(itemNumber))
			   metaData.issue = itemNumber;
		}
	  }
	  catch(err)
	  {
	    //Die silently...
	  }

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


		if(settings.selectors) {
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
		ready_to_download(callback) {
				if(this.inactive)
					callback({
						exploit: true
					});
				else {
					callback({
						download: true,
						metaData: this.metaData.toString()
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
				if(style[key] == null)
					entry.button.style.removeProperty(key);
				else
					entry.button.style.setProperty(key, style[key]);
			}
		}
		this.currentButtonUI = arguments;
		this.cancelable = cancelable;
	},

	showQueued() {
		this.setButtonUI("Queued", {
			background: null,
			"padding-left": "10px",
			"padding-right": "10px",
			filter: "hue-rotate(220deg)"
		}, true);
	},
	showPrepare() {
		this.setButtonUI("Preparing", {
			background: null,
			"padding-left": "2px",
			"padding-right": "2px",
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
			"padding-left": "10px",
			"padding-right": "10px",
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
			"padding-left": "10px",
			"padding-right": "10px",
			filter: "hue-rotate(260deg)"
		}, true);
	},
	showSaving() {
		this.setButtonUI("Saving", {
			background: null,
			"padding-left": "10px",
			"padding-right": "10px",
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
