var MusicPlayer = require('./classes/musicplayer.js');
var WebSocket   = require('./classes/websocket.js');
var GlobalConf  = require('./config.js');
var LastfmAPI   = require('lastfmapi');
var httpreq     = require('httpreq');

var crypto = require('crypto');
var fs     = require('fs');

//
// syncing system
//
var missing = [];
var done = 0;

function commit() {
    done += 1;
    
    if(done == missing.length) {
        console.log("[+] sync process done, existing.");
        process.exit(0);
    }
}

function hit(artist, album) {
    if(!player.library[artist][album]['artworks'])
        missing.push({'artist': artist, 'album': album});
}

function save(root) {
    if(root.covers['thumbnail'] && root.covers['fullsize']) {
        var content = {
            $artist: root.artist,
            $album: root.album,
            $release: 0,
            $thumb: root.covers['thumbnail']['hash'] + '.jpg',
            $fullsize: root.covers['fullsize']['hash'] + '.jpg',
        };
        
        console.log("[+] sync: commit into database");
        var query = "INSERT INTO artwork (artist, album, release, thumb, fullsize) " +
                    "VALUES ($artist, $album, $release, $thumb, $fullsize)";
		
		player.artwork.run(query, content, function (err) {
            if(err) throw(err);
            commit();
        });
    }
}

function downloaded(root, type, data) {
    var hash = crypto.createHash('md5').update(data).digest("hex");
    var filename = '../covers/cache/' + hash + ".jpg";
    
    root.covers[type] = {'hash': hash, 'data': data};
    
    fs.writeFile(filename, data, function (err) {
        if(err) throw(err);
        
        console.log("[+] sync: " + filename + " written");
        save(root);
    });
    
}

function processing(root) {
    var artist = root.artist;
    var album = root.album;
    
    if(!root.images['thumbnail'] || !root.images['fullsize']) {
        console.log("[-] " + artist + " - " + album + ": thumbnail or fullsize not found");
        console.log("[-] " + artist + " - " + album + ": " + root.url);
        
        commit();
        return;
    }
    
    console.log("[+] sync: " + artist + " - " + album);
    root.covers = {}
    
    httpreq.get(root.images['thumbnail'], {binary: true}, function (err, res) {
        if (err) return console.log(err);
        downloaded(root, 'thumbnail', res.body);
    });

    httpreq.get(root.images['fullsize'], {binary: true}, function (err, res) {
        if (err) return console.log(err);
        downloaded(root, 'fullsize', res.body);
    });
}

function infos(error, album) {
    if (error) { throw error; }
    
    this.images = {}
    this.url = album['url']
    
    // thumbnail
    var sizes = ['medium', 'large', 'extralarge'];
    for(var id in sizes) {
        size = sizes[id];
        
        for(var idx in album['image']) {
            var item = album['image'][idx];
            
            if(item['#text'] == '')
                continue;
            
            if(item['size'] == size)
                this.images['thumbnail'] = item['#text'];
        }
    }
    
    // fullsize
    for(var idx in album['image']) {
        var item = album['image'][idx];
        
        if(item['#text'] == '')
            continue;
        
        if(item['size'] == 'mega')
            this.images['fullsize'] = item['#text'];
    }
    
    processing(this);
}

// function search(artist, album) {
function search(artist, album) {
    object = {}
    object.artist = artist;
    object.album = album;
    object.images = {};
    
    lfm.album.getInfo({
        'artist': artist,
        'album': album,
        
    }, infos.bind(object));
}

function syncing() {
    console.log("[+] covers: player ready, syncing...");
    
    for(var artist in player.library)
        for(var album in player.library[artist])
            hit(artist, album);
    
    if(missing.length == 0) {
        console.log("[+] sync: database is consistant, nothing missing, exiting");
        process.exit(0);
    }

    console.log("[+] sync: missing artworks:");
    console.log(missing);
    
    var limit = 10;
    
    for(var id in missing) {
        search(missing[id]['artist'], missing[id]['album']);
        
        if(id > limit)
            break;
    }
}


//
// working process
//
var lfm = new LastfmAPI({
	'api_key' : GlobalConf['lastfm-key'],
	'secret' : GlobalConf['lastfm-secret']
});

var player = new MusicPlayer(GlobalConf, false);
player.on('load-completed', syncing);
