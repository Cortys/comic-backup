var exceptions = {
	"": true,
	"/": true,
	"/comic-reader/": true
};


if(!exceptions[location.pathname.split("/"[1], 1)]){
	var readButtons = document.body.querySelectorAll(".read-comic.titleBtn, .read_link"),
		i,
		tabDownloaders = {},
		addButton = function(button){
			var clone = button.cloneNode(false),
				hasGiftButton = false,
				giftButton = button.nextSibling;
			clone.innerHTML = "Download";
			clone.style.width = (parseInt(button.style.width = window.getComputedStyle(button).width) + (giftButton && typeof giftButton.className == "string" && (hasGiftButton =  giftButton.className.match(/gift_link/g)) && parseInt(window.getComputedStyle(giftButton).width) || 0)) + "px";
			clone.style.textAlign = button.style.textAlign = "center";
			clone.href = "javascript:";
			clone.addEventListener("click", function(){
				chrome.runtime.sendMessage({"what": "open_background_tab", "url": button.href}, function(tab) {
					tabDownloaders[tab.id] = function(sendResponse) {
						sendResponse({download: true});
					};
				});
			}, false);
			button.parentNode.insertBefore(clone, giftButton);
			if(hasGiftButton)
				button.parentNode.insertBefore(giftButton, clone);
			return clone;
		};


	for(i = 0; i < readButtons.length; i++)
		(function(e){
			addButton(e);
		})(readButtons[i]);


	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if(request.what == "ready_to_download" && tabDownloaders[request.tab.id]) {
			tabDownloaders[request.tab.id](sendResponse);
			delete tabDownloaders[request.tab.id];
			return true;
		}
		else if(request.what == "finished_download")
			chrome.runtime.sendMessage({ what:"close_background_tab", tab:request.tab });
	});
}