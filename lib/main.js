/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Random Walk - a browser add-on that takes a random walk through the web.
 * Copyright (c) 2015 Demon Fiddler. All Rights Reserved.
 * @author Demon Fiddler <demonfiddler@virginmedia.com>
 */

console.info("main.js");

const _ = require("sdk/l10n").get;
const self = require("sdk/self");
const tabs = require("sdk/tabs");
const simplePrefs = require("sdk/simple-prefs");
const { XMLHttpRequest } = require("sdk/net/xhr");
const { ActionButton } = require("sdk/ui/button/action");
const { ToggleButton } = require("sdk/ui/button/toggle");
const { setTimeout, clearTimeout } = require("sdk/timers");

const prefs = simplePrefs.prefs;
const PrefKeys = {
	RESUME_SESSION: "resume_session",
	AUTO_CLICK: "auto_click",
	INTERVAL_MIN: "interval_min",
	INTERVAL_MAX: "interval_max",
	START_URL: "start_url",
	USE_CURRENT: "use_current",
	LINK_POLICY: "link_policy",
	BLACKLIST: "blacklist",
	HISTORY_LENGTH: "history_length",
	SAME_HOST_LENGTH_LIMIT: "same_host_length_limit",
	SAME_DOMAIN_LENGTH_LIMIT: "same_domain_length_limit",
	PAGE_LOAD_TIMEOUT: "page_load_timeout",
	LOG_LEVEL: "log_level",
	LOCALE: "locale",
	SEARCH_URL: "search_url",
	SEARCH_TERM: "search_term_",
	SEARCH_TERM_0: "search_term_0",
	SEARCH_TERM_1: "search_term_1",
	SEARCH_TERM_2: "search_term_2",
	SEARCH_TERM_3: "search_term_3",
	DEFAULTS: "defaults",
	LICENCE_ACCEPTED: "licenceAccepted"
};
const PrefValues = {
	ANY_SITE: "any",
	PREFER_OTHER_HOST: "preferOtherHost",
	PREFER_OTHER_DOMAIN: "preferOtherDomain",
	REQUIRE_OTHER_HOST: "requireOtherHost",
	REQUIRE_OTHER_DOMAIN: "requireOtherDomain",
	INTERVAL_MIN_DEFAULT: 2,
	INTERVAL_MAX_DEFAULT: 10
};
const SessionState = {
	INITIALIZING: "initializing",
	RUNNING: "running",
	RUNNING_LOAD_TIMEOUT: "running_loadTimeout",
	STOPPED: "stopped"
};
const DocumentState = {
	LOADING: "loading",
	INTERACTIVE: "interactive",
	COMPLETE: "complete"
};

var session = {
	blacklist: [],
	button: null,
	tab: null,
	worker: null,
	delayTimeoutID: null,
	loadTimeoutID: null,
	history: [],
	curHistoryIdx: -1,
	sameHostLinkCount: 0,
	sameDomainLinkCount: 0,
	state: SessionState.INITIALIZING
};

// According to https://tools.ietf.org/html/rfc3986#page-50, a URL can be parsed by this regular expression:
// scheme    = $2
// authority = $4
// path      = $5
// query     = $7
// fragment  = $9
const regexUri = /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
//                 12            3    4          5       6  7        8 9

// For parsing locale specifications into {language, country}
const regexLocale = /^([a-z]{2})(?:[\-_]([A-Z]{2}))?$/;
//                    1                 2

