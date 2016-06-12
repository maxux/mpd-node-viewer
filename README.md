# mpd-node-viewer
Nodejs server and web based viewer for mpd with fullscreen cover support (using CSS3)
 
# Examples
* Some screenshot are available here: https://imgur.com/a/KY02y
 
# How does it works ?
There is a nodejs server that loads the whole mpd library on memory and the artworks database (see below)
and then waits websocket clients to share the mpd status.
Note: this is a proof-of-concept, it's an early beta version not designed to be used out-of-box !  
 
# Basic start
* Build an empty database: `cat database/artworks.sql | sqlite3 databases/artworks.sqlite3`
* Configure the daemon: `vim server/config.js`
* Run the nodejs server: `cd server && node server.js`
* Access to https://localhost:9910

Note: you need ssl and https for now (http will be enabled later).
 
# Artworks
To provide a decent way to give artworks, a local copy is made. This version use last.fm as source.
To grab the covers, you need an API Key (http://www.last.fm/api/account/create). Just configure your credentials
on the `config.js` file.

To start the clone process, do:
* `cd server && node covers-sync.js`
* Wait for: `[+] sync process done, existing.`

Note: first time, this process can take a long time, depends of your library size. You may restart the process
if too many http request are send (there is no limit for now). When done, restart the server to update the covers cache.

The fullscreen page use a blurred version as background. It's computed server side.

First version used `filter: blur` to provide the background but this method is damn too slow for
slow computers, to be more compatible, image are pre-computed server side and the client just need to
fade between them.

When you have synced your covers cache, run:
* `cd server && bash cache-blur.sh`

This will compute the blur version of each covers (this require imagemagick).
 
# Dependencies
* sqlite3
* mpd
* websocket
* express
* httpreq
* lastfmapi
* body-parser
 
`cd server && npm install sqlite3 mpd websocket express httpreq lastfmapi body-parser`
