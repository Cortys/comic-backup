//Code is under GNUGPLv3 - read http://www.gnu.org/licenses/gpl.html
"use strict";

var overlay = document.createElement("div");

overlay.style.position = "fixed";
overlay.style.zIndex = 299;
overlay.style.top = overlay.style.left = overlay.style.bottom = overlay.style.right = 0;
overlay.style.width = overlay.style.height = "auto";
overlay.style.background = "rgba(0,0,0,0.3)";
overlay.style.display = "none";
document.documentElement.appendChild(overlay);

(function() {
	var favicons = document.head.querySelectorAll("link[rel~=icon]");

	for(var i = 0; i < favicons.length; i++)
		document.head.removeChild(favicons[i]);
}());

var favicon = document.createElement("link");
favicon.type = "image/png";
favicon.rel = "shortcut icon";

document.head.appendChild(favicon);
renderFaviconPercentage();

//ENTRANCE POINT FOR READER BACKUP LOGIC:

var port = connector.connect({
		name: "reader"
	}),
	swapPage;

getSettings(function() {

	if(!("pageSwapDelay" in settings))
		settings.pageSwapDelay = 600;

	if(!("pageSkipDelay" in settings))
		settings.pageSkipDelay = 1200;

	if(!settings.pageSwapDelay)
		swapPage = function swapPage(callback) {
			if(typeof callback === "function")
				callback();
		};
	else
		swapPage = function swapPage(callback) {
			var swap = function() {
					swapPage.lastSwap = Date.now();
					if(typeof callback === "function")
						callback();
				},
				d = !swapPage.lastSwap ? 0 : settings.pageSwapDelay - (Date.now() - swapPage.lastSwap);
			if(d <= 0)
				swap();
			else
				setTimeout(swap, d);
		};

	// delete cached uncompleted zip-backups for this tab:
	port.send({
		what: "is_child"
	}, function(isChild) { // tab opened by extension -> autorun / else -> show bar
		if(!isChild) {
			if(!settings.selectors && settings.selectors != null)
				displayExploitBar();
			return;
		}

		port.send({
			what: "message_to_opener",
			message: {
				what: "ready_to_download",
				data: getName()
			}
		}, function(start) {
			if(start) {
				if(start.download) {
					renderFaviconPercentage(0);

					loadComic(function(err) {
						port.send({
							what: "message_to_opener",
							message: {
								what: err ? "download_failed" : "finished_download"
							}
						});
					}, function(perc) {
						port.send({
							what: "message_to_opener",
							message: {
								what: "download_progress",
								data: perc
							}
						});
					}, start.metaData);
				}
				else if(start.exploit) {
					port.send({
						what: "unlink_from_opener"
					});
					setupSelectors();
				}
			}
		});
	});
});

function renderFaviconPercentage(perc) {

	if(perc === undefined) {
		favicon.href = chrome.extension.getURL("blankLogo.png");
		return;
	}

	var canvas = document.createElement('canvas'),
		ctx = canvas.getContext('2d');

	canvas.width = canvas.height = 32;

	ctx.globalCompositeOperation = "source-over";
	ctx.fillStyle = perc < 1 ? "#b97c11" : "#6f9305";

	ctx.beginPath();
	ctx.moveTo(16, 16);
	ctx.arc(16, 16, 14, -Math.PI / 2, Math.PI * 2 * (perc - 0.25), false);
	ctx.fill();
	ctx.closePath();

	ctx.globalCompositeOperation = "destination-out";

	ctx.beginPath();
	ctx.arc(16, 16, 10, 0, Math.PI * 2, false);
	ctx.fill();
	ctx.closePath();

	if(perc < 1) {
		ctx.globalCompositeOperation = "source-over";
		ctx.fillStyle = settings.faviconColor ? "#ffffff" : "#000000";
		ctx.font = "13px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("" + Math.round(perc * 100), 16, 16, 18);
	}

	favicon.href = canvas.toDataURL("image/png");
}

