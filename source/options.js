var selects = document.getElementsByTagName("select");

function check() {
	if(i >= selects.length)
		document.getElementById("content").style.visibility = "visible";
}

for(var i = 0; i < selects.length; i++)
	(function(e) {
		if(typeof e.addEventListener === "undefined")
			return;
		var f = function() {
			e.addEventListener("change", function() {
				var o = {};
				o[e.id] = e.value*1;
				chrome.storage.local.set(o, 	function() {
					chrome.runtime.sendMessage("update_settings");
				});
			}, false);
			chrome.storage.local.get([e.id], function(a) {
				if(a[e.id])
					e.querySelector("option[value='"+a[e.id]+"']").selected = "selected";
				check();
			});
		};

		if(e.id == "selectors")
			chrome.storage.local.get(["scannedOnce"], function(a) {
				if(!a.scannedOnce) {
					e.setAttribute("disabled", "1");
					var p = document.createElement("p");
					p.innerHTML="You have to do at least one scan before this can be disabled.";
					document.body.appendChild(p);
				}
				else
					f();
				check();
			});
		else
			f();
	}(selects[i]));

document.getElementById("setServer").addEventListener("click", function() {
	chrome.storage.local.get(["updateServer"], function(a) {
		var r = window.prompt("Enter update server URL:", a.updateServer||"");
		if(r || r === "")
			chrome.storage.local.set({ updateServer:(r.charAt(r.length-1) == "/"?r.substr(0, r.length-1):r) });
	});
}, false);