function Link(url) {
	var p = regexUri.exec(url);
	if (p) {
		this.url = p[1];
		if (p[3])
			this.url += p[3];
		if (p[5])
			this.url += p[5];
		this.urlNoQuery = this.url;
		if (p[6])
			this.url += p[6];
		// (ignore the fragment p[8], as this is consumed by the user agent and not passed in the request URL)

		this.protocol = p[2];
		if (p[4]) {
			// TODO: improve this algorithm for extracting the domain name.
			this.host = p[4];
			var segs = this.host.split(".");
			var i = segs.length - 1;
			if (segs[i].length == 2)
				i--;
			this.domain = segs.slice(--i).join(".");
		}
	}
}
Link.prototype = {
	get isNew() {
		return this.linkCount === undefined;
	},
	isSearch: false,
	reset: function() {
		this.linkCount = this.otherHostCount = this.otherDomainCount = 0;
	},
	toString: function() {
		return "Link[links: " + this.linkCount + ", o-hosts: " + this.otherHostCount + ", o-domains: " + this.otherDomainCount + ", url: " + this.url + "]";
	}
};

function readBlacklist() {
	// Convert each line into a regular expression.
	session.blacklist.length = 0;
	var domains = prefs[PrefKeys.BLACKLIST].split(/,\s*/);
	for (let i = 0; i < domains.length; i++) {
		try {
			session.blacklist.push(new RegExp(domains[i].replace(/\./g, "\\.").replace(/\*/g, ".*")));
		} catch (e) {
			console.error("blacklist entry at index " + i + " contains an invalid character: " + domains[i]);
		}
	}
}

function readSearchSpec() {
	try {
		session.searchTerms = [];
		for (let i = 0; i < 4; i++) {
			var searchTerm = prefs[PrefKeys.SEARCH_TERM + i];
			if (searchTerm !== "")
				session.searchTerms.push(new RegExp(searchTerm, "i"));
		}
	} catch (e) {
		// TODO: figure out how to reset a preference to its default value.
		console.error(e);
	}
}

function readLocaleSpec() {
	var locale = regexLocale.exec(prefs[PrefKeys.LOCALE]);
	if (locale) {
		session.language = locale[1];
		session.country = locale[2];
	}
}

simplePrefs.on("", onPrefChange);

function onPrefChange(prefName) {
	var value = prefs[prefName];

	console.info("onPrefChange: " + prefName + " = " + value);

	switch (prefName) {
		case PrefKeys.AUTO_CLICK:
			session.button.destroy();
			if (value)
				createToggleButton();
			else
				createActionButton();
			break;
		case PrefKeys.INTERVAL_MIN:
			// INTERVAL_MIN must be positive and less than INTERVAL_MAX
			if (value < 0)
				prefs[prefName] = PrefValues.INTERVAL_MIN_DEFAULT;
			else if (value > prefs[PrefKeys.INTERVAL_MAX])
				prefs[prefName] = prefs[PrefKeys.INTERVAL_MAX];
			break;
		case PrefKeys.INTERVAL_MAX:
			// INTERVAL_MIN must be positive and greater than INTERVAL_MIN
			if (value < 0)
				prefs[prefName] = PrefValues.INTERVAL_MAX_DEFAULT;
			else if (value < prefs[PrefKeys.INTERVAL_MIN])
				prefs[prefName] = prefs[PrefKeys.INTERVAL_MIN];
			break;
		case PrefKeys.BLACKLIST:
			readBlacklist();
			break;
		case PrefKeys.LOCALE:
			readLocaleSpec();
			break;
		case PrefKeys.SEARCH_TERM_0:
		case PrefKeys.SEARCH_TERM_1:
		case PrefKeys.SEARCH_TERM_2:
		case PrefKeys.SEARCH_TERM_3:
			readSearchSpec();
			break;
		case PrefKeys.DEFAULTS:
			restorePreferenceDefaults();
			break;
	}
}

simplePrefs.on(PrefKeys.DEFAULTS, restorePreferenceDefaults);

function restorePreferenceDefaults() {
	var prefSvc = require("sdk/preferences/service");
	var keys = prefSvc.keys("extensions." + self.id);
	for (let i = 0; i < keys.length; i++)
		prefSvc.reset(keys[i]);
}

readBlacklist();
readSearchSpec();
readLocaleSpec();

