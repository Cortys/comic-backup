//(C) 2013 Sperglord Enterprises
//Code is under GNUGPLv3 - read http://www.gnu.org/licenses/gpl.html

var ports = { // stores all opened connections of tabs to bg page
		reader: {}, // reader tab connections
		controller: {} // controller tab connections
	},
	openers = {}, // contains the opener tab id as value for each child tab id as key
	closedReader = function(port) {
		var sender = port.senderId;
		URL.revokeObjectURL(port.zipUrl);
		if(typeof openers[sender] !== "undefined") {
			var opener = ports.controller[openers[sender]];
			if(opener) {
				opener.send({ what:"child_message", tab:sender, message:{ what:"closed_background_tab" } });
				delete opener.children[sender];
			}
			delete openers[sender];
		}
	};

connector.onConnect.addListener(function(port) {
	var sender = port.senderId = port.sender.tab.id;
	
	ports[port.name][sender] = port;
	
	if(port.name == "controller")
		port.children = {}; // each connection stores the ids of the tabs it opened as children; key = tab id, value always true
	
	if(port.name == "reader") // ZIPPING logic - moved to background script to have a dedicated tab/thread for compression so that it doesn't make the reader tab itself slow
		port.receive(function(request, callback) {
			if(request.what == "new_zip") {
				port.zip = new JSZip();
				port.zip.file(".meta.asc", "This is a ComiXology backup.\nPlease do not distribute it.\nBackup created by "+(request.user||"[UNKNOWN USER]"));
				callback({ what:"new_zip_created" });
			}
			else if(request.what == "add_page") {
				var name = "page"+nullFill(request.i, request.len)+"."+request.extension;
				if(request.toZip && port.zip)
					port.zip.file(name, request.page.substr(request.page.indexOf(",")+1), { base64:true });
				callback({ what:"page_added", name:name });
			}
			else if(request.what == "start_zipping" && port.zip) {
				var result = port.zip.generate({
					type: "blob",
					compression: request.compress?"DEFLATE":"STORE"
				});
				port.zip = null;
				port.zipUrl = URL.createObjectURL(result);
				callback({ what:"completed_zipping", url:port.zipUrl });
			}
			else if(request.what == "download_blob") {
				downloadFile(request.name, port.zipUrl, request.overwrite, function() {
					callback({ what:"download_started" });
				});
				return true;
			}
			else if(request.what == "message_to_opener" && openers[sender] !== "undefined" && ports.controller[openers[sender]]) {
				ports.controller[openers[sender]].send({ what:"child_message", tab:sender, message:request.message }, function(data) {
					callback(data);
				});
				return true;
			}
			else if(request.what == "broadcast_to_openers") {
				for(var tab in ports.controller) {
					ports.controller[tab].send({ what:"child_broadcast", tab:sender, message:request.message }, function(data) {
						callback(data);
					});
				}
				return true;
			}
			else if(request.what == "is_child")
				callback(sender in openers);
			else if(request.what == "unlink_from_opener") // prevents tab to be closed if opener is closed (reader and opener are still connected though and can send messages)
				port.unlinked = true;
		});
	else if(port.name == "controller") // TAB handling logic for the controller tabs (like "My Books")
		port.receive(function(request, callback) {
			if(request.what == "open_background_tab") {
				chrome.tabs.create({ url:request.url, active:request.active }, function(tab) {
					openers[tab.id] = sender;
					port.children[tab.id] = true;
					callback(tab.id);
				});
				return true;
			}
			else if(request.what == "close_background_tab")
				chrome.tabs.remove(request.tab);
			else if(request.what == "message_to_child" && ports.reader[request.tab]) {
				ports.reader[request.tab].send({ what:"opener_message", message:request.message }, callback);
				return true;
			}
		});
	
	var disconnectAction = port.name == "controller"?function() {
		for (var tab in port.children)
			if(ports.reader[tab] && !ports.reader[tab].unlinked)
				chrome.tabs.remove(tab*1);
	}:closedReader;
	
	port.onDisconnect.addListener(function() {
		delete ports[port.name][sender];
		disconnectAction(port);
		port = sender = null;
	});
});

chrome.tabs.onRemoved.addListener(closedReader);