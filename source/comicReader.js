//(C) 2013 Sperglord Enterprises
//Code is under GNUGPLv3 - read http://www.gnu.org/licenses/gpl.html
var current_version = 108,
	div = document.createElement("div"),
	overlay = document.createElement("div"),
	settings = {},
	linkStyle = "color:#ffffff;font-weight:bold;background-color:#345190;padding:3px;text-decoration:none;display:inline-block;width:60px;text-align:center;height:20px;box-sizing:border-box;line-height:14px;";

div.id = randomString(5,10);

div.style.fontSize = "13px";
div.style.top = "0px";
div.style.width = "100%";
div.style.height = "50px";

div.style.background = "#ff9900";
div.style.color = "#000000";
div.style.textAlign = "center";
div.style.lineHeight = "25px";
div.style.zIndex = 300;
div.style.cursor = "default";

div.style.position = "absolute";

overlay.style.position = "fixed";
overlay.style.zIndex = 299;
overlay.style.top = overlay.style.left = overlay.style.bottom = overlay.style.right = 0;
overlay.style.width = overlay.style.height = "auto";
overlay.style.background = "rgba(0,0,0,0.3)";
overlay.style.display = "none";

chrome.storage.local.get(null, function(data) {
	settings = data;
	chrome.runtime.sendMessage({ what:"empty_cache" }, readGithubVersion);
});

function readGithubVersion() {
	var xhr = new XMLHttpRequest();
	if(settings.updateServer) {
		xhr.open("GET", settings.updateServer+"/version", true);
		xhr.responseType = 'text';
	
		xhr.onreadystatechange = function() {
	
			if (xhr.readyState == 4 && xhr.status == 200) {
				var githubVersion = this.response*1;
				if (githubVersion > current_version)
					displayMainBar(1);
				else
					displayMainBar(0);
			}
		};
		xhr.send();
	}
	else
		displayMainBar(0);
}

function getPathFor(e, tryE) { // returns css selector that matches e and tryE as well (if that is possible, without two comma seperated selectors) - only tags, ids and classes are used
	if(!e)
		return "";
	if(e.id)
		return "#"+e.id;
	var before = getPathFor(e.parentElement)+" > "+e.tagName,
		classes = "", classesBefore,
		p = 0,
		selection = document.querySelectorAll(before), selectionBefore,
		couldMatch = function() { // returns true if the current state of path could also match tryE (directly or if it was specified further)
			if(!tryE)
				return true;
			var c = tryE;
			while(c) {
				if(c.matches(before+classes))
					return true;
				c = tryE.parentElement;
			}
			return false;
		};
	if(e.classList.length) do {
		classesBefore = classes;
		classes += "."+e.classList[p++];
		selectionBefore = selection.length;
		selection = document.querySelectorAll(before+classes);
		if(selection.length >= selectionBefore || !couldMatch())
			classes = classesBefore;
	} while(p < e.classList.length && selection.length > 1);
	return before+classes;
}