if (prefs[PrefKeys.LICENCE_ACCEPTED]) {
	init();
} else {
	var worker = tabs.activeTab.attach({
		contentScriptFile: self.data.url("content-script.js"),
		contentScriptOptions: {
			aoAlert: "Debug Break",
			aoConfirm: {
				msg: _("confirm_licence_acceptance_msg"),
				key: PrefKeys.LICENCE_ACCEPTED
			}
		},
		onMessage: function(msg) {
			if (msg === PrefKeys.LICENCE_ACCEPTED) {
				prefs[PrefKeys.LICENCE_ACCEPTED] = true;
				worker.destroy();
				init();
			}
		}
	});
}

function init() {
	// Create a toggle button or a push button to trigger walk functionality.
	if (prefs[PrefKeys.AUTO_CLICK]) {
		createToggleButton();
	}
	else {
		createActionButton();
	}

	// If configured, resume the session.
	if (prefs[PrefKeys.RESUME_SESSION]) {
		var link = new Link(prefs[PrefKeys.START_URL]);
		if (!acceptLink(link) || !acceptContent(link))
			link = randomSearch();
		addToHistory(link);
		session.state = SessionState.RUNNING;
		tabs.open({
			url: link.url,
			inBackground: false
		});
		tabs[tabs.length - 1].on("activate", onTabActivate);
	}
}

function createToggleButton() {
	console.info("createToggleButton");

	session.button = ToggleButton({
		id: "rwalk",
		label: "Random Walk",
		icon: {
			"16": "./icon-16.png",
			"32": "./icon-32.png",
			"64": "./icon-64.png",
			"128": "./icon-128.png"
		},
		onChange: function(buttonState) {
			console.info("button " + (buttonState.checked ? "down" : "up"));
			if (buttonState.checked)
				startWalking();
			else
				stopWalking();
		}
	});
}

function createActionButton() {
	console.info("createActionButton");

	session.button = ActionButton({
		id: "rwalk",
		label: "Random Walk",
		icon: {
			"16": "./icon-16.png",
			"32": "./icon-32.png",
			"64": "./icon-64.png",
			"128": "./icon-128.png"
		},
		onClick: function(buttonState) {
			console.info("button clicked");
			if (session.tab.readyState == DocumentState.INTERACTIVE || session.tab.readyState == DocumentState.COMPLETE) {
				session.button.disabled = true;
				attachContentScript();
			}
		}
	});
}

function onTabActivate(tab) {
	if (session.tab === null) {
		console.info("onTabActivate: " + tab.title);
		if (prefs[PrefKeys.AUTO_CLICK]) {
			startWalking();
		} else {
			session.tab = tab;
			session.tab.on("load", onTabLoad);
			session.tab.on("close", onTabClose);
		}
	}
}

function onTabLoad(tab) {
	// TODO: Figure out how this works in non-auto-click mode.
	console.info("onTabLoad, state: " + session.state);

	clearLoadTimeout();
	detachContentScript();

	if (session.state == SessionState.RUNNING_LOAD_TIMEOUT) {
		session.state = SessionState.STOPPED;
	} else {
		switch (session.tab.readyState) {
			case DocumentState.LOADING:
				session.state = SessionState.RUNNING;
				// Fall through
			case DocumentState.INTERACTIVE:
			case DocumentState.COMPLETE:
				// Although the docs state that the content script is automatically reattached upon navigation,
				// that doesn't seem to occur with programmatic navigation, so we're forced to reinitialize the
				// content script on every load.
				if (prefs[PrefKeys.AUTO_CLICK])
					attachContentScript();
				else
					session.button.disabled = false;
				break;
		}
	}
}

function onTabClose(tab) {
	if (tab == session.tab) {
		console.info("onTabClose: " + tab.title);
		stopWalking();
		session.tab = null;
		session.history.length = 0;
		session.curHistoryIdx = -1;
	}
}

