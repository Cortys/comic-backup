var exceptions = {
	"": true,
	"comic-reader": true
};


if(!exceptions[location.pathname.split("/", 1)[1]]){
	var readButtons = document.body.querySelectorAll(".read-comic.titleBtn, .read_link"),
		i,
		downloadEvents = {},
		Download = function(button){
			this.readButton = button;
			var clone = this.downloadButton = button.cloneNode(false),
				t = this,
				hasGiftButton = false,
				giftButton = button.nextSibling;
			clone.innerHTML = "Download";
			clone.style.width = (parseInt(button.style.width = window.getComputedStyle(button).width) + (giftButton && typeof giftButton.className == "string" && (hasGiftButton =  giftButton.className.match(/gift_link/g)) && parseInt(window.getComputedStyle(giftButton).width) || 0)) + "px";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.style.marginTop = "1px";
			clone.href = "javascript:";
			clone.addEventListener("click", function(){
				t.events["start_download"].call(t);
			}, false);
			button.parentNode.insertBefore(clone, giftButton);
			if(hasGiftButton)
				button.parentNode.insertBefore(giftButton, clone);
		};

	Download.prototype = {
		readButton: null,
		downloadButton: null,
		tab: null,
		events: {
			"ready_to_download": function(sendResponse){
				sendResponse({download: true});
			}, "finished_download": function(){
				chrome.runtime.sendMessage({ what: "close_background_tab", tab: this.tab });
			}, "closed_background_tab": function(){
				delete downloadEvents[this.tab.id];
				this.tab = null;
			}, "start_download": function(){
				var t = this;
				chrome.runtime.sendMessage({what: "open_background_tab", url: this.readButton.href}, function(tab) {
					t.tab = tab;
					downloadEvents[tab.id] = t;
				});
			}, "download_progress": function(perc){
				
			}
		}
	};

	for(i = 0; i < readButtons.length; i++)
		(function(e){
			new Download(e);
		})(readButtons[i]);


	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		return downloadEvents[request.tab.id] && typeof downloadEvents[request.tab.id].events[request.what] == "function" && downloadEvents[request.tab.id].events[request.what].call(downloadEvents[request.tab.id], sendResponse, request.data);
	});
}