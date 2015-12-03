self.port.on("requestLinks", requestLinks);
self.port.on("nolinks", nolinks);

window.addEventListener("blur", onWindowBlur);

function onWindowBlur(e) {
//	console.debug("content-script: onWindowBlur");
	if (window.self != window.top && window.self.opener == window.top)
		self.port.emit("csLostFocus");
}

function requestLinks() {
//	console.debug("content-script: requestLinks");

	var urls = [];
	var links = document.getElementsByTagName("a");
	for (let i = 0; i < links.length; i++) {
		var href = links[i].href;
		if (href != "")
			urls.push(href);
	}

	self.port.emit("csLinks", urls);
}

function nolinks() {
	alert("Unable to find any unvisited links.\nPlease navigate to a new start page and restart.");
}

self.port.emit("csInitialized");