function onContentScriptInitializedMsg() {
	console.info("onContentScriptInitializedMsg");
	if (prefs[PrefKeys.AUTO_CLICK])
	    scheduleIdleTimeout();
    else
        onIdleTimeout();
}

function attachContentScript() {
	if (session.worker === null) {
		console.info("attachContentScript");

		if (session.tab === null)
			session.tab = tabs.activeTab;
		session.worker = session.tab.attach({
			contentScriptFile: self.data.url("content-script.js")
		});
		session.worker.port.on("csInitialized", onContentScriptInitializedMsg);
		session.worker.port.on("csLinks", onContentScriptLinksMsg);
		session.worker.port.on("csLostFocus", onContentScriptLostFocusMsg);
	}
}

function detachContentScript() {
	if (session.worker !== null) {
		console.info("detachContentScript");

		session.worker.destroy();
		session.worker = null;
	}
}

function startWalking() {
	console.info("startWalking");

	session.button.checked = true;
	var useActiveTab;
	try {
		// When a tab has been closed its readyState property throws a TypeError.
		useActiveTab = !session.tab || !session.tab.readyState;
	} catch (e) {
		useActiveTab = true;
	}
	if (useActiveTab) {
		session.tab = tabs.activeTab;
		session.tab.on("load", onTabLoad);
		session.tab.on("close", onTabClose);
	}
	if (session.tab && (session.tab.readyState == DocumentState.INTERACTIVE || session.tab.readyState == DocumentState.COMPLETE)) {
		// Trick onTabLoad() into thinking it's receiving a page load notification.
		session.state = SessionState.RUNNING;
		onTabLoad(session.tab);
	}
	// FIXME: handle the case when startWalking() is called before page load is complete.
}

function stopWalking() {
	console.info("stopWalking");

	clearLoadTimeout();
	clearDelayTimeout();
	if (session.state !== SessionState.RUNNING_LOAD_TIMEOUT) {
		// We're left with no option but to assume that at some point the page will finish loading,
		// at which point onTabLoad() will attempt to backtrack or issue a 'no links found' alert.
		detachContentScript();
		session.state = SessionState.STOPPED;
	}
	if (session.button.checked)
		// session.button.click();
		session.button.checked = false;
}

function scheduleIdleTimeout() {
	var delay = getInterval();
	console.info("scheduleIdleTimeout delay: " + delay + "ms");

	session.delayTimeoutID = setTimeout(onIdleTimeout, delay);
}

function getInterval() {
	return Math.floor((prefs[PrefKeys.INTERVAL_MIN] + (prefs[PrefKeys.INTERVAL_MAX] - prefs[PrefKeys.INTERVAL_MIN]) * Math.random()) * 1000);
}

function onIdleTimeout() {
	if (prefs[PrefKeys.AUTO_CLICK] && !session.button.checked)
		return;

	console.info("onIdleTimeout");

	try {
		session.worker.port.emit("aoRequestLinks")
	} catch (e) {
		// This line sometimes throw exception: "Couldn't find the worker to receive this message.
		// The script may not be initialized yet, or may already have been unloaded."
		// Odd, as onIdleTimeout is called in response to the 'contentScriptInitialized' message!
	}
}

function onContentScriptLinksMsg(urls) {
	console.info("onContentScriptLinksMsg (" + urls.length + " passed)");

	var link = selectRandomLink(urls);
	followLink(link);
}

function followLink(link) {
	if (link && link.url !== "") {
		console.info("follow link: " + link.url);

		session.state = SessionState.RUNNING/*_LOADING*/;
		if (prefs[PrefKeys.AUTO_CLICK])
			setLoadTimeout();
		session.tab.url = link.url;
	} else {
		console.warn("follow link: (none found)");

		// Note: the worker won't be valid if the page load timed out.
		switch (session.tab.readyState) {
			case DocumentState.INTERACTIVE:
			case DocumentState.COMPLETE:
				if (session.worker && session.worker.port)
					session.worker.port.emit("aoAlert", _("no_more_links_msg"));
		}
		stopWalking();
	}
}