function wordDiff(text1, text2) { // word wise difference of two strings (using diff_match_patch library)
	
	text1 = text1.trim()+" ";
	text2 = text2.trim()+" ";
	
	var lineArray = [];  // e.g. lineArray[4] == 'Hello\n'
	var lineHash = {};   // e.g. lineHash['Hello\n'] == 4
	
	// '\x00' is a valid character, but various debuggers don't like it.
	// So we'll insert a junk entry to avoid generating a null character.
	lineArray[0] = '';
	
	/**
	* Split a text into an array of strings.  Reduce the texts to a string of
	* hashes where each Unicode character represents one line.
	* Modifies linearray and linehash through being a closure.
	* @param {string} text String to encode.
	* @return {string} Encoded string.
	* @private
	*/
	function diff_linesToCharsMunge_(text) {
		var chars = '';
		// Walk the text, pulling out a substring for each line.
		// text.split('\n') would would temporarily double our memory footprint.
		// Modifying text would create many large strings to garbage collect.
		var lineStart = 0;
		var lineEnd = -1;
		// Keeping our own length variable is faster than looking it up.
		var lineArrayLength = lineArray.length;
		while (lineEnd < text.length - 1) {
			lineEnd = text.indexOf(' ', lineStart);
			if (lineEnd == -1) {
				lineEnd = text.length - 1;
			}
			var line = text.substring(lineStart, lineEnd + 1);
			lineStart = lineEnd + 1;
			
			if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
				(lineHash[line] !== undefined)) {
				chars += String.fromCharCode(lineHash[line]);
			} else {
				chars += String.fromCharCode(lineArrayLength);
				lineHash[line] = lineArrayLength;
				lineArray[lineArrayLength++] = line;
			}
		}
		return chars;
	}
	
	var chars1 = diff_linesToCharsMunge_(text1);
	var chars2 = diff_linesToCharsMunge_(text2),
	
		dmp = new diff_match_patch(),
		result = dmp.diff_main(chars1, chars2, false);
		
	dmp.diff_charsToLines_(result, lineArray);
	return result;
}

function realClick(e) {
	var evt = document.createEvent("MouseEvents"),
		rect = e.getBoundingClientRect(),
		doc = e.ownerDocument,
		win = (doc && (doc.defaultView || doc.parentWindow)) || window,
		left = rect.left || 1,
		top = rect.top || 1;
	evt.initMouseEvent("click", true, true, win, 1, left, top, left, top, false, false, false, false, 0, null);
	e.dispatchEvent(evt);
}

function displayMainBar(isUpdateNeeded) {
	if (isUpdateNeeded == 1) div.innerHTML = "The extension is outdated, download new version<br><a href=\""+settings.updateServer+"/download.zip\" style='"+linkStyle+"' target='_blank'>here</a>";
	else {
		div.innerHTML = "This looks like a Comixology comic. Do you want to backup it as "+(settings.compression==2?"pictures":(settings.container?"ZIP":"CBZ"))+" ("+(settings.compression?(settings.compression==1?"deflated":"multiple"):"stored")+" "+(settings.page?"PNGs":"JPEGs")+")?<br><a href=\"javascript:document.documentElement.removeChild(document.getElementById('"+div.id+"'))\" style='"+linkStyle+"'>No</a> ";
		var a = document.createElement("a");
		a.innerHTML = "Yes";
		a.href = "#";
		a.addEventListener('click', function(e) {
			e.stopPropagation();
			if(settings.selectors)
				loadComic();
			else
				setupSelectors();
		}, false);
		a.setAttribute("style", linkStyle);
		div.appendChild(a);
	}

	div.style.lineHeight = "25px";
	if(!div.parentNode) {
		document.documentElement.appendChild(div);
		document.documentElement.appendChild(overlay);
	}
}

var dom = {
	pagesCached: null,
	canvasContainerCached: null,
	browseButtonCached: null,
	onepageButtonCached: null,

	get pages() {
		return this.pagesCached = this.pagesCached || document.querySelectorAll(settings.selectorPages);
	},
	get activePage() {
		return document.querySelector(settings.selectorActivePage);
	},
	get canvasContainer() {
		return document.querySelector("div.view");
	},
	get browseButton() {
		return this.browseButtonCached = this.browseButtonCached || document.querySelector(settings.selectorBrowseButton);
	},
	get onepageButton() {
		return this.onepageButtonCached = this.onepageButtonCached || document.querySelector(settings.selectorOnepageButton);
	},
	get activeOnepageButton() {
		return document.querySelector(settings.selectorActiveOnepageButton);
	},
	get pagenumAttr() {
		return settings.pagenumAttr;
	},
	get pagenumCorrection() {
		return settings.pagenumCorrection;
	},
	isActivePage: function(page) {
		return page.matches(settings.selectorActivePage);
	},
	isActiveOnepageButton: function() {
		return this.onepageButton.matches(settings.selectorActiveOnepageButton);
	}
};

