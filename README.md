# random-walk
An add-on to take your browser on an automated random walk through the World Wide Web.

## Applications

### Random Browsing
Let the random-walk add-on take you to offbeat websites you'd never heard of. Encounter new topics and possibilities. Undirected intellectual stimulation can lead to serendipitous discoveries and inspiration. Web search engines use adaptive filtering that limits search results to topics that they _believe_ are of interest to you. This bias can be helpful but can also conceal broader possibilities. The random-walk add-on can potentially mitigate the search narrowing effect.

### Internet Privacy
Personal privacy is highly prized by most people but increasingly threatened by invasive technological developments and legislation. Internet search providers, social media, e-commerce and many commonly used websites gather vast amounts of data on their users' interests, postings, search terms and browsing history. It is now common knowledge that government surveillance has reached Orwellian levels far beyond reasonable consent. In the United Kingdom ISPs are required to log all Internet protocol headers, telephone call and SMS details. There are some countermeasures one can deploy to reduce the level of information leakage, such as 'do not track' request headers, cookie and referrer controls, the use of private/incognito browsing sessions, VPNs, proxy servers or the TOR network, but even these may not entirely eliminate leakage.  One additional countermeasure is to deliberately degrade the informational 'signal-to-noise' ratio in the activity logs kept by your ISP, by executing random searches and randomly clicking links. The random-walk add-on automates this approach.

## Operation
The random-walk add-on has manual and automatic modes of operation. In manual mode clicking a toolbar push-button randomly chooses one of the links on the current page and navigates to it. In automatic mode the toolbar features a toggle-button instead; while the toggle-button is in the pressed state the add-on randomly chooses a link as in manual mode, but once the page has loaded the add-on waits for a random time interval before again choosing a random link on the new page. The process repeats until the toggle-button is manually returned to the unpressed state. The add-on only navigates links to HTML content, avoiding links to downloadable or executable content.

There is an auto-resume preference which on browser startup starts a random walk session in a dedicated tab. In automatic mode there is an additional preference to start the random walk immediately. There is a preference to specify the URL of the starting page; if left blank the session will start with a random web search instead.

The algorithm for choosing random links is configurable, for example to require or prefer links to pages from other hosts or other domains. There are also configurable limits to the maximum number of successive pages from the same host and the same domain. The time interval between random clicks is configurable. While the session is active the add-on maintains a history of pages visited, which it uses to backtrack out of dead ends such as websites or domains that link only to themselves. There is also a configurable page load timeout; if the page is still loading after this interval has elapsed the add-on aborts the load and backtracks to a suitable previous page in the history. Such load timeouts are often observed on large pages laden with advertisements. There is a configurable 'wildcard blacklist' of websites that the add-on will never visit - the default blacklist includes vast 'black-hole' social media sites from which there is a low possibiliity of escape (such as Facebook and Twitter) or sites that predominantly feature non-HTML media types such as video on YouTube.

If these navigation constraints cause the add-on to backtrack to the start page and fail to find any remaining navigable links, this triggers a search using a random set of search terms. The add-on randonmly chooses one of the search results to follow. The search provider is user-configurable as are the parts of speech used as search terms. Supported search providers are Google, Yahoo, Bing, DuckDuckGo and StartPage. Searches may specify between one and four search terms, each of which can be independently configured as adverb, verb, adjective and noun. Words of the specified types are chosen randomly from a built-in word list.

##Preferences
|Label|Type|Default|Description|
|Resume session|boolean|true|Resume random walk session on brower restart|
|Auto-click|boolean|true|Automatically click random links at given intervals|
|Start page|URL|http://www.bbc.co.uk/news/|The starting page for a new random walk session|
|Search Provider|choice|Google|The search page from which to start a new random walk session (Google/Yahoo/Bing/DuckDuckGo/StartPage)|
|First search term|choice|adverb|The first random search term (none/random/adverb/verb/adjective/noun)|
|Second search term|choice|verb|The second random search term (ditto)|
|Third search term|choice|adjective|The third random search term (ditto)|
|Fourth search term|choice|noun|The fourth random search term (ditto)|
|Minimum interval|integer|4|The minimum interval in seconds between random clicks|
|Maximum interval|integer|10|The maximum interval in seconds between random clicks. For a fixed interval set this to the same value as Minimum interval.|
|Link selection policy|choice|prefer other domain|How to select which links to follow (any/prefer other host/prefer other domain/require other host/require other domain)|
|Website blacklist|string|*facebook*, *google*, *microsoft*, *linkedin*, *paypal*, *twitter*, *youtube*, *e-bay*, *wordpress*|Never follow links to sites in these domains (comma-separated, * wildcard)|
|History length|integer|100|The number of visited web page addresses to remember and avoid|
|Maximum same-host sequence length|integer|2|Backtrack out of same-host link sequence if it reaches this length|
|Maximum same-domain sequence length|integer|4|Backtrack out of same-domain link sequence if it reaches this length|
|Maximum page load time|integer|6|Backtrack from any page still loading after this many seconds|
|Logging level|choice|info|The levels at which to emit logging messages (off/error/warn/info/debug/all)|
|Language|string|en|Web page languages to accept (a comma-separated list of 2-character ISO language codes to set in HTTP Accept-Language request headers)|

##Frequently Asked Questions
1.