function getLoadTimeout() {
	return prefs[PrefKeys.PAGE_LOAD_TIMEOUT] * 1000;
}

function setLoadTimeout() {
	var loadTimeout = getLoadTimeout();
	session.loadTimeoutID = loadTimeout > 0 ? setTimeout(onPageLoadTimeout, loadTimeout) : null;
}

function clearLoadTimeout() {
	if (session.loadTimeoutID) {
		clearTimeout(session.loadTimeoutID);
		session.loadTimeoutID = null;
	}
}

function clearDelayTimeout() {
	if (session.delayTimeoutID) {
		clearTimeout(session.delayTimeoutID)
		session.delayTimeoutID = null;
	}
}

function onPageLoadTimeout() {
	console.info("onPageLoadTimeout after " + getLoadTimeout() + " ms");

	// There's basically nothing we can do on load timeout, as the content script will not yet
	// have loaded, so we can't issue an alert.
	session.state = SessionState.RUNNING_LOAD_TIMEOUT;
	followLink(backtrack());
}

function onContentScriptLostFocusMsg() {
	// The content script has detected that the page has lost focus.
}

function currentLink() {
	return session.curHistoryIdx == -1
		? session.tab
			? new Link(session.tab.url)
			: null
		: session.history[session.curHistoryIdx];
}

function selectRandomLink(urls) {
	console.info("selectRandomLink");

	var curLink = currentLink();
	var forwards = curLink && curLink.isNew;
	if (forwards)
		curLink.reset();
	var links = [];
	var hostPartitionIdx = 0, domainPartitionIdx = 0;
	for (let i = 0; i < urls.length; i++) {
		// Ignore links with unsupported protocols, same-page links, already-visited pages, blacklisted sites.
		var link = new Link(urls[i]);
		if (acceptLink(link, curLink)) {
			var otherHost = link.host != curLink.host;
			var otherDomain = link.domain != curLink.domain;

			// If moving forwards, collect current link metrics.
			if (forwards) {
				curLink.linkCount++;
				if (otherDomain)
					curLink.otherDomainCount++
				else if (otherHost)
					curLink.otherHostCount++
			}

			switch (prefs[PrefKeys.LINK_POLICY]) {
				case PrefValues.REQUIRE_OTHER_DOMAIN:
					if (!otherDomain)
						continue;
					break;
				case PrefValues.REQUIRE_OTHER_HOST:
					if (!otherHost)
						continue;
					break;
				case PrefValues.PREFER_OTHER_DOMAIN:
					if (otherDomain) {
						links.splice(domainPartitionIdx++, 0, link);
						hostPartitionIdx++;
						continue;
					}
					break;
				case PrefValues.PREFER_OTHER_HOST:
					if (otherHost) {
						links.splice(hostPartitionIdx++, 0, link);
						continue;
					}
					break;
				case PrefValues.ANY_SITE:
					break;
			}
			links.push(link);
		}
	}

	console.info("  found " + urls.length + " links, " + links.length + " usable, "
		+ curLink.otherHostCount + " to other hosts, " + curLink.otherDomainCount + " to other domains");

	// Shuffle all links so iteration can make a random selection, but maintain partitions between same/other domain/host URLs.
	shuffle(links, 0, domainPartitionIdx);
	shuffle(links, domainPartitionIdx, hostPartitionIdx);
	shuffle(links, hostPartitionIdx, links.length);

	// Return the first link with an acceptable content type in the sorted, randomized list.
	for (var i = 0; i < links.length; i++) {
		var link = links[i];
		if (acceptContent(link)) {
			// Link accepted, so update current link and same-host/domain run length counters.
			if (curLink.linkCount > 0)
				curLink.linkCount--;
			if (link.host === curLink.host) {
				session.sameHostLinkCount++;
				session.sameDomainLinkCount++;
			} else {
				session.sameHostLinkCount = 0;
				if (curLink.otherHostCount > 0)
					curLink.otherHostCount--;
				if (link.domain === curLink.domain) {
					session.sameDomainLinkCount++;
				} else {
					session.sameDomainLinkCount = session.sameHostLinkCount = 0;
					if (curLink.otherDomainCount > 0)
						curLink.otherDomainCount--;
				}
			}

			// If we were back-tracking we are now moving forwards again,
			// so reset the history index to point to the last element of the array.
			// TODO: optimize future back-tracking by pushing back-track indices onto a stack?
			if (session.curHistoryIdx < session.history.length - 1)
				session.curHistoryIdx = session.history.length - 1;

			addToHistory(link);

			return link;
		}
	}

	// Can't move forwards, so if possible move backwards.
	return backtrack();
}