// show orange bar: asking for exploit scan
function displayExploitBar() {
	addTopBar();
	div.style.lineHeight = "25px";
	div.innerHTML = "Do you want to start an exploit scan? This is required to backup comics.<br><a href=\"javascript:document.documentElement.removeChild(document.getElementById('" + div.id + "'))\" style='" + linkStyle + "'>No</a> ";
	var a = document.createElement("a");
	a.innerHTML = "Yes";
	a.href = "#";
	a.addEventListener('click', function(e) {
		e.stopPropagation();
		setupSelectors();
	}, false);
	a.setAttribute("style", linkStyle);
	div.appendChild(a);
}

function getPathFor(e, tryE) { // returns css selector that matches e and tryE as well (if that is possible, without two comma seperated selectors) - only tags, ids and classes are used
	if(!e)
		return "";
	if(e.id)
		return "#" + e.id;
	var before = getPathFor(e.parentElement) + " > " + e.tagName,
		classes = "",
		classesBefore,
		p = 0,
		selection = document.querySelectorAll(before),
		selectionBefore,
		couldMatch = function() { // returns true if the current state of path could also match tryE (directly or if it was specified further)
			if(!tryE)
				return true;
			var c = tryE;
			while(c) {
				if(c.matches(before + classes))
					return true;
				c = tryE.parentElement;
			}
			return false;
		};
	if(e.classList.length)
		do {
			classesBefore = classes;
			classes += "." + e.classList[p++];
			selectionBefore = selection.length;
			selection = document.querySelectorAll(before + classes);
			if(selection.length >= selectionBefore || !couldMatch())
				classes = classesBefore;
		} while (p < e.classList.length && selection.length > 1);
	return before + classes;
}

