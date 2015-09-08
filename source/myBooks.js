"use strict";

getSettings(function() {

	if(!settings.queueLength)
		settings.queueLength = 1;

	updateDialog();

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
		
		//As yet unused
		this.series = "";
		this.title = "";
		this.publisher = "";
		this.pubMonth = "";
		this.pubYear = "";
		this.issue = "";
		this.numberOfIssues = "";
		this.volume = "";
		this.numberOfVolumes = "";
		this.rating = "";
		this.genre = "";
		this.language = "";
		this.country = "";
	}

	MetaData.prototype = {
		addWriter: function(newWriter) {
			if(this.writer !== "")
				this.writer = this.writer + ",";

			this.writer += newWriter;
		},

		addInks: function(newInks) {
			if(this.inks !== "")
				this.inks = this.inks + ",";

			this.inks += newInks;
		},

		addCover: function(newCover) {
			if(this.cover !== "")
				this.cover = this.cover + ",";

			this.cover += newCover;
		},

		addPencil: function(newPencil) {
			if(this.pencils !== "")
				this.pencils = this.pencils + ",";

			this.pencils += newPencil;
		},

		addColor: function(newColor) {
			if(this.colors !== "")
				this.colors = this.colors + ",";

			this.colors += newColor;
		},

		
		//Add a list of allowed modes to check against?
		changeOutputMode: function(newOutputMode){
		   this.outputMode = newOutputMode;
		},
		
		//Is there a better way? Maybe a util class?
		q: function(value){
			return "\"" + value + "\"";
		},
		
		q2: function(val1, val2){
		   return this.q(val1) + ":" + this.q(val2);
		},
		
	   JSONPerson: function(personArray, role, JSONString)
	   {
		for (var i = 0; i < personArray.length; i++)
		{
		    if (personArray[i] === undefined || personArray[i] == "")
			   continue;




  		    JSONString += "{";
			JSONString += this.q2("person", personArray[i]) + ",";
			JSONString += this.q2("role", role);
				
			if (i == 0)
				JSONString += "," + this.q2("primary", "YES");				  
				
			JSONString += "}";
			
			if (i < personArray.length-1)
			   JSONString += ",";
		}
		
		return JSONString;
	   },

		toString: function(outputMode) {
		   var useMode = outputMode;
		   
		    if (useMode === undefined)
			   useMode = this.outputMode;

			//I suppose it would be possible to create an object that contains the right
			//names already and just have JSON.stringify do the job.
			//It wouldn't be able to set primaries, though, would it?
			//Maybe do that later on
			if (useMode == "CBI")
			{
			   var myDate = new Date();
			   var CBIJSON = "";
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
			   
			   //Not defined in the example, hopefully supported?
			   CBIJSON = this.JSONPerson(this.cover.split(","), "Cover", CBIJSON);
			   
			   //We don't have those - yet?
			   //CBIJSON = this.JSONPerson(this.???.split(","), "Editor", CBIJSON);
			   //CBIJSON = this.JSONPerson(this.???.split(","), "Letterer", CBIJSON);
			   
			   CBIJSON += "]}}";			   
			}			
			return CBIJSON;
		}
	};

	var cssClass = randomString(20, 40),
		allButtonSelector = ".action-button.read-action",
		readButtonSelector = allButtonSelector + ":not(." + cssClass + ")",
		injectCss = function() {
			var style = document.createElement("style");
			style.type = "text/css";
			style.innerHTML = "." + cssClass + " span { position:absolute; width:auto; top:50%; margin-top:-0.5em; line-height:1em; left:0; right:0; transition:opacity 0.1s linear 0s; opacity:1; }\n." + cssClass + ".cancel:hover span { transition-delay:0.3s; }\n." + cssClass + " .cancel { opacity:0; }\n." + cssClass + ".cancel:hover .cancel { opacity:1; }\n." + cssClass + ".cancel:hover .text { opacity:0; }";
			document.head.appendChild(style);
		},
		downloadEvents = {},
		backupText = (function() {
			var c = document.querySelector("section.backup-container h1");
			return c && c.innerHTML || "DRM-Free Backup";
		}()),

		Download = function(button) {

			var metaData = this.metaData = new MetaData();

			//I'm getting the comic ID in the last array entry
			var parts = button.href.split("/");

			//Since we have the comic ID, we can directly access the container and even navigate
			//to the inner credits/metadata container
			var myXPath = "li[data-item-id=\"" + parts[parts.length - 1] + "\"]";
			var metaCont = document.querySelectorAll(myXPath);
			
			//metaCont should now have a list of DL elements for THIS COMIC
			var oneCredit, oneDT, allDD, i;
			for (var i = 0; i < metaCont.length; i++)
			{
			    	oneCredit = metaCont[i];
				oneDT = oneCredit.getElementsByTagName("dt")[0].firstChild.nodeValue;
				//Writer(s)
				if(oneDT.toLowerCase() == "written by" || oneDT.toLowerCase() == "by") {
					allDD = oneCredit.getElementsByTagName("dd");
					for(i = 0; i < allDD.length; i++)
						metaData.addWriter(allDD[i].innerText);
				}
				else if(oneDT.toLowerCase() == "inks") {
					allDD = oneCredit.getElementsByTagName("dd");
					for(i = 0; i < allDD.length; i++)
						metaData.addInks(allDD[i].innerText);
				}
				else if(oneDT.toLowerCase() == "cover by") {
					allDD = oneCredit.getElementsByTagName("dd");
					for(i = 0; i < allDD.length; i++)
						metaData.addCover(allDD[i].innerText);
				}
				else if(oneDT.toLowerCase() == "pencils") {
					allDD = oneCredit.getElementsByTagName("dd");
					for(i = 0; i < allDD.length; i++)
						metaData.addPencil(allDD[i].innerText);
				}
				else if(oneDT.toLowerCase() == "colored by") {
					allDD = oneCredit.getElementsByTagName("dd");
					for(i = 0; i < allDD.length; i++)
						metaData.addColor(allDD[i].innerText);
				}
			}

			//Continue with download

			this.readButton = button;
			var t = this,
				clone = t.downloadButton = button.cloneNode(false),
				buttonComputedStyle = window.getComputedStyle(button);

			t.id = Download.counter++;

			Download.connections[this.readButton.href] = this;

			// create colors:
			t.buttonBGs = {
				normal: buttonComputedStyle.background,
				gray: "#777777",
				progress: "linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.4) {X}%, rgba(0,0,0,0) {X}%, rgba(0,0,0,0) 100%), " + buttonComputedStyle.background
			};

			// create clone:
			var randomId = randomString(20, 40); // make sure cmxlgy can not break button text rendering by changing class names
			clone.innerHTML = button.innerHTML.replace(button.innerText.trim(), "<span class='text " + randomId + "'></span><span class='cancel'>Stop</span>");
			clone.style.position = "relative";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.href = "javascript:";
			clone.classList.add(cssClass);

			t.text = clone.querySelector("span.text." + randomId);

			this.show = function(b) {

				if(b && b.href == button.href && b !== button) // after switching pages via ajax new button html elements are created, those will be linked to the internal download object
					button = this.readButton = b;

				clone.style.width = parseInt(button.style.width = window.getComputedStyle(button).width) + "px";

				if(document.contains(clone))
					return;

				var parent = function goUp(button) { // recursively search for right parent element of read button
						if(button == null)
							return null;
						if(button.matches(".item-actions"))
							return button;
						return goUp(button.parentElement);
					}(button),
					backupContainer = parent ? parent.querySelector(".backup-container") : null;

				if(!parent)
					return;

				if(!backupContainer) {
					var fragment = document.createDocumentFragment(),
						cont = document.createElement("section");
					fragment.appendChild(document.createElement("hr"));
					cont.setAttribute("class", "backup-container");
					cont.innerHTML = "<h1>" + backupText + "</h1>";
					cont.appendChild(clone);
					fragment.appendChild(cont);
					parent.insertBefore(fragment, parent.querySelector(".archive-actions"));
				}
				else
					backupContainer.appendChild(clone);
			};

			if(settings.selectors) {
				clone.addEventListener("click", function() {
					t[t.cancelable ? "cancel" : "start"]();
				}, false);
				t.showDefault();
			}
			else {
				t.inactive = true;
				clone.addEventListener("click", function() {
					t.openTab(true);
				}, false);
				t.showInactive();
			}
		};

	Download.connections = {};

	Download.get = function(readButton) {
		return this.connections[readButton.href] || new Download(readButton);
	};

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
		readButton: null,
		downloadButton: null,
		text: null,
		tab: null,
		downloading: false,
		cancelable: false,
		canceled: false,
		buttonBGs: null,

		setDownloading: function(bool) {
			if(bool && !this.downloading)
				Download.activeDownloads++;
			else if(!bool && this.downloading) {
				Download.activeDownloads--;
				Download.queue.resume();
			}
			this.downloading = bool;
		},

		setCancelable: function(bool) {
			this.cancelable = bool;
			this.downloadButton.classList.toggle("cancel", bool);
		},

		openTab: function(active) {
			var t = this;
			port.send({
				what: "open_background_tab",
				url: t.readButton.href,
				active: active
			}, function(tab) {
				t.tab = tab;
				downloadEvents[tab] = t;
			});
		},

		start: function() {
			var t = this;
			if(t.downloading)
				return;
			if(Download.activeDownloads >= settings.queueLength && settings.queueLength > 0) {
				t.canceled = false;
				t.showQueued();
				return Download.queue.enqueue(t);
			}
			t.setDownloading(true);
			t.openTab(false);
			t.showPrepare();
		},

		cancel: function() {
			this.canceled = true;
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
			"ready_to_download": function(callback) {
				console.log(this.metaData);
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
			"finished_download": function() {
				port.send({
					what: "close_background_tab",
					tab: this.tab
				});
				delete downloadEvents[this.tab];
				this.tab = null;
				this.setDownloading(false);
				this.showDone();
			},
			"download_failed": function() {
				port.send({
					what: "close_background_tab",
					tab: this.tab
				});
				delete downloadEvents[this.tab];
				this.tab = null;
				this.setDownloading(false);
				this.showError();
			},
			"closed_background_tab": function() {
				if(!this.downloading)
					return;
				delete downloadEvents[this.tab];
				this.tab = null;
				this.setDownloading(false);
				this.showError();
			},
			"download_progress": function(callback, percentage) {
				this["show" + (percentage == "zip" ? "Zipping" : percentage == "save" ? "Saving" : "Progress")](percentage);
			}
		},

		// UI behaviour:

		showQueued: function() {
			this.text.innerHTML = "Queued...";
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(220deg)";
			this.setCancelable(true);
		},
		showPrepare: function() {
			this.text.innerHTML = "Preparing...";
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(245deg)";
			this.setCancelable(true);
		},
		showProgress: function(percentage) {
			this.downloadButton.style.background = this.buttonBGs.progress.replace(/\{X\}/g, percentage);
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(245deg)";
			this.text.innerHTML = percentage + "%";
			this.setCancelable(true);
		},
		showDefault: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(55deg)";
			this.text.innerHTML = "Scan Comic";
			this.setCancelable(false);
		},
		showDone: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(280deg)";
			this.text.innerHTML = "Scan Again";
			this.setCancelable(false);
		},
		showError: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(195deg)";
			this.text.innerHTML = "Scan Failed";
			this.setCancelable(false);
		},
		showZipping: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(260deg)";
			this.text.innerHTML = "Zipping...";
			this.setCancelable(true);
		},
		showSaving: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(270deg)";
			this.text.innerHTML = "Saving...";
			this.setCancelable(false);
		},
		showInactive: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(195deg)";
			this.text.innerHTML = "Setup Scanner";
			this.setCancelable(false);
		}
	};

	injectCss();

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

	function init() {
		var readButtons = document.body.querySelectorAll(readButtonSelector);
		for(var i = 0; i < readButtons.length; i++)
			Download.get(readButtons[i]).show(readButtons[i]);
	}

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

	window.onbeforeunload = function() {
		if(Download.activeDownloads > 0 || Download.queue.getLength() > 0)
			return "If you close this page all backups will be canceled.";
	};
});
