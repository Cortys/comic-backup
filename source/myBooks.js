var readButtons = document.body.querySelectorAll(".read-comic.titleBtn");


var i;
for (i in readButtons){
	var clone = readButtons[i].cloneNode();
	readButtons[i].insertAfter(clone);
}