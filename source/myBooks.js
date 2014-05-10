var readButtons = document.body.querySelectorAll(".read-comic.titleBtn"),
	i,
	tabDownloaders = {};

for(i = 0; i < readButtons.length; i++)
	(function(e){
		var clone = e.cloneNode(false);
		clone.innerHTML = "Download";
		clone.style.width = e.style.width = (e.clientWidth - 20) + "px";
		clone.style.textAlign = e.style.textAlign = "center";
		clone.href = "javascript:";
		clone.addEventListener("click", function(){
			chrome.runtime.sendMessage({"what": "open_background_tab", "url": e.href}, function(tab) {
				tabDownloaders[tab.id] = function(sendResponse) {
					sendResponse({ download:true });
				};
			});
		}, false);
		e.parentNode.insertBefore(clone, e.nextSibling);
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