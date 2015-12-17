(function() {
	self.port.on("aoAlert", onAlert);
	self.port.on("aoConfirm", onConfirm);
	self.port.on("aoPrompt", onPrompt);
	self.port.on("aoRequestLinks", onRequestLinks);

	// Process content script options if supplied.
	if (self.options) {
		// If requested, display an alert popup.
		self.options.aoAlert && onAlert(self.options.aoAlert);

		// If requested, display a confirmation popup.
		self.options.aoConfirm && onConfirm(self.options.aoConfirm);

		// If requested, display a prompt popup.
		self.options.aoPrompt && onConfirm(self.options.aoPrompt);
	}

	window.addEventListener("blur", onWindowBlur);

	// Notify the main add-on that the content script is initialized.
	self.port.emit("csInitialized");

	function onAlert(msg) {
		alert(msg);
	}

	function onConfirm(data) {
		if (confirm(data.msg))
			self.port.emit(data.key);
	}

	function onPrompt(data) {
		var result = prompt(data.msg, data.value);
		if (result !== null)
			self.port.emit(data.key, result);
	}

	function onRequestLinks() {
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

	function onWindowBlur(e) {
		//	console.debug("content-script: onWindowBlur");
		if (window.self != window.top && window.self.opener == window.top)
			self.port.emit("csLostFocus");
	}
})();
