var readButtons = document.body.querySelectorAll(".read-comic.titleBtn"),
	i;

for (i in readButtons)
	(function(i){
		var clone = readButtons[i].cloneNode(false);
		clone.innerHTML = "Download";
		clone.style.width = readButtons[i].style.width = (readButtons[i].clientWidth - 20) + "px";
		clone.style.textAlign = readButtons[i].style.textAlign = "center";
		clone.href = "javascript:";
		clone.addEventListener("click", function(){
			chrome.runtime.sendMessage({"what": "open_background_tab", "url": readButtons[i].href}, function(tab){
				chrome.runtime.sendMessage({"what": "start_download"}, function(what){
					chrome.runtime.sendMessage({"what": "close_background_tab", "tab": tab});
				});
			});
		}, false);
		readButtons[i].parentNode.insertBefore(clone, readButtons[i].nextSibling);	
	})(i)