function wordDiff(text1, text2) { // word wise difference of two strings (using diff_match_patch library)

	text1 = text1.trim() + " ";
	text2 = text2.trim() + " ";

	var lineArray = []; // e.g. lineArray[4] == 'Hello\n'
	var lineHash = {}; // e.g. lineHash['Hello\n'] == 4

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
		while(lineEnd < text.length - 1) {
			lineEnd = text.indexOf(' ', lineStart);
			if(lineEnd == -1) {
				lineEnd = text.length - 1;
			}
			var line = text.substring(lineStart, lineEnd + 1);
			lineStart = lineEnd + 1;

			if(lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
				(lineHash[line] !== undefined)) {
				chars += String.fromCharCode(lineHash[line]);
			}
			else {
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

function realClick(e) { // simulate a "real" click on given DOMElement e (can't be distinguished from a user click)
	if(!e)
		return;
	var evt = document.createEvent("MouseEvents"),
		rect = e.getBoundingClientRect(),
		doc = e.ownerDocument,
		win = (doc && (doc.defaultView || doc.parentWindow)) || window,
		left = rect.left || 1,
		top = rect.top || 1;
	evt.initMouseEvent("click", true, true, win, 1, left, top, left, top, false, false, false, false, 0, null);
	e.dispatchEvent(evt);
}

var scanPresets = {
	selectorActiveOnepageButton: "#onepage-btn.active",
	selectorActivePage: "#thumbnails-list > LI > FIGURE.active",
	selectorBrowseButton: "#browse-btn > IMG",
	selectorOnepageButton: "#onepage-btn",
	selectorPages: "#thumbnails-list > LI > FIGURE",
	pagenumAttr: "data-pagenumber",
	pagenumCorrection: 0
};

var dom = { // stores DOM elements of the reader page. All DOM calls go here. No queries elsewhere to make it easier to adapt to reader changes.
	pagesCached: null,
	canvasContainer: null,
	browseButtonCached: null,
	onepageButtonCached: null,

	isVisible(e) {
		return e.style.display != "none" && e.style.visibility != "hidden";
	},

	get pages() {
		return(this.pagesCached = this.pagesCached) || function() {

			var pages = document.querySelectorAll(settings.selectorPages || scanPresets.selectorPages);

			if(pages.length > 1 && pages[0].getAttribute(this.pagenumAttr) * 1 > pages[pages.length - 1].getAttribute(this.pagenumAttr) * 1)
				pages = Array.prototype.slice.call(pages, 0).reverse();

			return pages;
		}.call(this);
	},
	get activePage() {
		return document.querySelector(settings.selectorActivePage || scanPresets.selectorActivePage);
	},

	loopCanvasContainers(f) {
		var a = document.querySelectorAll("div.view"),
			v;
		for(var i = 0; i < a.length; i++)
			if(this.isVisible(a[i]) && (v = f(a[i])))
				return v;
		return null;
	},

	getCanvasContainer() {
		var t = this;
		if(t.canvasContainer && document.contains(t.canvasContainer) && t.isVisible(t.canvasContainer))
			return this.canvasContainer;
		return(t.canvasContainer = t.loopCanvasContainers(function(a) {
			return a;
		}));
	},
	get canvasContainerCount() {
		var i = 0;
		this.loopCanvasContainers(function() {
			i++;
		});
		return i;
	},
	get canvasElements() {
		return this.canvasContainer.querySelectorAll("canvas");
	},
	get browseButton() {
		return(this.browseButtonCached = this.browseButtonCached) || document.querySelector(settings.selectorBrowseButton || scanPresets.selectorBrowseButton);
	},
	get onepageButton() {
		return(this.onepageButtonCached = this.onepageButtonCached) || document.querySelector(settings.selectorOnepageButton || scanPresets.selectorOnepageButton);
	},
	get activeOnepageButton() {
		return document.querySelector(settings.selectorActiveOnepageButton || scanPresets.selectorActiveOnepageButton);
	},
	get pagenumAttr() {
		return settings.pagenumAttr || scanPresets.pagenumAttr;
	},
	get pagenumCorrection() {
		return settings.pagenumCorrection != null ? settings.pagenumCorrection : scanPresets.pagenumCorrection;
	},
	get loader() {
		return document.querySelectorAll(".loading");
	},
	loaderVisible() {
		return this.loader && this.loader.length && Array.prototype.reduce.call(this.loader, function(prev, curr) {
			return prev || curr.style.display !== "none";
		}, false);
	},
	isActivePage(page) {
		return page.matches(settings.selectorActivePage || scanPresets.selectorActivePage);
	},
	isActiveOnepageButton() {
		return this.onepageButton.matches(settings.selectorActiveOnepageButton || scanPresets.selectorActiveOnepageButton);
	},
	countCanvas() {
		return this.canvasElements.length;
	},
	isLoading() {
		var view;
		return this.canvasContainerCount !== 1 || (view = dom.getCanvasContainer(), !view.style.webkitTransform && !view.style.transform) || dom.loaderVisible() || !dom.canvasElements.length;
	}
};

function setupSelectors() { // run a DOM scan to analyse how the reader DOM tree is structured and how it should be backuped
	/*
		- click single page button
		- click dual page button
		- click browse pages button
		- click first page
		- click second page
		- click on opened comic page
	*/
	addTopBar();
	window.alert("A new exploit scan has to be made.\nPlease follow the upcoming instructions or the extension may stop working for you.");
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
				e: s,
				diff: wordDiff(classBefore, classAfter)
			};
		},
		extendPath = function(path, classDiffList) { // add css-class selectors to a given css-selector path. classDiffList is a two dimensional array. the outer array contains all classes that should be added. the inner arrays have two elements: [0]=> -1/0/1 (require class not to be there / ignore this class / require class to be there), [1] => class name
			for(var i = 0; i < classDiffList.length; i++) {
				if(!classDiffList[i][0])
					continue;
				var w = classDiffList[i][1].trim();
				if(w.length)
					path += classDiffList[i][0] == 1 ? "." + w : ":not(." + w + ")";
			}
			return path;
		},
		write = {
			selectors: 1,
			scannedOnce: 1
		},
		steps = [ // steps array contains all the steps of the setup wizard. each step has a text that is displayed to the user, explaining what to do. callback will be called as soon as the user clicks some element on the page (clicked element is passed as parameter). boolean return value of callback determines if setup should be continued or if an error occured.
			{
				text: "Click the button that enables single page view.",
				btn: null,
				callback(element) {
					this.btn = element;
					return !!this.btn;
				}
			}, {
				text: "Click the button that enables dual page view.",
				callback(dual) {
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
				text: "Click the browse button that shows all pages.",
				callback(element) {
					var btn = getPathFor(element);
					write.selectorBrowseButton = btn;
					return !!btn;
				}
			}, {
				text: "Click on the thumbnail of the first page.",
				callback(element) {
					this.page = element;
					return this.page;
				}
			}, {
				text: "Click on the thumbnail of the second page.",
				callback(second) {
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
					for(var i = 0, v; i < attrs.length; i++) {
						v = attrs[i].value.trim();
						if(v !== "" && isFinite(v) && v % 1 === 0 && (smallestIntAttr === null || smallestIntAttr.value > v * 1))
							smallestIntAttr = {
								value: v * 1,
								name: attrs[i].name
							};
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
			div.innerHTML = (step + 1) + ". " + steps[step].text;
			div.style.lineHeight = "50px";
			waiter = function(p) {
				if(steps[step].callback(p))
					nextStep();
				else
					fail();
			};
		},

		start = function() {
			div.innerHTML = "Navigate to the first page of this comic.<br>";
			var a = document.createElement("a");
			a.setAttribute("style", linkStyle);
			a.href = "javascript:";
			a.innerHTML = "OK. I did.";
			a.addEventListener("click", function(event) {
				event.stopPropagation();
				nextStep();
			}, false);
			div.appendChild(a);
		},

		end = function() {
			window.alert("Scan completed.\nIf the backup still does not work, you should force a new scan in the options.");

			document.documentElement.removeAttribute("scanning");
			document.documentElement.removeEventListener("click", listener, false);
			document.documentElement.removeChild(div);

			chrome.storage.local.set(write, function() {
				for(var key in write)
					settings[key] = write[key];

				port.send({
					what: "broadcast_to_openers",
					message: {
						what: "finished_scan"
					}
				});
			});
		},
		fail = function() {
			window.alert("Sorry. The scan failed.\nMaybe you should try again.");
			window.location.reload();
		};

	document.documentElement.setAttribute("scanning", "1");

	document.documentElement.addEventListener("click", listener = function(e) {
		var w = waiter;
		waiter = function() {};
		w(e.target);
	}, false);

	start();
}

// download the opened comic. a callback and a step function can be used.
function loadComic(callback, step, metaData) {
	throttleBlocker();
	addTopBar();
	overlay.style.display = "block";

	div.innerHTML = "Downloading comic... <span>0</span>%";
	div.style.lineHeight = "50px";
	renderFaviconPercentage(0);

	if(typeof callback != "function")
		callback = function() {};
	if(typeof step != "function")
		step = function() {};

	var l = dom.pages.length;

	if(l < 1)
		return callback(new Error("Found no pages to backup."));

	if(!dom.getCanvasContainer() || dom.loaderVisible() || !dom.countCanvas()) // delay download if comic isn't displayed yet => reader not ready, first page is not loaded yet, first page is not displayed yet
		return setTimeout(function() {
			loadComic(callback, step, metaData);
		}, 100);

	var pos = -1,
		dualPageProofCount = 0,
		numLength = String(l - 1).length,
		nextPage = function(callback, mode) {
			var targetPage = ++pos;

			clearTimeout(noChangeTimeout);

			if(changeWaiter)
				changeWaiter.killed = true;

			if(pos >= l) {
				end();
				return;
			}
			var fig = dom.pages[pos];
			if(dom.isActivePage(fig)) {
				callback();
			}
			else {
				callback = changeWaiter = callback.bind(); // to remove killed or toBeHandled properties
				// Guarantee that at least settings.pageSwapDelay ms have passed between this and last swap:
				swapPage(function() {
					function tryAgain() {
						// => Try opening the page again by going back and then forward:
						pos = targetPage === 0 ? l - 2 : targetPage - 2;
						nextPage(function(dualPageAssumed) {
							// If the previous nextPage call caused skipping to the target page, use it:
							if(pos === targetPage && !dualPageAssumed)
								callback();
							else {
								// Skip page if dual page is assumed:
								pos = dualPageAssumed ? targetPage : targetPage - 1;

								nextPage(callback);
							}
						}, "back");
					}

					if(changeWaiter === callback) {
						(function waitAgain(i) {
							noChangeTimeout = setTimeout(function() {
								if(changeWaiter === callback) {
									if(dom.isLoading() || !dom.isActivePage(fig)) {
										if(i < 5)
											waitAgain(i + 1);
										else
											tryAgain();
									}
									else if(mode === "back")
										nextPage(callback, "forward");
									else if(mode === "forward") {
										dualPageProofCount++;
										callback.killed = true;
										callback(true);
									}
									else if(dualPageProofCount > 1 && mode !== "noskip") {
										nextPage(callback, "noskip");
									}
									else
										tryAgain();
								}
							}, settings.pageSkipDelay);
						}(1));

						realClick(fig);
					}
				});
			}
		},
		changeWaiter = null,
		noChangeTimeout = null,

		interval = function() {
			nextPage(function() {
				getOpenedPage(function(page) {
					port.send({
						what: "add_page",
						page: (settings.container != 2 ? page : null),
						i: pos,
						len: numLength,
						extension: (settings.page ? "png" : "jpeg"),
						toZip: (settings.container != 2)
					}, function(result) {
						if(settings.container == 2)
							downloadData(getName() + "/" + result.name, page, true);

						var floatingPerc = (pos + 1) / l,
							perc = Math.round(floatingPerc * 100);
						div.getElementsByTagName("span")[0].innerHTML = perc;
						renderFaviconPercentage(floatingPerc);
						step(perc);
						interval();
					});
				},
				function(page) {
					port.send({
						what: "add_page",
						page: (settings.container != 2 ? page : null),
						i: pos-1,
						len: numLength,
						extension: (settings.page ? "png" : "jpeg"),
						toZip: (settings.container != 2)
					}, function(result) {
						if(settings.container == 2)
							downloadData(getName() + "/" + result.name, page, true);

						var floatingPerc = (pos + 1) / l,
							perc = Math.round(floatingPerc * 100);
						div.getElementsByTagName("span")[0].innerHTML = perc;
						renderFaviconPercentage(floatingPerc);
						step(perc);
						interval();
					});
				});
			});
		},
		start = function() {
			start = function() {};
			interval();
		},
		end = function() {

			if(mutationObserver)
				mutationObserver.disconnect();

			function done() {
				document.documentElement.removeChild(div);
				document.documentElement.removeChild(overlay);
				realClick(firstPageFig);
				callback();
			}
			if(settings.container == 2)
				done();
			else {
				step("zip");
				zipImages(function() {
					step("save");
					downloadBlob(getName() + "." + (settings.container ? "zip" : "cbz"), done);
				}, metaData);
			}
		},
		rmListener = function() {
			var container = dom.canvasContainer,
				waiter = changeWaiter;

			if(typeof waiter === "function" && !waiter.killed && !waiter.toBeHandled && (!dom.countCanvas() || !dom.isVisible(container))) {
				waiter.toBeHandled = true;

				(function check() {
					if(container === dom.getCanvasContainer() || dom.isLoading())
						setTimeout(check, 100);
					else if(!waiter.killed) {
						clearTimeout(noChangeTimeout);
						waiter();
					}
				}());
			}
		},
		mutationObserver = null,
		firstPage = 0,
		firstPageFig = null;

	port.send({
		what: "new_zip",
		user: getUsername()
	}, function(result) {
		if(result.error) // zip creation failed: stop backup immediately.
			return callback(new Error("Zip creation failed."));

		mutationObserver = new MutationObserver(function(mutations) {
			var removed = false;
			for(var i = 0; i < mutations.length; i++)
				if(mutations[i].removedNodes.length > 0) {
					removed = true;
					break;
				}
			if(removed)
				rmListener();
		}).observe(dom.getCanvasContainer().parentElement, {
			subtree: true,
			childList: true
		});

		realClick(dom.browseButton);
		firstPageFig = dom.activePage;
		firstPage = (firstPageFig && firstPageFig.getAttribute(dom.pagenumAttr) * 1 - settings.pagenumCorrection) || 0;
		pos = settings.start ? Math.max(firstPage - 1, -1) : -1;
		if(dom.onepageButton != null && !dom.isActiveOnepageButton())
			realClick(dom.onepageButton);

		pageLoaded(start);
	});
}

function getName() {
	if(getName.title != null)
		return getName.title;
	var title = document.getElementsByTagName('title');
	if(title[0]) {
		var spaceReplacement = {
			1: "_",
			2: ".",
			3: "-",
			4: ""
		}[settings.filename];
		return (getName.title = sanitizeFilename(title[0].innerHTML.substr(0, title[0].innerHTML.lastIndexOf("-")).trim(), spaceReplacement) || "comic");
	}
	return "comic";
}
getName.title = null;

function getUsername() {
	var reader = document.getElementById("reader");
	return (reader && reader.getAttribute("data-username")) || "";
}

function getUsernameImage(ctx, w, h) {
	var uName = getUsername(),
		uW = (uName.length + 1) * 8,
		data = ctx.getImageData(w - uW, h - 1, uW, 1),
		p, c, i, e, q, hsl, rgb;
	for(i = -1; i < uName.length; i++) {
		p = (i + 1) * 32;
		c = nullFill(i < 0 ? "00000000" : Number(uName.charCodeAt(i)).toString(2), 8);
		for(e = 0; e < c.length; e++) {
			q = p + e * 4;
			hsl = rgbToHsl(data.data[q], data.data[q + 1], data.data[q + 2]);
			if(c.charAt(e) * 1 && hsl[2] < 0.65)
				hsl[2] = 0.65;
			else if(c.charAt(e) * 1 === 0 && hsl[2] > 0.35)
				hsl[2] = 0.35;
			rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
			data.data[q] = rgb[0];
			data.data[q + 1] = rgb[1];
			data.data[q + 2] = rgb[2];
		}
	}

	return data;
}

function downloadBlob(name, callback) { // overwrite is not used currently
	// blobs have to be downloaded from background page (same origin policy)
	port.send({
		what: "download_blob",
		name: name
	}, callback);
}

function downloadData(name, data, overwrite, callback) { // overwrite is not used currently
	var url = URL.createObjectURL(dataURLtoBlob(data));
	downloadFile(name, url, overwrite, function() {
		URL.revokeObjectURL(url);
		callback();
	});
}

// compress and download all pages that were backuped by this tab in the loadComic function
function zipImages(callback, comment) {
	if(settings.container == 2)
		return typeof callback === "function" ? callback() : undefined;
	renderFaviconPercentage(1);
	div.innerHTML = "Zipping images...";
	div.style.lineHeight = "50px";

	port.send({
		what: "start_zipping",
		comment: comment
	}, function(result) {
		renderFaviconPercentage(1);
		div.innerHTML = "Saving comic...";
		callback();
	});
}

function pageLoaded(callback) {
	if(!dom.isLoading())
		callback();
	else
		setTimeout(function() {
			pageLoaded(callback);
		}, 100);
}

// get data URL of the currently opened page in the reader (async! result is given to callback)
function getOpenedPage(callback, callback2) {
	pageLoaded(function() {
		var view = dom.getCanvasContainer(),
			canvasOnThisPage = dom.canvasElements;

		var w = parseInt(view.style.width),
			h = parseInt(view.style.height),
			outCanvas = document.createElement('canvas'),
			ctx = outCanvas.getContext('2d'),
			canvas, data;
			outCanvas.width = w;
			outCanvas.height = h;

			if(settings.pageSplit && w > h) {
				var outCanvas2 = document.createElement('canvas'),
				ctx2 = outCanvas2.getContext('2d');
				outCanvas.width = w/2;
				outCanvas2.width = w/2;
				outCanvas2.height = h;
			}

		for(var i = 0; i < canvasOnThisPage.length; i++) {
			canvas = canvasOnThisPage[i];
			if(settings.pageSplit && w > h) {
				ctx.drawImage(canvas, 0, 0, w/2, h, 0, 0, w/2, h);
				ctx2.drawImage(canvas, w/2, 0 , w/2, h, 0, 0, w/2, h);
			}
			else {
				ctx.drawImage(canvas, parseInt(canvas.style.left) || 0, parseInt(canvas.style.top) || 0, parseInt(canvas.style.width) || 0, parseInt(canvas.style.height) || 0);
			}
		}
		data = getUsernameImage(ctx, w, h);
		ctx.putImageData(data, w - data.width, h - data.height);

		if(settings.pageSplit && w > h) {
			//console.log("Returning 2 pages");
			callback(outCanvas.toDataURL("image/" + (settings.page ? "png" : "jpeg")));
			callback2(outCanvas2.toDataURL("image/" + (settings.page ? "png" : "jpeg")));
		}
		else {
			//console.log("Returning 1 page");
			callback(outCanvas.toDataURL("image/" + (settings.page ? "png" : "jpeg")), null);
		}

	});
}
