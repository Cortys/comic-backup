var selects = document.querySelectorAll("select, input");

for(var i = 0; i < selects.length; i++)
	(function(e) {
		if(typeof e.addEventListener === "undefined")
			return;
		var f = function() {
			e.addEventListener("change", function() {
				var o = {},
					message = e.getAttribute("data-message");

				if(e.id === "updateServer")
					o[e.id] = e.value.charAt(e.value.length-1) == "/" ? e.value.substr(0, e.value.length-1) : e.value;
				else {
					o[e.id] = e.value*1;
					if(!Number.isFinite(o[e.id]))
						return;
					if(e.id === "pageSwapDelay" && o[e.id] < 0)
						o[e.id] = 0;
				}

				if(message)
					chrome.runtime.sendMessage({ what:"controller_message", message:{ what:message, data:o[e.id] } });

				chrome.storage.local.set(o, function() {
					chrome.runtime.sendMessage({ what:"update_settings" });
				});
			}, false);
			chrome.storage.local.get([e.id], function(a) {
				if(e.id in a) {
					if(e.tagName.match(/select/i))
						e.querySelector("option[value='"+a[e.id]+"']").selected = "selected";
					else
						e.value = a[e.id];
				}
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
			});
		else
			f();
	}(selects[i]));

document.getElementById("content").style.visibility = "visible";
