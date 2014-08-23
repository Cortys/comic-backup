getSettings(function() {
	
	if(!settings.queueLength)
		settings.queueLength = 1;
	
	updateDialog();
	
	var cssClass = randomString(20, 40),
		readButtonSelector = ".read-comic.titleBtn:not(."+cssClass+")",
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
			clone.innerHTML = "<span class='text'>Scan Comic</span><span class='cancel'>Stop</span>";
			clone.style.position = "relative";
			clone.style.width = parseInt(button.style.width = buttonComputedStyle.width) + "px";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.href = "javascript:";
			clone.classList.add(cssClass);
	
			t.text = clone.firstChild;
			
			this.show = function(b) {
				console.log(this, document.contains(clone));
				if(document.contains(clone))
					return;
				
				if(b && b.href == button.href && b !== button)
					button = this.readButton = b;
				
				button.parentNode.appendChild(clone);
				
				if(clone.previousElementSibling == button) {
					var fragment = document.createDocumentFragment(),
						cont = document.createElement("section");
					fragment.appendChild(document.createElement("hr"));
					cont.setAttribute("class", "backup-container");
					cont.innerHTML = "<h1>"+backupText+"</h1>";
					fragment.appendChild(cont);
					clone.parentNode.insertBefore(fragment, clone);
				}
			};
			
			if(settings.selectors)
				clone.addEventListener("click", function() {
					t[t.cancelable?"cancel":"start"]();
				}, false);
			else if(!this.id) {
				t.inactive = true;
				clone.addEventListener("click", function() {
					t.openTab(true);
				}, false);
				t.showInactive();
			}
			else {
				clone.href = "#";
				t.showUnusable();
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
		while(d = this.dequeue()) {
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
				this["show"+(percentage=="zip"?"Zipping":"Progress")](percentage);
			}
		},
	
		// UI behaviour:
	
		showQueued: function() {
			this.text.innerHTML = "Queued...";
			this.downloadButton.style.background = this.buttonBGs.normal;
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(160deg)";
			this.setCancelable(true);
		},
		showPrepare: function() {
			this.text.innerHTML = "Preparing...";
			this.downloadButton.style.background = this.buttonBGs.normal;
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(190deg)";
			this.setCancelable(true);
		},
		showProgress: function(percentage) {
			this.downloadButton.style.background = this.buttonBGs.progress.replace(/\{X\}/g, percentage);
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(190deg)";
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
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(230deg)";
			this.text.innerHTML = "Scan Again";
			this.setCancelable(false);
		},
		showZipping: function() {
			this.downloadButton.style.background = this.buttonBGs.normal;
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(200deg)";
			this.text.innerHTML = "Zipping...";
			this.setCancelable(true);
		},
		showInactive: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(135deg)";
			this.text.innerHTML = "Setup Scanner";
			this.setCancelable(false);
		},
		showUnusable: function() {
			this.downloadButton.style.background = this.buttonBGs.gray;
			this.downloadButton.style.border = "1px solid #555555";
			this.downloadButton.style.cursor = "default";
			this.downloadButton.style.removeProperty("filter");
			this.downloadButton.style.removeProperty("-webkit-filter");
			this.text.innerHTML = "Setup Required";
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
		else if(request.what = "child_broadcast" && request.message.what == "finished_scan")
			location.reload();
	});
	
	function init() {
		var readButtons = document.body.querySelectorAll(readButtonSelector);
		console.log(readButtons);
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