function acceptLink(link, curLink) {
	if (!link || !(link.protocol === "http" || link.protocol === "https" || link.protocol === "file")
		|| link.host === null || curLink && link.urlNoQuery === curLink.urlNoQuery) {

		return false;
	}

	// Don't revisit previous links.
	if (alreadyVisited(link))
		return false;

	// Don't visit blacklisted sites (other than the start or search URLs).
	if (session.curHistoryIdx > 0 || curLink && !curLink.isSearch) {
		for (let i = 0; i < session.blacklist.length; i++) {
			if (session.blacklist[i].test(link.host)) {
				console.info("  reject (blacklisted): " + link.host);
				return false;
			}
		}
	}

	// Don't exceed the maximum 'same-domain' or 'same-host' sequence lengths.
	if (!curLink) {
		// TODO: is this strictly necessary? Since we never clear the history this will only ever be executed on the first click,
		// in which case we might as well rely on their declarations to initialize them.
		session.sameDomainLinkCount = session.sameHostLinkCount = 0;
	} else if (link.domain == curLink.domain) {
		if (session.sameDomainLinkCount == prefs[PrefKeys.SAME_DOMAIN_LENGTH_LIMIT]) {
			// Don't reset sameDomainLinkCount here, because backtrack() will need to use it.
			console.info("  reject (domain sequence length " + session.sameDomainLinkCount + "): " + link.domain);
			return false;
		}

		if (link.host == curLink.host && session.sameHostLinkCount == prefs[PrefKeys.SAME_HOST_LENGTH_LIMIT]) {
			// Don't reset sameHostLinkCount here, because backtrack() will need to use it.
			console.info("  reject (host sequence length " + session.sameHostLinkCount + "): " + link.host);
			return false;
		}
	}

	return true;
}

function acceptContent(link) {
	// Make sure this link points to content that the browser can open.
	var contentLanguage = "";
	try {
		var http = new XMLHttpRequest();
		http.open("HEAD", link.url, false);
		var lang = prefs[PrefKeys.LOCALE].trim();
		if (lang !== "")
			http.setRequestHeader("Accept-Language", lang);
		http.send();
		switch (http.status) {
			case 200:
			case 204:
				var contentType = http.getResponseHeader("Content-Type");
				if (contentType !== null) {
					var sepIdx = contentType.indexOf(";");
					if (sepIdx != -1)
						contentType = contentType.substr(0, sepIdx);
					switch (contentType) {
						case "text/html":
						case "application/xhtml+xml":
							break;
						default:
							console.info("  reject (content type " + contentType + "): " + link.url);
							return false;
					}
				}

				contentLanguage = http.getResponseHeader("Content-Language");
				if (contentLanguage !== null) {
					var locale = regexLocale.exec(contentLanguage);
					if (locale && (locale[1] !== session.language
						|| session.country && locale[2] !== session.country)) {

						console.info("  reject (content language " + contentLanguage + "): " + link.url);
						return false;
					}
				}
				break;
			default:
				console.info("  reject (HTTP status " + http.status + "): " + link.url);
				return false;
		}
	} catch (e) {
		// Ignore unresolvable links.
		console.info("  reject (error " + e + "): " + link.url);
		return false;
	}

	console.info("  accept, Content-Language: " + contentLanguage + ", url: " + link.url);
	return true;
}

