"use strict";

var selects = document.querySelectorAll("select, input");

for(var i = 0; i < selects.length; i++)
	(function(e) {
		if(typeof e.addEventListener === "undefined")
			return;
		var f = function() {
			e.addEventListener("change", function() {
				var o = {},
					message = e.getAttribute("data-message");
				toastr.remove();

				if(e.id === "updateServer")
					o[e.id] = e.value.charAt(e.value.length - 1) === "/" ? e.value.substr(0, e.value.length - 1) : e.value;
				else if(e.id === "directory") {
					var ev = e.value;
					if(ev.match(/^\.|^([A-Za-z]:)|^(\\|\/)/g) != null) {
						toastr.error("Invalid download directory.");
						return;
					}
					ev = ev.replace(/\\/g, "/");
					o[e.id] = ev.length > 1 && ev.charAt(ev.length - 1) !== "/" ? ev + "/" : ev;
					e.value = o[e.id];
				}
				else {
					o[e.id] = +e.value;
					if(!Number.isFinite(o[e.id])) {
						toastr.error("Invalid number.");
						return;
					}
					if((e.id === "pageSwapDelay" || e.id === "pageSkipDelay") && o[e.id] < 0)
						o[e.id] = 0;
					e.value = o[e.id];
				}

				/*This function will create a toast message every time the user does an action in the field options. */
				toastr.success("Changes saved.");

				if(message)
					chrome.runtime.sendMessage({
						what: "controller_message",
						message: {
							what: message,
							data: o[e.id]
						}
					});

				chrome.storage.local.set(o, function() {
					chrome.runtime.sendMessage({
						what: "update_settings"
					});
				});
			}, false);
			chrome.storage.local.get([e.id], function(a) {
				if(e.id in a) {
					if(e.tagName.match(/select/i))
						e.querySelector("option[value='" + a[e.id] + "']").selected = "selected";
					else
						e.value = a[e.id];
				}
			});
		};

		if(e.id === "selectors")
			chrome.storage.local.get(["scannedOnce", "selectors"], function(a) {
				if(!a.scannedOnce) {
					var p = document.createElement("p");
					p.innerHTML = "<i>Currently using the exploit preset. This can become outdated if the reader is updated.</i>";
					document.body.appendChild(p);
				}

				if(a.selectors == null)
					e.value = 1;

				f();
			});
		else if(e.id === "updateServer")
			chrome.storage.local.get(["updateServer"], function(a) {
				if(a.updateServer == null)
					e.value = "https://raw.githubusercontent.com/Cortys/comic-backup/master";

				f();
			});
		else
			f();
	}(selects[i]));

document.getElementById("content").style.visibility = "visible";
