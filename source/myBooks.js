var readButtons = document.body.querySelectorAll(".read-comic.titleBtn"),
	i;

for (i in readButtons)
	function(i){
		var clone = readButtons[i].cloneNode(false);
		clone.innerHTML = "Download";
		clone.style.width = (readButtons[i].clientWidth - 20) + "px";
		clone.style.textAlign = "center";
		clone.href = "javascript:";
		clone.addEventListener("click", function(){
			chrome.tabs.create({'url': readButtons[i].href, 'active': false}, function(tab) {});
		}, false);
		readButtons[i].parentElement.appendChild(clone);	
	}(i)