function alreadyVisited(link) {
	for (let i = session.history.length - 1; i >= 0; i--) {
		switch (prefs[PrefKeys.LINK_POLICY]) {
			case PrefValues.REQUIRE_OTHER_DOMAIN:
				if (session.history[i].domain === link.domain) {
					console.info("  reject (domain visited): " + link.domain);
					return true;
				}
				break;
			case PrefValues.REQUIRE_OTHER_HOST:
				if (session.history[i].host === link.host) {
					console.info("  reject (host visited): " + link.host);
					return true;
				}
				break;
			default:
				if (session.history[i].urlNoQuery === link.urlNoQuery) {
					console.info("  reject (page visited): " + link.urlNoQuery);
					return true;
				}
		}
	}
	return false;
}

/**
 * Shuffles a region of an array.
 * @param array The array to shuffle.
 * @param startIdx The start index of the region to shuffle (inclusive).
 * @param endIdx The end index of the region to shuffle (exclusive).
 */
function shuffle(array, startIdx, endIdx) {
	var temp, randIdx, curIdx = endIdx;
	while (curIdx !== startIdx) {
		randIdx = startIdx + Math.floor(Math.random() * (curIdx - startIdx));
		curIdx--;
		temp = array[curIdx];
		array[curIdx] = array[randIdx];
		array[randIdx] = temp;
	}
	return array;
}

function addToHistory(link) {
	// Record the selected link and if necessary trim history to maximum length.
	session.history.push(link);
	if (session.history.length > prefs[PrefKeys.HISTORY_LENGTH])
		session.history.shift();
	else
		session.curHistoryIdx++;
}

