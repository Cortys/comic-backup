"use strict";

(function() {
	if(typeof AudioContext !== "function")
		return;

	var ctx = new AudioContext();
	var o = ctx.createOscillator();
	var g = ctx.createGain();

	o.type = "sine";
	o.frequency.value = 1;
	g.gain.value = 0.001;

	o.connect(g);
	g.connect(ctx.destination);
	o.start();
}());
