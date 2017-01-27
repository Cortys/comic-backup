//Code is under GNUGPLv3 - read http://www.gnu.org/licenses/gpl.html
"use strict";

zip.useWebWorkers = true;

zip.workerScripts = {
  deflater: ['zip/z-worker.js', 'zip/deflate.js'],
};

var ports = { // stores all opened connections of tabs to bg page: key = tab id, value = port object
		reader: {}, // reader tab connections
		controller: {} // controller tab connections
	},
	openers = {}, // contains the opener tab id as value for each child tab id as key
	closedReader = function(port) {
		var sender = port.senderId;
		if(!port.fake) { // used when a reader is closed, that was not yet initialized and connected via its own port.
			if(!port.zipFile)
				URL.revokeObjectURL(port.zipUrl);
			else
				port.zipFile.remove(function() {
					port.zipFile = null;
				});
		}
		if(typeof openers[sender] !== "undefined") {
			var opener = ports.controller[openers[sender]];
			if(opener) {
				opener.send({
					what: "child_message",
					tab: sender,
					message: {
						what: "closed_background_tab"
					}
				});
				delete opener.children[sender];
			}
			delete openers[sender];
		}
	},
	requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem,
	fs = null,
	getWriter = function(callback) {
		var tmpName, run;
		if(!settings.tempMemory || !requestFileSystem) {
			callback(new zip.BlobWriter("application/" + (settings.container ? "zip" : "x-cbz")));
			fs = null;
		}
		else {
			run = function() {
				tmpName = "tmp" + (Date.now()) + ".zip";

				function create() {
					fs.root.getFile(tmpName, {
						create: true
					}, function(zipFile) {
						callback(new zip.FileWriter(zipFile), zipFile);
					});
				}
				fs.root.getFile(tmpName, null, function() {
					run();
				}, create);
			};

			if(!fs)
				requestFileSystem(TEMPORARY, 4 * 1024 * 1024 * 1024, function(f) {
					fs = f;
					run();
				});
			else
				run();
		}
	};

getSettings(function() {

	connector.onConnect.addListener(function(port) {

		if(port.name == "download") {
			port.receive(function(request, callback) {
				downloadFile(request.name, request.data, request.overwrite, callback);
			});
			return true;
		}

		var sender = port.senderId = port.sender.tab.id;

		ports[port.name][sender] = port;

		if(port.name == "controller")
			port.children = {}; // each connection stores the ids of the tabs it opened as children; key = tab id, value always true

		/* ZIPPING logic
		 * moved to background script to have a dedicated tab/thread for compression so
		 * that it doesn't make the reader tab itself slow
		 */
		if(port.name == "reader")
			port.receive(function(request, callback) {
				if(request.what == "new_zip") {
					getWriter(function(writer, zipFile) {
						port.zipFile = zipFile;
						zip.createWriter(writer, function(writer) {
							port.zip = writer;
							port.user = request.user;
							writer.add(".meta.asc", new zip.TextReader("This is a ComiXology backup.\nPlease do not distribute it.\nBackup created by " + (request.user || "[UNKNOWN USER]")));
							callback({
								what: "new_zip_created",
								error: false
							});
						}, function() {
							callback({
								what: "zip_creation_failed",
								error: true
							});
						}, !settings.compression);
					});
					return true;
				}
				else if(request.what == "add_page") {
					var name = "page" + nullFill(request.i, request.len) + "." + request.extension,
						d = callback.bind(null, {
							what: "page_added",
							name: name
						});
					if(request.toZip && port.zip) {
						port.zip.add(name, new zip.Data64URIReader(request.page), function() {
							d();
						}, undefined, {
							comment: port.user
						});
						return true;
					}
					d();
				}
				else if(request.what == "start_zipping" && port.zip) {
					port.zip.close(function(result) {
						port.zip = null;
						port.zipUrl = port.zipFile ? port.zipFile.toURL() : URL.createObjectURL(result);
						callback({
							what: "completed_zipping"
						});
					}, request.comment);
					return true;
				}
				else if(request.what == "download_blob") {
					downloadFile(request.name, port.zipUrl, false, function() {
						if(!port.zipFile)
							URL.revokeObjectURL(port.zipUrl);
						else
							port.zipFile.remove(function() {
								port.zipFile = null;
							});
						callback({
							what: "download_complete"
						});
					});
					return true;
				}
				else if(request.what == "message_to_opener" && openers[sender] !== "undefined" && ports.controller[openers[sender]]) {
					ports.controller[openers[sender]].send({
						what: "child_message",
						tab: sender,
						message: request.message
					}, callback);
					return true;
				}
				else if(request.what == "broadcast_to_openers") {
					for(var tab in ports.controller) {
						ports.controller[tab].send({
							what: "child_broadcast",
							tab: sender,
							message: request.message
						}, callback);
					}
					return true;
				}
				else if(request.what == "is_child")
					callback(sender in openers);
				else if(request.what == "unlink_from_opener") // prevents tab to be closed if opener is closed (reader and opener are still connected though and can send messages)
					port.unlinked = true;
			});
		/*
		 * TAB HANDLING logic
		 * for the controller tabs (like "My Books")
		 */
		else if(port.name == "controller")
			port.receive(function(request, callback) {
				if(request.what == "open_background_tab") {
					chrome.tabs.create({
						url: request.url,
						active: request.active
					}, function(tab) {
						openers[tab.id] = sender;
						port.children[tab.id] = true;
						ports.reader[tab.id] = true; // fake a reader port, as long as reader wasn't loaded, boolean to make it easy to check for "real" port objects
						callback(tab.id);
					});
					return true;
				}
				else if(request.what == "close_background_tab")
					chrome.tabs.remove(request.tab, function() {
						return chrome.runtime.lastError;
					});
				else if(request.what == "message_to_child" && typeof ports.reader[request.tab] === "object") {
					ports.reader[request.tab].send({
						what: "opener_message",
						message: request.message
					}, callback);
					return true;
				}
			});

		var disconnectAction = port.name == "controller" ? function() {
			for(var tab in port.children)
			// only not YET estabished or established linked port connections are allowed:
			// children that once had a port are not closed (if the user started surfing in a backup tab)
				if(typeof ports.reader[tab] === "object" && !ports.reader[tab].unlinked)
				chrome.tabs.remove(tab * 1, function() {
					return chrome.runtime.lastError;
				});
		} : closedReader;

		port.onDisconnect.addListener(function() {
			delete ports[port.name][sender];
			disconnectAction(port);
			port = sender = null;
		});
	});

});

chrome.tabs.onRemoved.addListener(function(tab) {
	if(ports.reader[tab] === true && tab in openers) // tab is a backup-purpose reader but there is no port connection yet:
		closedReader({
		senderId: tab,
		fake: true
	}); // port disconnect wont fire, so it will be "faked".
});

// Old communication channel to options page. Separated from the port system to reduce memory and logic overhead.
chrome.runtime.onMessage.addListener(function(request) {
	// Only used when settings are changed (e.g. notify background zipper when compression settings were changed at runtime):
	if(request.what == "update_settings")
		getSettings();
	// Broadcast messages to all readers:
	else if(request.what == "reader_message")
		ports.reader.forEach(function(v) {
			v.send(request.message);
		});
	// Broadcast messages to all controllers:
	else if(request.what == "controller_message")
		for(var i in ports.controller)
			ports.controller[i].send(request.message);
});
