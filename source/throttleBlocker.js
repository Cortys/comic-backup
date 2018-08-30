"use strict";

function throttleBlocker() {
	if(typeof AudioContext !== "function" || throttleBlocker.active)
		return;

	throttleBlocker.active = true;

	new RTCPeerConnection();
}
