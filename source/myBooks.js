var exceptions = {
	"": true,
	"comic-reader": true
};


if(!exceptions[location.pathname.split("/", 1)[1]]) {
	var cssClass = randomString(20, 40),
		injectCss = function() {
			var style = document.createElement("style");
			style.type = "text/css";
			style.innerHTML = "." + cssClass + "{}";
			document.documentElement.insertBefore(style);
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
			clone.innerHTML = "Download";
			clone.style.width = (parseInt(button.style.width = buttonComputedStyle.width) + (giftButton && typeof giftButton.className == "string" && (hasGiftButton = giftButton.className.match(/gift_link/g)) && (giftComputedStyle = window.getComputedStyle(giftButton)) && parseInt(giftComputedStyle.width)+parseInt(giftComputedStyle.marginLeft)+parseInt(giftComputedStyle.marginRight) || 0)) + "px";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.style.marginTop = giftComputedStyle?giftComputedStyle.marginLeft:"1px";
			clone.href = "javascript:";
			clone.addEventListener("click", function() {
				t.events["start_download"].call(t);
			}, false);
			clone.classList.add(cssClass);
			
			// create colors:
			console.log(buttonComputedStyle.background);
			this.buttonBGs = {
				green: buttonComputedStyle.background.replace(/#([a-f0-9]{6,6})|#([a-f0-9]{3,3})/gi, function(match, hex) {
					console.log(hex);
					return match;
				})
			};
			
			button.parentNode.insertBefore(clone, giftButton);
			if(hasGiftButton)
				button.parentNode.insertBefore(giftButton, clone);
		};

	Download.prototype = {
		readButton: null,
		downloadButton: null,
		tab: null,
		downloading: false,
		buttonBGs: null,
		events: {
			"ready_to_download": function(sendResponse) {
				sendResponse({ download:true });
				this.showProgress(0);
			},
			"finished_download": function() {
				chrome.runtime.sendMessage({ what: "close_background_tab", tab: this.tab });
				delete downloadEvents[this.tab.id];
				this.tab = null;
				this.downloading = false;
				this.showDone();
			},
			"closed_background_tab": function() {
				if(!this.downloading)
					return;
				delete downloadEvents[this.tab.id];
				this.tab = null;
				this.downloading = false;
				this.showDefault();
			},
			"start_download": function() {
				var t = this;
				if(t.downloading)
					return;
				chrome.runtime.sendMessage({what: "open_background_tab", url: t.readButton.href}, function(tab) {
					t.tab = tab;
					downloadEvents[tab.id] = t;
				});
				t.downloading = true;
				t.showPrepare();
			},
			"download_progress": function(sendResponse, percentage) {
				this["show"+(percentage=="zip"?"Zipping":"Progress")](percentage);
			}
		},
		showPrepare: function() {
			this.downloadButton.style.cursor = "default";
			this.downloadButton.innerHTML = "...";
		},
		showProgress: function(percentage) {
			this.downloadButton.style.cursor = "default";
			this.downloadButton.innerHTML = percentage + "%";
		},
		showDefault: function() {
			this.downloadButton.style.cursor = "pointer";
			this.downloadButton.style.removeProperty("background");
			this.downloadButton.innerHTML = "Download";
		},
		showDone: function() {
			this.downloadButton.style.cursor = "default";
			this.downloadButton.style.background = this.buttonBGs.green;
			this.downloadButton.innerHTML = "Done";
		},
		showZipping: function() {
			this.downloadButton.style.cursor = "default";
			this.downloadButton.innerHTML = "Zipping...";
		}
	};
	
	for(var i = 0; i < readButtons.length; i++)
		new Download(readButtons[i]);
	
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		return downloadEvents[request.tab.id] && typeof downloadEvents[request.tab.id].events[request.what] == "function" &&
			downloadEvents[request.tab.id].events[request.what].call(
				downloadEvents[request.tab.id],
				sendResponse,
				request.data
			);
	});
}