function setupSelectors() {
	/*
		- click single page button
		- click dual page button
		- click browse pages button
		- click first page
		- click second page
		- click on opened comic page
	*/
	window.alert("A new exploit scan has to be made.\nPlease follow the upcoming instructions, or the extension may stop working for you.");
	var step = -1, // counter: where are we in the setup process?
		level = function(s, a) { // toggle between two activatable elements (e.g. opened pages) s and a. Goes up the DOM starting at s until the toggle causes a change of the class-attr of the current ascendant of s. -> the ascendant and the added/removed classes per toggle are returned.
			if(!s)
				return null;
			var classBefore = s.className,
				classAfter;
			realClick(s);
			classAfter = s.className;
			realClick(a);
			if(classBefore == classAfter)
				return level(s.parentElement, a);
			return {
				e:s,
				diff: wordDiff(classBefore, classAfter)
			};
		}, extendPath = function(path, classDiffList) { // add css-class selectors to a given css-selector path. classDiffList is a two dimensional array. the outer array contains all classes that should be added. the inner arrays have two elements: [0]=> -1/0/1 (require class not to be there / ignore this class / require class to be there), [1] => class name
			for (var i = 0; i < classDiffList.length; i++) {
				if(!classDiffList[i][0])
					continue;
				var w = classDiffList[i][1].trim();
				if(w.length)
					path += classDiffList[i][0]==1?"."+w:":not(."+w+")";
			}
			return path;
		},
		write = { selectors:1, scannedOnce:1 },
		steps = [ // steps array contains all the steps of the setup wizard. each step has a text that is displayed to the user, explaining what to do. callback will be called as soon as the user clicks some element on the page (clicked element is passed as parameter). boolean return value of callback determines if setup should be continued or if an error occured.
			{
				text: "Click the button that enables single page view.",
				btn: null,
				callback: function(element) {
					this.btn = element;
					return !!this.btn;
				}
			}, {
				text: "Click the button that enables dual page view.",
				callback: function(dual) {
					var single = steps[0].btn,
						states = level(single, dual);
					if(!states)
						return false;
					var inactive = getPathFor(states.e),
						active = extendPath(inactive, states.diff);
					realClick(single);
					write.selectorOnepageButton = inactive;
					write.selectorActiveOnepageButton = active;
					return inactive && active;
				}
			}, {
				text: "Click the browse button, that shows all pages.",
				callback: function(element) {
					var btn = getPathFor(element);
					write.selectorBrowseButton = btn;
					return !!btn;
				}
			}, {
				text: "Click on the thumbnail of the first page.",
				callback: function(element) {
					this.page = element;
					return this.page;
				}
			}, {
				text: "Click on the thumbnail of the second page.",
				callback: function(second) {
					var first = steps[3].page,
						states = level(first, second);
					if(!states)
						return false;
					var inactive = getPathFor(states.e, second),
						active = extendPath(inactive, states.diff),
						attrs = states.e.attributes,
						smallestIntAttr = null;
					if(document.querySelectorAll(inactive).length <= 1)
						return false;
					for (var i = 0, v; i < attrs.length; i++) {
						v = attrs[i].value.trim();
						if(v != "" && isFinite(v) && !(v%1) && (smallestIntAttr === null || smallestIntAttr.value > v*1))
							smallestIntAttr = { value:v*1, name:attrs[i].name };
					}
					write.selectorPages = inactive;
					write.selectorActivePage = active;
					write.pagenumAttr = smallestIntAttr.name;
					write.pagenumCorrection = smallestIntAttr.value;
					return inactive && active && smallestIntAttr;
				}
			}
		],
		waiter = function() {},
		listener,
		nextStep = function() {
			if(++step >= steps.length)
				return end();
			div.innerHTML = (step+1)+". "+steps[step].text;
			div.style.lineHeight = "50px";
			waiter = function(p) {
				if(steps[step].callback(p))
					nextStep();
				else
					fail();
			};
		},
		
		end = function() {
			window.alert("Scan completed.\nIf the backup still does not work you should force a new scan in the options.");
			document.documentElement.removeAttribute("scanning");
			document.documentElement.removeEventListener("click", listener, false);
			chrome.storage.local.set(write, function() {
				for (var key in write)
					settings[key] = write[key];
				displayMainBar(false);
			});
		}, fail = function() {
			window.alert("Sorry. The scan failed.\nMaybe you should try again.");
			window.location.reload();
		};
	
	document.documentElement.setAttribute("scanning", "1");
	
	document.documentElement.addEventListener("click", listener = function(e) {
		var w = waiter;
		waiter = function() {};
		w(e.target);
	}, false);
	
	nextStep(); // start with first setup instruction
}

