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
var block = 10;
var working = [];

function commit(root) {
    done += 1;
    
    console.log("[+] block: remain: " + working.length + ", done: " + done + "/" + missing.length);
    
    if(done == missing.length) {
        console.log("[+] sync process done, existing.");
        process.exit(0);
    }
    
    working.splice(root.miss, 1);
    
    if(working.length == 0) {
        console.log("[+] blockchain done, running next chain");
        blockchain();
    }
}

function save(root) {
    // avoid double save with concurrency
    if(root.saved)
        return;

    if(root.covers['thumbnail'] && root.covers['fullsize']) {
        root.saved = true;
        
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

            root.miss['status'] = 'done';
            commit(root);
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
        
        root.miss['status'] = 'failed';
        commit(root);

        return;
    }
    
    console.log("[+] sync: downloading: " + artist + " - " + album);
    root.covers = {}
    root.saved = false;
    
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
    if(error) {
        console.log('[-] lastfm error: ' + this.artist + ' - ' + this.album + ': ' + error['message']);
        this.miss['status'] = 'error';
        return commit(this);
    }
    
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

function hit(artist, album) {
    if(!player.library[artist][album]['artworks'])
        missing.push({
            'artist': artist,
            'album': album,
            'status': 'pending',
        });
}

function search(miss) {
    object = {}
    object.miss = miss;
    object.artist = miss['artist'];
    object.album = miss['album'];
    object.images = {};
    
    lfm.album.getInfo({
        'artist': object.artist,
        'album': object.album,
        
    }, infos.bind(object));
}

function blockchain() {
    var z = 0;
    
    for(var i = 0; i < missing.length; i++) {
        if(missing[i]['status'] != 'pending')
            continue;
            
        missing[i]['status'] = 'processing';
        
        working.push(missing[i]);
        search(missing[i]);
        
        // limit for this block
        if(z++ > block)
            break;
    }
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
    
    blockchain();
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
