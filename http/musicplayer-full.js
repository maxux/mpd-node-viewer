var wsport = 0;
var wsprotocol = "ws";

var RemotePlayer = function() {
	this.self = this;
	
	self.socket;
	self.current  = {};
	self.playing  = null;
	self.nextsong = {};

	function connect() {
		var self = this;
		
		// saving from source
		this.remote = wsprotocol + "://" + window.location.hostname + ":" + wsport;
		
		console.log(remote + ": connecting");
		this.socket = new WebSocket(self.remote, "musicplayer");
		
		this.socket.onopen = function() {
			console.log(remote + ': connected');
			$('#artist').html('connected');
		};
		
		this.socket.onmessage = function(msg) {
			json = JSON.parse(msg.data);
			
			// malformed json
			if(!json.event)
				return;
			
			// don't show this on console, too verbose
			if(json.event == 'status') {
				self.playing = json.payload;
				return minimal();
			}
			
			// dump and long check
			console.log(json);
			
			if(json.event == 'refresh') {
				self.current = json.payload;
				return update();
			}
			
			if(json.event = 'nextsong') {
				self.nextsong = json.payload;
				return preload();
			}
			
			// ignoring
		}
		
		this.socket.onclose = function() {
			console.log('disconnected');
			
			// retry to connect
			setTimeout(function() { connect() }, 2000);
		}
	};
	
	function format(number) {
		var s = parseInt(number) + "";
		while (s.length < 2) s = "0" + s;
		return s;
	}
	
	function timeinfo(value) {
		var min = format(value / 60);
		var sec = format(value % 60);
		return min + ':' + sec;
	}
	
	function preload() {
		// preloading next cover
		if(self.nextsong.cover) {
			$('<img/>')[0].src = '/covers/cache/' + self.nextsong.cover;
			$('<img/>')[0].src = '/covers/blurred/' + self.nextsong.cover;
		}
	}
	
	function minimal() {
		if(self.playing) {
			// progress bar
			var percent = (self.playing.elapsed / self.current.time) * 100;
			$('#progress').css('width', percent + '%');
			
			// timeinfo
			// $('#bitrate').html(self.playing.bitrate + ' kbps');
			$('#timestamp').html(timeinfo(self.playing.elapsed) + ' / ' + timeinfo(self.current.time));
		}
	}
	
	function update() {
		$('.now-artist').html(self.current.artist);
		$('.now-title').html(self.current.title);
		$('.now-album').html(self.current.album);
		
		document.title = self.current.artist + ' - ' + self.current.title;
		
		// $('div.full').css('background-image', 'url(../../cache/' + self.current.cover + ')');
		$('div.full').css('background-image', 'url(/covers/blurred/' + self.current.cover + ')');
		$('div.cover').css('background-image', 'url(/covers/cache/' + self.current.cover + ')');
		
		minimal();
	};
	
	//
	// request server info and building remote schema
	//
	function initialize(info) {
		pl = info.payload;
		
		wsport = pl.port;
		wsprotocol = pl.ssl ? 'wss' : 'ws';
		
		connect();
	}
	
	$.get('/query/info', initialize);
};

$(document).bind("contextmenu", function(e) { e.preventDefault() });