function loadComic(callback, step) {

	div.innerHTML = "Downloading comic... <span>0</span>%";
	div.style.lineHeight = "50px";
	
	if(typeof callback != "function")
		callback = function() {};
	if(typeof step != "function")
		step = function() {};
	
	if(!dom.canvasContainer)
		return setTimeout(function() {
			loadComic(callback);
		}, 100);
	
	var pos = -1,
		l = dom.pages.length,
		numLength = String(l-1).length,
		nextPage = function(callback) {
			pos++;
			if (pos >= l) {
				changeWaiter = null;
				end();
				return;
			}
			var fig = dom.pages[pos];
			if (dom.isActivePage(fig)) {
				changeWaiter = null;
				callback();
			}
			else {
				changeWaiter = callback;
				realClick(fig);
			}
		}, changeWaiter = null,
		interval = function() {
			nextPage(function() {
				getOpenedPage(function(page) {
					chrome.runtime.sendMessage({ what:"add_page", page:(settings.compression!=2?page:""), i:pos, len:numLength, extension:(settings.page?"png":"jpg"), toZip:(settings.compression!=2) }, function(result) {
						var c = function() {
							div.getElementsByTagName("span")[0].innerHTML = (var perc = Math.round((pos + 1) / l * 100));
							step(perc);
							interval();
						};
						if(settings.compression==2)
							downloadFile(getName()+"/"+result.name, page, true, c);
						else
							c();
					});
				});
			});
		}, start = function() {
			start = function() {};
			interval();
		}, end = function() {
			dom.canvasContainer.parentElement.removeEventListener("DOMNodeRemoved", rmListener, false);
			zipImages(function() {
				document.documentElement.removeChild(div);
				document.documentElement.removeChild(overlay);
				callback();
				realClick(firstPageFig);
			});
		}, firstPage = 0, firstPageFig = null, rmListener = function() {
			var t = changeWaiter;
			changeWaiter = null;
			if (typeof t === "function")
				setTimeout(t, 5);
			else
				start();
		};

	chrome.runtime.sendMessage({ what:"new_zip", user:getUsername() }, function() {
		dom.canvasContainer.parentElement.addEventListener("DOMNodeRemoved", rmListener, false);
		realClick(dom.browseButton);
		firstPageFig = dom.activePage;
		firstPage = (firstPageFig && firstPageFig.getAttribute(dom.pagenumAttr)*1+dom.pagenumCorrection) || 0;
		pos = settings.start?firstPage-1:-1;
		if(dom.isActiveOnepageButton())
			start();
		else {
			realClick(dom.onepageButton);
			setTimeout(function() {
				start();
			}, 1000);
		}
		overlay.style.display = "block";
	});
}

function getName() {
	var title = document.getElementsByTagName('title');
	if(title[0])
		return title[0].innerHTML.substr(0, title[0].innerHTML.lastIndexOf("-")).trim().replace(/\s/g, "_");
	return "comic";
}

