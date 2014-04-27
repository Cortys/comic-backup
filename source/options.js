var selects = document.getElementsByTagName("select");
for(var i in selects)
	(function(e) {
		if(typeof e.addEventListener === "undefined")
			return;
		var f = function() {
			e.addEventListener("change", function() {
				var o = {};
				o[e.id] = e.value*1;
				chrome.storage.local.set(o);
			}, false);
			chrome.storage.local.get([e.id], function(a) {
				if(a[e.id])
					e.getElementsByTagName("option")[a[e.id]*1].selected = "selected";
			});
		};
		if(e.id == "selectors")
			chrome.storage.local.get(["scannedOnce"], function(a) {
				if(!a["scannedOnce"]) {
					e.setAttribute("disabled", "1");
					var p = document.createElement("p");
					p.innerHTML="You have to do at least one scan before this can be disabled.";
					document.body.appendChild(p);
				}
				else
					f();
			});
		else
			f();
	})(selects[i]);
	
document.getElementById("setServer").addEventListener("click", function() {
	chrome.storage.local.get(["updateServer"], function(a) {
		var r = window.prompt("Enter update server URL:", a.updateServer||"");
		if(r || r === "")
			chrome.storage.local.set({ updateServer:r });
	});
}, false);