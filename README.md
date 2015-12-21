# random-walk
An add-on to take your browser on an automated random walk through the World Wide Web. Download/install from https://addons.mozilla.org/en-US/firefox/addon/random-walk/.

## Supported Browsers
Firefox 38 and later.

## Applications

### Internet Privacy
Personal privacy is still highly prized by most people but increasingly threatened by invasive technological developments and legislation. Internet search providers, social media, e-commerce and many commonly used websites gather vast amounts of data on their users' interests, postings, search terms and browsing history. It is now common knowledge that government surveillance has reached Orwellian levels far beyond reasonable consent. In the United Kingdom telcos and ISPs are required to log all telephone call, SMS details and Internet protocol headers. On the World Wide Web there are some countermeasures one can deploy to reduce the level of information leakage, such as 'do not track' request headers, cookie and referer controls, the use of private/incognito browsing sessions, VPNs, proxy servers or the TOR network, but even these may not entirely eliminate leakage.  One additional countermeasure is to deliberately degrade the informational 'signal-to-noise' ratio in the activity logs kept by your ISP, by executing random searches and randomly clicking links. The random-walk add-on automates this approach.

### 'Lucky-dip' Browsing
Let the random-walk add-on take you to offbeat websites you'd never heard of. Let it introduce you to new topics and possibilities. Such undirected intellectual stimulation can lead to serendipitous discoveries and inspiration. Web search engines use adaptive filtering that limits search results to topics that they _believe_ are of interest to you. This bias can help focus results but can also conceal broader possibilities - the random-walk add-on can potentially mitigate the search narrowing effect by executing random searches.

### Testing Other Add-Ons
The random-walk add-on can also be useful when testing or developing other add-ons.

## Operation
### Modes
The random-walk add-on has manual and automatic modes of operation. In manual mode clicking a toolbar push-button randomly chooses one of the links on the current page and navigates to it. In automatic mode the toolbar features a toggle-button instead; while the toggle-button is in the pressed state the add-on randomly chooses a link as in manual mode, but once the page has loaded the add-on waits for a random time interval before again choosing a random link on the new page. The process repeats until the toggle-button is manually returned to the unpressed state or the add-on's tab is closed. The add-on only navigates links to HTML content, avoiding links to downloadable or executable content. You can specify a preferred language and the add-on will do its best to ensure that you only receive content in that language.

There is an auto-resume preference which on browser startup starts a random walk session in a dedicated tab. In auto-click mode there is an additional preference to start the random walk immediately. There is a preference to specify the URL of the starting page; if left blank the session will start with a random web search instead.

### Link Policy
The algorithm for choosing random links is configurable, for example to require or prefer links to pages from other hosts or other domains. There are also configurable limits to the maximum number of successive pages from the same host and the same domain. The time interval between random clicks is configurable. While the session is active the add-on maintains a history of pages visited, which it uses to backtrack out of dead ends such as websites or domains that link only to themselves. There is also a configurable page load timeout; in auto-click mode if the page is still loading after this interval has elapsed the add-on aborts the load and backtracks to a suitable previous page in the history. Such load timeouts are often observed on large pages laden with advertisements. There is a configurable 'wildcard blacklist' of websites that the add-on will never visit - the default blacklist includes vast 'black-hole' social media sites from which there is a low possibility of escape (such as Facebook and Twitter) or sites that predominantly feature non-HTML media types such as video on YouTube.

### Back-tracking & Random Search
If these navigation constraints cause the add-on to backtrack to the start page and there fail to find any remaining navigable links, this triggers a search using a random set of search terms. The add-on randonmly chooses one of the search results to follow. The search provider is user-configurable as are the parts of speech used as search terms. Supported search providers are Google, Yahoo, Bing, DuckDuckGo and StartPage. Searches may specify between one and four search terms, each of which can be independently configured as adverb, verb, adjective, noun or random. Words of the specified types are chosen randomly from a built-in word list.

##Preferences
The add-on preferences are available under Open Menu > Addons > Extensions > Random Walk > Options. The add-on is highly configurable, so don't be afraid to experiment - if you break something it's easy to restore the defaults.