function getUsername() {
	var reader = document.getElementById("reader");
	return (reader && reader.getAttribute("data-username")) || "";
}

var getUsernameImage = function(ctx, w, h) {
	var uName = getUsername(),
		uW = (uName.length+1)*8,
		data = ctx.getImageData(w-uW, h-1, uW, 1),
		p, c, i, e, q, hsl, rgb;
	for (i = -1; i < uName.length; i++) {
		p = (i+1)*32;
		c = nullFill(i<0?"00000000":Number(uName.charCodeAt(i)).toString(2), 8);
		for (e = 0; e < c.length; e++) {
			q = p+e*4;
			hsl = rgbToHsl(data.data[q], data.data[q+1], data.data[q+2]);
			if(c.charAt(e)*1 && hsl[2] < 0.65)
				hsl[2] = 0.65;
			else if(!(c.charAt(e)*1) && hsl[2] > 0.35)
				hsl[2] = 0.35;
			rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
			data.data[q] = rgb[0];
			data.data[q+1] = rgb[1];
			data.data[q+2] = rgb[2];
			data.data[q+3] = 255 | 0;
		}
	}
	
	return data;
}

function downloadFile(name, data, overwrite, callback) { // overwrite is not used currently
	setTimeout(function() {
		var a = document.createElement("a");
		a.download = a.innerHTML = name;
		a.rel = "stylesheet";
		a.href = data;
		a.click();
		if(typeof callback === "function")
			callback();
	}, 0);
}

function zipImages(callback) {
	if(settings.compression == 2)
		return typeof callback === "function"?callback():undefined;
	div.innerHTML = "Zipping images...";
	div.style.lineHeight = "50px";

	chrome.runtime.sendMessage({ what:"start_zipping", compress:settings.compression }, function(result) {
		div.innerHTML = "Saving comic...";
		downloadFile(getName()+"."+(settings.container?"zip":"cbz"), result.url, false, callback);
	});
}

function getOpenedPage(callback) {
	var view = dom.canvasContainer,
		loader = document.querySelector('div.loading'),
		doneLoading = view && (view.style.webkitTransform || view.style.transform) && (!loader || loader.style.display == "none");
	if(doneLoading) {
		var canvasOnThisPage = view.childNodes,
			w = view.style.width.split('p')[0],
			h = view.style.height.split('p')[0],
			outCanvas = document.createElement('canvas'),
			ctx = outCanvas.getContext('2d'),
			canvas, data;
		outCanvas.width = w;
		outCanvas.height = h;
		for (var i = 0; i < canvasOnThisPage.length; i++) {
			canvas = canvasOnThisPage[i];
			ctx.drawImage(canvas, canvas.style.left.split('p')[0]*1, canvas.style.top.split('p')[0]*1, canvas.style.width.split('p')[0]*1, canvas.style.height.split('p')[0]*1);
		}
		data = getUsernameImage(ctx, w, h);
		ctx.putImageData(data, w-data.width, h-data.height);
		
		callback(outCanvas.toDataURL("image/"+(settings.page?"png":"jpeg")));
	}
	else {
		setTimeout(function() {
			realClick(dom.activePage);
			getOpenedPage(callback);
		}, 300);
	}
}

chrome.runtime.sendMessage({ what:"tab_info" }, function(info) {
	var tab = info.tab,
		openerTab = info.opener;
	if(openerTab)
		chrome.runtime.sendMessage({ what:"tab_message", tab:openerTab.id, message:{ what:"ready_to_download", tab:tab } }, function(start) {
			if(start && start.download) {
				loadComic(function() {
					chrome.runtime.sendMessage({ what:"tab_message", tab:openerTab.id, message:{ what:"finished_download", tab:tab } });
				}, function(perc) {
					chrome.runtime.sendMessage({ what:"download_progress", tab:openerTab.id, message:{ what:perc, tab:tab } });
					});
			}
		});
});