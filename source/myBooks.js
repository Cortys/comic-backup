var exceptions = {
	"": true,
	"comic-reader": true
}, settings = {
	queueLength: 2
};

if(!exceptions[location.pathname.split("/", 1)[1]]) {
	var cssClass = randomString(20, 40),
		injectCss = function() {
			var style = document.createElement("style");
			style.type = "text/css";
			style.innerHTML = "."+cssClass+" span { transition:all 0s linear 1s; }\n."+cssClass+" .cancel { display:none; }\n."+cssClass+".cancel:hover .cancel { display:block; }\n."+cssClass+".cancel:hover .text { display:none; }";
			document.head.insertBefore(style);
		},
		readButtons = document.body.querySelectorAll(".read-comic.titleBtn, .read_link"),
		downloadEvents = {},
		Download = function(button) {
			this.readButton = button;
			var clone = this.downloadButton = button.cloneNode(false),
				t = this,
				buttonComputedStyle = window.getComputedStyle(button),
				hasGiftButton = false,
				giftButton = button.nextSibling,
				giftComputedStyle;
				
			// create clone:
			clone.innerHTML = "<span class='text'>Download</span><span class='cancel'>Cancel?</span>";
			clone.style.width = (parseInt(button.style.width = buttonComputedStyle.width) + (giftButton && typeof giftButton.className == "string" && (hasGiftButton = giftButton.className.match(/gift_link/g)) && (giftComputedStyle = window.getComputedStyle(giftButton)) && parseInt(giftComputedStyle.width)+parseInt(giftComputedStyle.marginLeft)+parseInt(giftComputedStyle.marginRight) || 0)) + "px";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.style.marginTop = giftComputedStyle?giftComputedStyle.marginLeft:"1px";
			clone.href = "javascript:";
			clone.addEventListener("click", function() {
				t.start();
			}, false);
			clone.classList.add(cssClass);
			
			this.text = clone.firstChild;
			
			// create colors:
			this.buttonBGs = {
				normal: buttonComputedStyle.background,
				progress: "linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.4) {X}%, rgba(0,0,0,0) {X}%, rgba(0,0,0,0) 100%), "+buttonComputedStyle.background
			};
			
			button.parentNode.insertBefore(clone, giftButton);
			if(hasGiftButton)
				button.parentNode.insertBefore(giftButton, clone);
		};
	
	Download.activeDownloads = 0;
	Download.queue = new Queue();
	Download.queue.resume = function() {
		var d = this.dequeue();
		if(d) d.start();
	};
	
	Download.prototype = {
		readButton: null,
		downloadButton: null,
		text: null,
		tab: null,
		downloading: false,
		cancelable: false,
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
		
		start: function() {
			var t = this;
			if(t.downloading)
				return;
			if(Download.activeDownloads >= settings.queueLength) {
				t.showQueued();
				return Download.queue.enqueue(t);
			}
			port.send({what: "open_background_tab", url: t.readButton.href}, function(tab) {
				t.tab = tab;
				downloadEvents[tab] = t;
			});
			t.setDownloading(true);
			t.showPrepare();
		},
		
		// event handlers (receiving messages from the downloading tab):
		
		events: {
			"ready_to_download": function(callback) {
				callback({ download:true });
				this.showProgress(0);
			},
			"finished_download": function() {
				port.send({ what: "close_background_tab", tab: this.tab });
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
			this.text.innerHTML = "Download";
			this.setCancelable(false);
		},
		showDone: function() {
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(230deg)";
			this.text.innerHTML = "Redownload";
			this.setCancelable(false);
		},
		showZipping: function() {
			this.downloadButton.style.background = this.buttonBGs.normal;
			this.downloadButton.style.filter = this.downloadButton.style.webkitFilter = "hue-rotate(200deg)";
			this.text.innerHTML = "Zipping...";
			this.setCancelable(true);
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
	});
	
	for(var i = 0; i < readButtons.length; i++)
		new Download(readButtons[i]);
}