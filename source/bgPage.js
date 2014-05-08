//(C) 2013 Sperglord Enterprises
//Code is under GNUGPLv3 - read http://www.gnu.org/licenses/gpl.html

var zips = {},

handleStop = function(tabId) {
	if(typeof zips[tabId] !== "undefined")
		delete zips[tabId];
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if(request.what == "empty_cache") {
		handleStop(sender.tab.id);
		sendResponse({ what:"cache_emptied" });
	}
	else if(request.what == "new_zip") {
		zips[sender.tab.id] = new JSZip();
		zips[sender.tab.id].file(".meta.asc", "This is a ComiXology backup.\nPlease do not distribute it.\nBackup created by "+(request.user||"[UNKNOWN USER]"));
		sendResponse({ what:"new_zip_created" });
	}
	else if(request.what == "add_page") {
		var name = "page"+nullfill(request.i, request.len)+"."+request.extension;
		if(request.toZip)
			zips[sender.tab.id].file(name, request.page.substr(request.page.indexOf(",")+1), { base64:true });
		sendResponse({ what:"page_added", name:name });
	}
	else if(request.what == "start_zipping") {
		var result = zips[sender.tab.id].generate({
			type: "blob",
			compression: request.compress?"DEFLATE":"STORE"
		});
		handleStop(sender.tab.id);
		sendResponse({ what:"completed_zipping", url:URL.createObjectURL(result) });
	}
	else if(request.what == "open_background_tab") {
		chrome.tabs.create({"url": request.url, "active": false}, function(tab) {
			chrome.tabs.onUpdated.addListener(function(id, info){
				if(tab.id == id && info.status == "complete")
					sendResponse(tab);
			});
		});
		return true;
	}
	else if(request.what == "close_background_tab") {
		chrome.tabs.remove(request.tab.id);
		sendResponse({ what:"closed_background_tab" });
	}
	else
		sendResponse("ERROR");
});

chrome.tabs.onRemoved.addListener(handleStop);

function nullfill(num, len) {
	num = String(num);
	for(var i = num.length; i < len; i++)
		num = "0"+num;
	return num;
}