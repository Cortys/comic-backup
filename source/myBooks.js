getSettings(function() {

	if(!settings.queueLength)
		settings.queueLength = 1;

	updateDialog();

	var cssClass = randomString(20, 40),
		readButtonSelector = ".action-button.read-action:not(."+cssClass+")",
		injectCss = function() {
			var style = document.createElement("style");
			style.type = "text/css";
			style.innerHTML = "."+cssClass+" span { position:absolute; width:auto; top:50%; margin-top:-0.5em; line-height:1em; left:0; right:0; transition:opacity 0.1s linear 0s; opacity:1; }\n."+cssClass+".cancel:hover span { transition-delay:0.3s; }\n."+cssClass+" .cancel { opacity:0; }\n."+cssClass+".cancel:hover .cancel { opacity:1; }\n."+cssClass+".cancel:hover .text { opacity:0; }";
			document.head.appendChild(style);
		},
		downloadEvents = {},
		backupText = (function() {
			var c = document.querySelector("section.backup-container h1");
			return c && c.innerHTML || "DRM-Free Backup";
		})(),

		Download = function(button) {
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
				progress: "linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.4) {X}%, rgba(0,0,0,0) {X}%, rgba(0,0,0,0) 100%), "+buttonComputedStyle.background
			};

			// create clone:
			var randomId = randomString(20, 40); // make sure cmxlgy can not break button text rendering by changing class names
			clone.innerHTML = button.innerHTML.replace(button.innerText.trim(), "<span class='text "+randomId+"'>Scan Comic</span><span class='cancel'>Stop</span>");
			clone.style.position = "relative";
			clone.style.width = parseInt(button.style.width = buttonComputedStyle.width) + "px";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.href = "javascript:";
			clone.classList.add(cssClass);

			t.text = clone.querySelector("span.text."+randomId);

			this.show = function(b) {
				if(document.contains(clone))
					return;

				if(button.parentNode.parentNode.querySelectorAll('.backup-container').length) // do not add scan for comics that already have DRM-free Backup option
					return;

				if(b && b.href == button.href && b !== button) // after switching pages via ajax new button html elements are created, those will be linked to the internal download object
					button = this.readButton = b;

				var parent = function goUp(button) { // recursively search for right parent element of read button
					if(button == null)
						return null;
					if(button.matches(".item-actions"))
						return button;
					return goUp(button.parentElement);
				}(button), backupContainer = parent?parent.querySelector(".backup-container"):null;

				if(!parent)
					return;

				if(!backupContainer) {
					var fragment = document.createDocumentFragment(),
						cont = document.createElement("section");
					fragment.appendChild(document.createElement("hr"));
					cont.setAttribute("class", "backup-container");
					cont.innerHTML = "<h1>"+backupText+"</h1>";
					cont.appendChild(clone);
					fragment.appendChild(cont);
					parent.insertBefore(fragment, parent.querySelector(".archive-actions"));
				}
				else
					backupContainer.appendChild(clone);
			};

			if(settings.selectors)
				clone.addEventListener("click", function() {
					t[t.cancelable?"cancel":"start"]();
				}, false);
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
	Download.queue = new Queue();
	Download.queue.resume = function() {
		var d;
		while((d = this.dequeue())) {
			if(d.canceled)
				continue;
			d.start();
			break;
		}
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
			port.send({ what:"open_background_tab", url:t.readButton.href, active:active }, function(tab) {
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
			t.openTab(false);
			t.setDownloading(true);
			t.showPrepare();
		},

		cancel: function() {
			this.canceled = true;
			this.showDefault();
			if(!this.downloading)
				return;
			port.send({ what:"close_background_tab", tab:this.tab });
			delete downloadEvents[this.tab];
			this.tab = null;
			this.setDownloading(false);
		},

		// event handlers (receiving messages from the downloading tab):

		events: {
			"ready_to_download": function(callback) {
				if(this.inactive)
					callback({ exploit:true });
				else {
					callback({ download:true });
					this.showProgress(0);
				}
			},
			"finished_download": function() {
				port.send({ what:"close_background_tab", tab:this.tab });
				delete downloadEvents[this.tab];
				this.tab = null;
				this.setDownloading(false);
				this.showDone();
			},
			"closed_background_tab": function() {
				if(!this.downloading)
					return;
				delete downloadEvents[this.tab];
				this.tab = null;
				this.setDownloading(false);
				this.showDefault();
			},
			"download_progress": function(callback, percentage) {
				this["show"+(percentage=="zip"?"Zipping":percentage=="save"?"Saving":"Progress")](percentage);
			}
		},

		// UI behaviour:

		showQueued: function() {
			this.text.innerHTML = "Queued...";
			this.downloadButton.style.background = this.buttonBGs.normal;
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(220deg)";
			this.setCancelable(true);
		},
		showPrepare: function() {
			this.text.innerHTML = "Preparing...";
			this.downloadButton.style.background = this.buttonBGs.normal;
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
			this.downloadButton.style.removeProperty("filter");
			this.downloadButton.style.removeProperty("-webkit-filter");
			this.text.innerHTML = "Scan Comic";
			this.setCancelable(false);
		},
		showDone: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(280deg)";
			this.text.innerHTML = "Scan Again";
			this.setCancelable(false);
		},
		showZipping: function() {
			this.downloadButton.style.background = this.buttonBGs.normal;
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(260deg)";
			this.text.innerHTML = "Zipping...";
			this.setCancelable(true);
		},
		showSaving: function() {
			this.downloadButton.style.background = this.buttonBGs.normal;
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

	var port = connector.connect({ name:"controller" });

	port.receive(function(request, callback) {
		if(request.what == "child_message")
			return downloadEvents[request.tab] && typeof downloadEvents[request.tab].events[request.message.what] == "function" &&
			downloadEvents[request.tab].events[request.message.what].call(
				downloadEvents[request.tab],
				callback,
				request.message.data
			);
		else if(request.what == "child_broadcast" && request.message.what == "finished_scan")
			location.reload();
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
			if(mutation.addedNodes && mutation.addedNodes.length)
				reinit = true;
		});
		if(reinit)
			init();
	}).observe(document.getElementById("page_content_container"), {
		childList: true,
		subtree: true
	});
});
