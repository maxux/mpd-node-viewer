var events  = require('events');
var util    = require('util');
var mpd     = require('mpd');
var sqlite3 = require('sqlite3').verbose();
var command = mpd.cmd;

var MusicPlayer = function(config, daemon) {
	var self = this;
	events.EventEmitter.call(this);
	
	self.artwork = new sqlite3.Database('../database/artworks.sqlite3');
	
	self.current = {
		title:  null,
		artist: null,
		album:  null,
		track:  null,
		time:   null,
		position: null,
		cover:  null,
		id:     null,
	};
	
	self.status = {
		volume:  null,
		elapsed: null,
		bitrate: null,
	};
	
	self.nextsong = {
		artist: null,
		album:  null,
		title:  null,
		cover:  null,
	};
	
	self.playlist = {};
	self.library  = {};
	self.counters = {
		artists: 0,
		proceed: 0,
		albums:  0,
	};
	
	//
	// connect to mpd
	//
	var client = mpd.connect({
		host: config['mpd-host'],
		port: config['mpd-port'],
	});
	
	//
	// parse a response and split it to an object
	//
	function parser(message) {
		var lines   = message.split("\n");
		var final   = []; // default value
		var initial = lines[0].split(": ")[0].trim();
		var current = {}
		
		for(var i = 0; i < lines.length - 1; i++) {
			var temp = lines[i].split(": ");
			var key  = temp[0].trim();
			
			// new item, pushing current
			if(key == initial) {
				final.push(current);
				current = {}
			}
			
			// avoid duplicate
			if(current[key])
				continue;
			
			current[key] = temp[1].trim();
		}
		
		// adding last entry and removing first (empty) one
		final.push(current);
		final.shift();
		
		return final;
	}
	
	//
	// build new song item
	//
	function song(source) {
		var destination = {};
		
		destination.title  = source.Title;
		destination.artist = source.Artist;
		destination.album  = source.Album;
		
		if(source.Track)
			destination.track = source.Track;
		
		if(source.Time)
			destination.time = source.Time;
		
		if(source.Pos)
			destination.position = source.Pos;
		
		if(source.Id)
			destination.id = source.Id;
		
		return destination;
	}
	
	//
	// update now playing
	//
	function nextsong(error, message) {
		var temp = parser(message);
		var data = temp[0];
		var item = self.playlist[data.nextsong];
		
		self.nextsong.artist = item.artist;
		self.nextsong.album  = item.album;
		self.nextsong.title  = item.title;
		self.nextsong.cover  = null;
		
		//
		// FIXME: copy/pasta
		//
		console.log("[+] next song: " + item.artist + " - " + item.title);
		
		// searching cover
		var query = "SELECT * FROM artwork WHERE artist = ? AND album = ?";
		
		self.artwork.all(query, item.artist, item.album, function(err, rows) {
			// setting cover
			if(rows.length > 0) {
				console.log("[+] next cover: " + rows[0].fullsize);
				self.nextsong.cover = rows[0].fullsize;
				
			} else console.log("[+] next cover: not found");
			
			// sending data to clients
			self.emit('nextsong', self.nextsong);
		});
	}
	
	function refresh(error, message) {
		var temp = parser(message);
		var data = temp[0];
		
		console.log(data);
		self.current = song(data);
		console.log(self.current);
		console.log("[+] current song: " + data.Artist + " - " + data.Title);
		
		// setting default cover
		self.current.cover = null;
		
		// searching cover
		var query = "SELECT * FROM artwork WHERE artist = ? AND album = ?";
		
		self.artwork.all(query, data.Artist, data.Album, function(err, rows) {
			// setting cover
			if(rows.length > 0) {
				console.log("[+] current cover: " + rows[0].fullsize);
				self.current.cover = rows[0].fullsize;
				
			} else console.log("[+] current cover: not found");
			
			// sending data to clients
			self.emit('refresh', self.current);
			client.sendCommand("status", nextsong);
		});
	}
	
	function update() {
		client.sendCommand("currentsong", refresh);
		status();
	}
	
	this.updater = function() {
		status();
	};
	
	//
	// update current playlist
	//
	function playlistinfo(error, message) {
		console.log("[+] mpd: playlist: fetching");
		
		var data = parser(message);
		console.log("[+] mpd: playling: " + data.length + " items fetched");
		
		self.playlist = {};
		
		for(var i = 0; i < data.length; i++)
			self.playlist[data[i].Pos] = song(data[i]);
		
		self.emit('playlist', self.playlist);
	}
	
	function playlist() {
		client.sendCommand("playlistinfo", playlistinfo);
	}
	
	//
	// build the library
	//
	function covers() {
		console.log("[+] mpd: loading covers");
		
		// searching cover
		var query = "SELECT * FROM artwork";
		
		self.artwork.all(query, function(err, rows) {
			self.counters.covers = 0;
			
			for(var i = 0; i < rows.length; i++) {
				item = rows[i];
				
				if(!self.library[item.artist]) {
					// console.log('[-] mpd: cover (artist): ' + item.artist + ': not found on library');
					continue
				}
				
				if(!self.library[item.artist][item.album]) {
					var name = item.artist + ' - ' + item.album;
					// console.log('[-] mpd: cover (album): ' + name + ': not found on library');
					continue
				}
				
				self.library[item.artist][item.album]['artworks'] = {
					'thumb': item.thumb,
					'full': item.fullsize
				};
				
				self.counters.covers++;
			}
			
			console.log("[+] mpd: covers: " + self.counters.covers + " covers fetched");
			
			self.emit('load-completed');
		});
	}
	
	function albums(_artist, message, test) {
		var artist = String(_artist);
		var data = parser(message);
		
		if(!self.library[artist])
			self.library[artist] = {};
		
		for(var i = 0; i < data.length; i++)
			self.library[artist][data[i].Album] = {};
		
		self.counters.proceed++;
		if(self.counters.proceed == self.counters.artists) {
			console.log("[+] mpd: albums: everything fetched");
			covers();
		}
	}
	
	function artists(error, message) {
		var data = parser(message);
		
		self.counters.artists = data.length;
		self.counters.proceed = 0;
		
		console.log("[+] mpd: artists: " + data.length + " fetched");
		
		for(var i = 0; i < data.length; i++) {
			client.sendCommand(
				command("list album artist", [data[i].Artist]),
				(function(error, message) { albums(this, message, self) }).bind(data[i].Artist)
			);
		}
	}
	
	function library() {
		client.sendCommand("list artist", artists);
	}
	
	//
	// current status ('real-time')
	//
	function current(error, message) {
		var temp = parser(message);
		var data = temp[0];
		
		self.status = {
			volume: parseInt(data.volume),
			elapsed: parseInt(data.elapsed),
			bitrate: parseInt(data.bitrate),
			nextsong: parseInt(data.nextsong),
		}
		
		self.emit('status', self.status);
	}
	
	function status() {
		client.sendCommand("status", current);
	}
	
	//
	// loading all stuff
	//
	client.on('ready', function() {
		console.log("[+] mpd: connected");
		
		//
		// loading playlist and while library
		//
		library();
		playlist();
		status();
		
		//
		// refresh player state
		//
		update();
	});

	// if daemon, listening for events
	if(daemon) {
		client.on('system', function(name) {
			console.log("[+] mpd: update: "+ name);
			
			if(name == "playlist")
				playlist();
		});

		client.on('system-player', update);
		
		// refresh current playing time
		setInterval(status, 1000);
	}
	
	//
	// Public Interface
	//
	this.queryError = function(response, message) {
		response.end(JSON.stringify({
			'status': 'error',
			'message': message

		}) + "\n");
	}
	
	this.querySuccess = function(response, payload) {
		response.end(JSON.stringify({
			'status': 'success',
			'payload': payload

		}) + "\n");
	}
	
	function timer(time) {
		if(!time)
			return '0:00';
		
		min = parseInt(time / 60);
		sec = time % 60;
		
		return ("0" + min).slice(-2) + ':' + ("0" + sec).slice(-2);
	}
	
	function _getFilename(error, message) {
		var data = parser(message);
		
		if(!this.album['tracks']) {
			console.log("[-] web: album tracks empty, this should not happen");
			return self.queryError(this.response, 'content invalid');
		}
		
		this.album['tracks'].push({
			'track': data[0]['Track'],
			'title': data[0]['Title'],
			'time': timer(data[0]['Time']),
			'date': data[0]['Date'],
		});
		
		if(this.album['tracks'].length == this.total)
			self.querySuccess(this.response, this.album);
	}
	
	function _getAlbum(error, message) {
		var data = parser(message);
		var artwork = null;
		
		if(self.library[this.artist][this.album]['artworks'])
			artwork = self.library[this.artist][this.album]['artworks']['full'];
		
		this.total = data.length;
		this.album = {
			'artist': this.artist,
			'album': this.album,
			'artwork': artwork,
			'tracks': [],
		};
		
		for(var x in data) {
			client.sendCommand(
				command("search filename", [data[x].file]),
				_getFilename.bind(this)
			);
		}
	}
	
	//
	// reading album content
	// "this" will be shared along all the process
	//
	this.getAlbum = function(artist, album, res) {
		this.artist = artist;
		this.album = album;
		this.response = res;
		
		console.log("[+] rest: requesting album: " + artist + " - " + album);
		
		client.sendCommand(
			command('list file artist ', [artist, "album", album]),
			_getAlbum.bind(this)
		);
	};
};

util.inherits(MusicPlayer, events.EventEmitter);
module.exports = MusicPlayer;