|Label|Type|Default|Description|
|-----|----|-------|-----------|
|Resume session|boolean|true|Resume random walk session on browser restart|
|Auto-click|boolean|true|Automatically click random links at given intervals|
|Start page|URL|http://www.bbc.co.uk/news/|The starting page for a new random walk session (leave blank to start with a random search)|
|Search Provider|choice|Google|The search page from which to start a new random walk session (Google/Yahoo/Bing/DuckDuckGo/StartPage)|
|First search term|choice|adverb|The first random search term (adverb/verb/adjective/noun/random/none)|
|Second search term|choice|verb|The second random search term (ditto)|
|Third search term|choice|adjective|The third random search term (ditto)|
|Fourth search term|choice|noun|The fourth random search term (ditto)|
|Minimum auto-click interval|integer|4|The minimum interval in seconds between auto-clicks|
|Maximum auto-click interval|integer|10|The maximum interval in seconds between auto-clicks. For a fixed interval set this to the same value as Minimum interval.|
|Link selection policy|choice|prefer other domain|How to select which links to follow (any/prefer other host/prefer other domain/require other host/require other domain)|
|Website blacklist|string|, \*adobe\*, \*facebook\*, \*google\*, \*microsoft\*, \*linkedin\*, \*paypal\*, \*pinterest\*, \*reddit\*, \*twitter\*, \*youtube\*, \*e-bay\*, \*wordpress\*|Never follow links to sites in these domains (comma-separated, \* wildcard)|
|History length|integer|100|The number of visited web page addresses to remember and avoid|
|Maximum same-host sequence length|integer|2|Backtrack out of a same-host link sequence if it reaches this length|
|Maximum same-domain sequence length|integer|4|Backtrack out of a same-domain link sequence if it reaches this length|
|Maximum page load time|integer|10|Backtrack after waiting this many seconds for an auto-clicked page to finish loading (set to -1 to disable page load timeouts)|
|Logging level|choice|info|The levels at which to emit logging messages (off/error/warn/info/debug/all)|
|Locale|string|en|A comma-separated list of lc[-CC] language/locale codes (see FAQ)|
|Restore defaults|button|-|Restores all preferences to their original values|

##Frequently Asked Questions
1. How do I prevent random walks getting trapped in the same site or domain?
  * Some web pages have few or no links to external sites or domains.
  * The 'Maximum same-host sequence length' (default 2) and 'Maximum same-domain sequence length' (default 4) preferences are intended to facilitate escape from such 'black hole' sites - maybe try reducing these settings.
  * Try changing the 'Link selection policy' preference to 'require other host' or 'require other domain', but be aware that this is likely to increase back-tracking and trigger more random searches, as navigation possibilities will be exhausted more readily.
  * Alternatively, if this happens repeatedly with the same site you can exclude it permanently by adding the host or domain to the 'Website blacklist' preference (wildcards accepted).
2. Can I prevent the random walk session triggering a download?
  * This is rare and occurs only where the server supplies an incorrect HTTP Content-Type response header. Unfortunately there's no way for the add-on to detect or prevent such incorrect metadata. The add-on only navigates http:, https: and file: links which *claim* they return text/http content. Just manually abort the download.
3. Can I prevent the random walk session displaying an alert or other dialog?
  * This is caused by the web page and the add-on is not currently able to detect or react to such occurrences. Dismiss the dialog manually.
4. The add-on often aborts a page load and back-tracks to a previous page - why is this?
  * In auto-click mode the add-on gives up if a page takes too long to load. The 'Maximum page load time' preference (default 10 seconds) determines the timeout. If your computer or network connection are slow, you may wish to increase this preference.
5. Can I use a custom search provider for random searches?
  * The add-on supports only Google, Yahoo, Bing, DuckDuckGo and StartPage; there is not currently any means to specify any other provider.
6. What is the 'Logging level' preference for?
  * You can use logging to monitor the progress of a random walk session. The add-on emits logging messages during operation, which can be viewed by opening the Browser Console (Ctrl+Shift+J).
7. What is the 'Locale(s)' preference for?
  * This preference allows you to specify your preferred language for the randomly selected web pages. The HTTP protocol (RFC 2616) used by the World Wide Web allows a user agent (e.g., a web browser) to supply an Accept-Language 'request header'.  The value is a comma-separated list of locale codes. A locale code consists of a two-character lowercase ISO 639-1 language code, *optionally* followed by a hyphen then a two-character uppercase ISO 3166 country code. In general the language component should suffice, as restricting pages to a specific language *and* country is likely to result in lots of link rejection and consequent back-tracking.
8. I've set my preferred Locale but I still occasionally get pages in other languages - why?
  * Not all web servers pay attention to the Accept-Language HTTP request header nor do they necessarily supply accurate locale information in the Content-Language response header, so it is not possible for the add-on to guarantee that the random links it clicks will yield pages in your preferred language(s).
9. Some pages have background sound tracks or auto-running videos - can I turn these off?
  * These background media are built into the web page and at present the add-on has no means to suppress such content.
10. Is there anything I should be wary of when using this add-on?
  * The add-on clicks random links, the subject matter of which it has no prior knowledge. It is not practicable for the add-on to attempt any content subject analysis or keyword filtering, so you could quite literally encounter anything the World Wide Web has to offer.
  * In auto-click mode the add-on will continue clicking and loading indefinitely. If your Internet account has a download quota you'll need to keep an eye on your bandwidth utilisation to avoid incurring additional usage charges.
  * Some websites have built-in denial-of-service safeguards to prevent them from being overloaded by automated requests. If you set 'Maximum same-host|domain sequence length' preferences too high and the 'Minimum|Maximum interval' interval too low you might trigger these safeguards and inadvertently lock yourself out for a period of time. In practice this is not likely to be a problem since the websites visited are chosen randomly.

##Licence
This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, you can obtain one at http://mozilla.org/MPL/2.0/.

##Copyright
Copyright (c) 2015 Demon Fiddler. All Rights Reserved.