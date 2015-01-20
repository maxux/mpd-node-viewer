# mpd-node-viewer
nodejs server to view current playing song on mpd with fullscreen cover support (css3)
 
# Examples
* http://clea.maxux.net/maxux/music/node/http/
* http://clea.maxux.net/maxux/music/node/http/full.html (try it with Chrome, on fullscreen for a better experience)
 
# How does it works ?
There is a nodejs server that loads the whole mpd library on memory and the artworks database (see below)
on load and then waits websocket clients to share the mpd status.  
Note: this is a proof-of-concept, it's an early alpha version not designed to be used out-of-box !  
Note: There is no webserver included on the nodejs part, you must provide http files with a webserver
 
# How to use
* Build an empty database: `cat databases/artworks.sql | sqlite3 databases/artworks.sqlite3`
* Download covers:
 * Edit `php/classes/lastfm.class.php` and put your api key
 * Build the cover cache (move on php folder): `php cache.php`
 * Build the blur cache (require imagemagick): `sh cache-blur.sh`
* Launch the nodejs server: `node musicplayer.js`
* You must provide an access to `/http` with a webserver
 
(note: to change mpd server information (path, port), you need to edit: `musicplayer.js` and `php/cache.php`.
There is no password support right now)
 
# Why do I see php, bash and nodejs on the tree ?
I started the project with php for a smaller purpose but when I wanted to put realtime and websocket
on the road, nodejs was (of course) a better choice. I haven't migrated everything yet.
 
# Artworks
At first, I used discogs API to grab covers but I have better results with last.fm  
Discogs code is still on tree but it should be removed later.
 
A local copy of picture is made and saved on a sqlite database
 
# Why is the blur computed on server side ?
I used the css3 `filter: blur` at first to make this but it's too slow and laggy on clients.
By computing the blur on server side and saving the image, client just have a fade to do and it
works much better.
 
# Dependencies
* sqlite3
* mpd
* websocket
 
`npm install sqlite3 mpd websocket`

# Contributors and testers
* Céline Eppe
* Thomas Portal
