"use strict";

function MetaData() {

	//We may want to support different outputmodes later on
	//For now, there is only one: https://code.google.com/p/comicbookinfo/wiki/Example
	//This is used by Calibre
	this.outputMode = "CBI";

	//This object will contain the actual metadata in a format
	//that should allow easy download via STRINGIFY
	this.JSONMD = {
		appID: "Comic Backup/" + current_version,
		lastModified: new Date().toISOString().replace(/T|Z/g, " ") + "+0000",
		"ComicBookInfo/1.0": {
			series: "",
			title: "",
			publisher: "",
			publicationMonth: "",
			publicationYear: "",
			issue: "",
			numberOfIssues: "",
			volume: "",
			nubmerOfVolumes: "",
			rating: "",
			genre: "",
			language: "",
			country: "",
			credits: []
		}
	};

	//This is a shortcut to the actual data, it's there so I can fill detail
	//data in without having to repeat the key - I doubt it'll ever change,
	//but if we ever switch to ComicBookInfo/2.0 , it'll be easier to maintain :-)
	this.JSONData = this.JSONMD["ComicBookInfo/1.0"];

	//In order to declare the first person in a role, I need to remember somwhere if we
	//already had a first - so I'm creating a simply array with all the known roles
	//that will go INTO the metadata
	this.firstRoles = {
		Writer: true,
		Artist: true,
		Letterer: true,
		Colorer: true,
		Editor: true,
		Cover: true
	};

	//I need to know the first time I add credits, because PUSH apparently doesn't work on
	//empty arrays
	this.firstCredit = true;
}

MetaData.prototype = {
	scanMeta(p_bookItem) {
			var bookItem = p_bookItem;
			//To find the metadata, we need to find the top container for this comic
			//unfortunately, they're not marked with a special id :-(
			//var bookItem = readButton.parentNode;

			//Try to find the detail container, do nothing if it's not there - it means we're not on a detail page
			if(bookItem.className != null)
				try {
					if(bookItem.className == "lv2-item-action-row") {
						while(bookItem !== undefined && bookItem.className != "lv2-item-detail")
							bookItem = bookItem.parentNode;

						//A bit of a gamble, I'm assuming there's always just one

						var itemTitleRaw = bookItem.getElementsByClassName("lv2-title-container")[0];
						var itemCreditRaw = bookItem.getElementsByTagName("aside")[0];

						//Ignore the actual hierarchy, just take all DLs, which should contain DD/DT pairs with credits
						var allCredits = itemCreditRaw.getElementsByTagName("dl");
						for(var i = 0; i < allCredits.length; i++) {
							//There should be only one DT/DD anyway
							var oneDT = allCredits[i].getElementsByTagName("dt")[0];
							var oneDD = allCredits[i].getElementsByTagName("dd")[0];
							var oneDTlc = oneDT.innerText.toLowerCase();

							if(oneDTlc == "full series") {
								this.addSeries(oneDD.innerText);
							}
							else if(oneDTlc == "writer" || oneDTlc == "written by" || oneDTlc == "by") {
								this.addWriter(oneDD.innerText);
							}
							else if(oneDTlc == "inks") {
								this.addInks(oneDD.innerText);
							}
							else if(oneDTlc == "cover by" || oneDTlc == "cover") {
								this.addCover(oneDD.innerText);
							}
							else if(oneDTlc == "art" || oneDTlc == "penciler" || oneDTlc == "pencils") {
								this.addPencil(oneDD.innerText);
							}
							else if(oneDTlc == "colored by" || oneDTlc == "colorist") {
								this.addColor(oneDD.innerText);
							}
							else if(oneDTlc == "editor") {
								this.addEditor(oneDD.innerText);
							}
						}

						//We know that under lv2-title-container there should be a single node with lv2-item-number
						var itemNumber = itemTitleRaw.getElementsByClassName("lv2-item-number")[0].innerText.match(/\d+/);
						//This will only work in some cases - apparently sometimes there are title additions in the issue field
						//still, better than nothing?
						itemNumber = parseInt(itemNumber && itemNumber[0]);
						if(!isNaN(itemNumber))
							this.addIssue(itemNumber);
					}
				}
			catch(err) {
				//Die silently...
				//alert(err);
			}

			return this;
		},

		addPerson(newPerson, Role) {
			var aPerson = {
				person: newPerson,
				role: Role,
				primary: this.firstRoles[Role]
			};
			this.firstRoles[Role] = false;

			if(this.firstCredit === true)
				this.JSONData.credits = [aPerson];
			else
				this.JSONData.credits.push(aPerson);
			this.firstCredit = false;

			return this;
		},

		//Add a list of allowed modes to check against?
		changeOutputMode(newOutputMode) {
			this.outputMode = newOutputMode;

			return this;
		},

		//Since all data is currently in a JSON object, we need methods
		//to fill them, instead of simply accessing the object
		addSeries(newSeries) {
			this.JSONData.series = newSeries;

			return this;
		},
		addTitle(newTitle) {
			this.JSONData.title = newTitle;

			return this;
		},
		addPublisher(newPublisher) {
			this.JSONData.publisher = newPublisher;

			return this;
		},
		addPublicationMonth(newPublicationMonth) {
			this.JSONData.publicationMonth = newPublicationMonth;

			return this;
		},
		addPublicationYear(newPublicationYear) {
			this.JSONData.publicationYear = newPublicationYear;

			return this;
		},
		addIssue(newIssue) {
			this.JSONData.issue = newIssue;

			return this;
		},
		addNumberOfIssues(newNumberOfIssues) {
			this.JSONData.numberOfIssues = newNumberOfIssues;

			return this;
		},
		addVolume(newVolume) {
			this.JSONData.volume = newVolume;

			return this;
		},
		addNumberOfVolumes(newNumberOfVolumes) {
			this.JSONData.numberOfVolumes = newNumberOfVolumes;

			return this;
		},
		addRating(newRating) {
			this.JSONData.rating = newRating;

			return this;
		},
		addGenre(newGenre) {
			this.JSONData.genre = newGenre;

			return this;
		},
		addLanguage(newLanguage) {
			this.JSONData.language = newLanguage;

			return this;
		},
		addCountry(newCountry) {
			this.JSONData.country = newCountry;

			return this;
		},

		//Persons get their own functions, that way we can control where specific roles go
		//Inks and Pencils may end up in Artist for now, but perhaps later they'll be split?
		addWriter(newWriter) {
			this.addPerson(newWriter, "Writer");

			return this;
		},
		addEditor(newEditor) {
			this.addPerson(newEditor, "Editor");

			return this;
		},
		addInks(newInks) {
			this.addPerson(newInks, "Artist");

			return this;
		},
		addCover(newCover) {
			this.addPerson(newCover, "Cover");

			return this;
		},
		addPencil(newPencil) {
			this.addPerson(newPencil, "Artist");

			return this;
		},
		addColor(newColor) {
			this.addPerson(newColor, "Colorer");

			return this;
		},

		//Output - there may be multiple output modes later, so don't just
		//use JSON.STRINGIFY from the outside
		toString(outputMode) {
			var retString = "";
			var useMode = outputMode;

			if(useMode === undefined)
				useMode = this.outputMode;

			if(useMode == "CBI")
				retString = JSON.stringify(this.JSONMD);

			return retString;
		}
};
