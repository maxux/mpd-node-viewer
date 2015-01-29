var events  = require('events');
var util    = require('util');
var mpd     = require('mpd');
var sqlite3 = require('sqlite3').verbose();
var command = mpd.cmd;

var MusicPlayer = function() {
	var self = this;
	events.EventEmitter.call(this);
	
	self.artwork = new sqlite3.Database('../databases/artworks.sqlite3');
	
	self.current = {
		title:  null,
		artist: null,
		album:  null,
		track:  null,
		time:   null,
		position: null,
		cover:    null,
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
		port: 6600,
		host: 'localhost',
	});
	
	//
	// parse a response and split it to an object
	//
	function parser(message) {
		var lines = message.split("\n");
		var final = [{}]; // default value
		var index = 0;
		
		 // used to avoid "next object" on line duplication
		 // for exemple: AlbumArtist twice, with the same value
		var previous = null;
		
		for(var i = 0; i < lines.length - 1; i++) {
			if(lines[i] == previous)
				continue;
			
			var temp = lines[i].split(": ");
			var key  = temp[0].trim();
			
			// new item
			if(final[index][key])
				final[++index] = {};
				
			final[index][key] = temp[1].trim();
			previous = lines[i];
		}
		
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
		self.nextsong.cover  = 'default-release.jpg';
		
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
		
		self.current = song(data);
		console.log("[+] current song: " + data.Artist + " - " + data.Title);
		
		// setting default cover
		self.current.cover = 'default-release.jpg';
		
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
		
		for(var i = 0; i < data.length; i++)
			self.playlist[i] = song(data[i]);
	}
	
	function playlist() {
		client.sendCommand("playlistinfo", playlistinfo);
	}
	
	//
	// build the library
	//
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
			// covers();
		}
	}
	
	function artists(error, message) {
		var data = parser(message);
		
		self.counters.artists = data.length;
		self.counters.proceed = 0;
		
		console.log("[+] mpd: artists: " + data.length + " fetched");
		
		for(var i = 0; i < data.length; i++) {
			client.sendCommand(command("list album artist", [data[i].Artist]),
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

	client.on('system', function(name) {
		console.log("[+] mpd: update: "+ name);
	});

	client.on('system-player', update);
	
	// refresh current playing time
	// setInterval(status, 10000);
	setInterval(status, 1000);
};

util.inherits(MusicPlayer, events.EventEmitter);
module.exports = MusicPlayer;