function backtrack() {
	var idx = session.curHistoryIdx;
	console.info("backtrack from history[" + idx + "]");
	if (session.sameDomainLinkCount == prefs[PrefKeys.SAME_DOMAIN_LENGTH_LIMIT]) {
		// We have reached the limit for same-domain link sequences, so backtrack to a page from a different domain.
		idx -= session.sameDomainLinkCount;
		session.sameDomainLinkCount = session.sameHostLinkCount = 0;
	} else if (session.sameHostLinkCount == prefs[PrefKeys.SAME_HOST_LENGTH_LIMIT]) {
		// We have reached the limit for same-host link sequences, so backtrack to a page from a different host.
		idx -= session.sameHostLinkCount;
		session.sameDomainLinkCount -= session.sameHostLinkCount;
		session.sameHostLinkCount = 0;
	} else {
		idx--;
	}

	// Depending on the SAME_[DOMAIN|HOST]_LENGTH_LIMIT preferences we could have backtracked to this point because we'd exceeded
	// the maximum count for successive same domain or same host links. So now work backwards until we find a link in the
	// history that offers a prospective escape route. Regardless of whether we'd hit this limit, we must still honour
	// the REQUIRE|PREFER_OTHER_DOMAIN|HOST navigation preferences.
	// - For REQUIRE_OTHER_DOMAIN we could not possibly have traversed more than one same-domain or same-host link
	//   - THUS we can accept the next available history link if it contains at least one unused other-domain link.
	// - For REQUIRE_OTHER_HOST we could not possibly have traversed more than one same-host link.
	//   - THUS we can accept the next available history link if it contains at least one unused other-domain link.
	// - For PREFER_OTHER_DOMAIN then we might have traversed < SAME_DOMAIN_LENGTH_LIMIT same-domain links.
	//   - HOWEVER, if the remaining history contains a link to a different domain, we should take it.
	//   - SO, iterate to see if there's an other-domain link but don't fret if there isn't.
	// - For PREFER_OTHER_HOST then we might have traversed < SAME_HOST_LENGTH_LIMIT same-domain links.
	//   - HOWEVER, if the remaining history contains a link to a different host, we should take it.
	//   - SO, iterate to see if there's an other-host link but don't fret if there isn't.
	while (idx >= 0) {
		var link = session.history[idx];
		console.info("  checking history[" + idx + "]: " + link);
		switch (prefs[PrefKeys.LINK_POLICY]) {
			case PrefValues.REQUIRE_OTHER_DOMAIN:
			case PrefValues.PREFER_OTHER_DOMAIN:
				// If this link can still fulfill the 'other domain' link requirement, we can just accept it...
				if (link.otherDomainCount > 0) {
					// but since we're using one of the remaining 'other domain' links, decrement the count.
					link.otherDomainCount--;
					break;
				}
				idx--;
				continue;
			case PrefValues.REQUIRE_OTHER_HOST:
			case PrefValues.PREFER_OTHER_HOST:
				// If this link can still fulfill the 'other host' link requirement, we can just accept it...
				if (link.otherHostCount > 0) {
					// but since we're using one of the remaining 'other host' links, decrement the count.
					link.otherHostCount--;
					break;
				}
				idx--;
				continue;
//			case PrefValues.PREFER_OTHER_DOMAIN:
//				// If this link can still fulfill the 'other domain' link preference, we can just accept it...
//				if (link.otherDomainCount > 0) {
//					// but since we're using one of the remaining 'other domain' links, decrement the count.
//					link.otherDomainCount--;
//					break;
//				}
//				// fall through...
//			case PrefValues.PREFER_OTHER_HOST:
//				// If this link can still fulfill the 'other host' link preference, we can just accept it...
//				if (link.otherHostCount > 0) {
//					// but since we're using one of the remaining 'other host' links, decrement the count.
//					link.otherHostCount--;
//					break;
//				}
//				// fall through...
			default:
				// If this link can still fulfill the 'any' link preference, we can just accept it...
				if (link.linkCount > 0) {
					// but since we're using one of the remaining 'any' links, decrement the count.
					link.linkCount--;
					break;
				}
				idx--;
				continue;
		}

		console.info("  backtrack to history[" + idx + "]");
		session.curHistoryIdx = idx;
		return link;
	}

	// Can't backtrack to any of the previous pages, so initiate a new random search.
	console.warn("  (nowhere left to go)");
	return randomSearch();
}

function randomSearch() {
	console.info("randomSearch");
	var words = findRandomWords();
	var searchUrl = prefs[PrefKeys.SEARCH_URL].replace("{0}", words.join("+"));
	console.warn("  search URL: " + searchUrl);
	var link = new Link(searchUrl);
	link.isSearch = true;
	return link;
}

function findRandomWords() {
	var content = self.data.load("cg.al.o5");
	var entries = content.split(/(?:\r|\n)+/);
	var words = new Array(session.searchTerms.length);
	for (let i = 0; i < session.searchTerms.length; i++)
		words[i] = findRandomWord(entries, session.searchTerms[i]);
	return words;
}

function findRandomWord(entries, posRegex) {
	// Starting at a random index, examine successive entries until we find one that matches the supplied part-of-speech regular expression.
	var index = Math.floor(Math.random() * entries.length);
	while (true) {
		// Format is <frequency> <word> <pos-code> <doc-count>
		var entry = /^(?:\d+) (\w+) ([a-z0-9\-]+) (?:\d+)$/.exec(entries[index]);
		if (entry && posRegex.test(entry[2]))
			return entry[1];
		// Keep searching until we find an entry that matches the regular expression, looping back to start on overflow.
		if (++index == entries.length)
			index = 0;
	}
}
