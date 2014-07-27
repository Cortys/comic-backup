getSettings(function() {
	
	updateDialog();
	
	var cssClass = randomString(20, 40),
		injectCss = function() {
			var style = document.createElement("style");
			style.type = "text/css";
			style.innerHTML = "."+cssClass+" span { position:absolute; width:auto; top:50%; margin-top:-0.5em; line-height:1em; left:0; right:0; transition:opacity 0.1s linear 0s; opacity:1; }\n."+cssClass+".cancel:hover span { transition-delay:0.3s; }\n."+cssClass+" .cancel { opacity:0; }\n."+cssClass+".cancel:hover .cancel { opacity:1; }\n."+cssClass+".cancel:hover .text { opacity:0; }";
			document.head.insertBefore(style);
		},
		readButtons = document.body.querySelectorAll(".read-comic.titleBtn, .read_link"),
		downloadEvents = {},
		Download = function(button) {
			this.readButton = button;
			var clone = this.downloadButton = button.cloneNode(false),
				t = this,
				buttonComputedStyle = window.getComputedStyle(button);
			
			// create colors:
			t.buttonBGs = {
				normal: buttonComputedStyle.background,
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
	
			button.parentNode.insertBefore(clone);
			
			if(settings.selectors)
				clone.addEventListener("click", function() {
					if(!t.cancelable)
						t.start();
					else
						t.cancel();
				}, false);
			else {
				t.inactive = true;
				clone.addEventListener("click", function() {
					t.openTab(true);
				}, false);
				t.showInactive();
			}
		};
	
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
			this.text.innerHTML = "Activate Scan";
			this.setCancelable(false);
		}
	};
	
	injectCss();
	
	var port = connector.connect({ name:"controller" });
	
	port.receive(function(request, callback) {
		console.log(request);
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
	
	for(var i = 0; i < readButtons.length; i++)
		new Download(readButtons[i]);
	
});