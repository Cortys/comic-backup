"use strict";

function throttleBlocker() {
	if(typeof RTCPeerConnection !== "function" || throttleBlocker.active)
		return;

	throttleBlocker.active = true;

	var connA = new RTCPeerConnection();
	var connB = new RTCPeerConnection();
	connA.createDataChannel("dummy_channel");
	connA.onicecandidate = e => !e.candidate || connB.addIceCandidate(e.candidate);
    connB.onicecandidate = e => !e.candidate || connA.addIceCandidate(e.candidate);
	connA.createOffer()
		.then(offer => connA.setLocalDescription(offer))
		.then(() => connB.setRemoteDescription(connA.localDescription))
		.then(() => connB.createAnswer())
		.then(answer => connB.setLocalDescription(answer))
		.then(() => connA.setRemoteDescription(connB.localDescription));
}
