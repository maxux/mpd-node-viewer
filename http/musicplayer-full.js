var RemotePlayer = function() {
	this.self = this;
	
	self.socket;
	self.current  = {};
	self.playing  = null;
	self.nextsong = {};

	function connect() {
		var self = this;
		
		this.socket = new WebSocket("ws://clea.maxux.net:9911/", "musicplayer");
		
		this.socket.onopen = function() {
			console.log('connected');
			$('#artist').html('connected');
		}
		
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
			$('<img/>')[0].src = '../../cache/' + self.nextsong.cover;
			$('<img/>')[0].src = '../../cache-blur/' + self.nextsong.cover;
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
		
		// $('div.full').css('background-image', 'url(../../cache/' + self.current.cover + ')');
		$('div.full').css('background-image', 'url(../../cache-blur/' + self.current.cover + ')');
		$('div.cover').css('background-image', 'url(../../cache/' + self.current.cover + ')');
		
		minimal();
	};
	
	connect();
};

$(document).bind("contextmenu",function(e) { e.preventDefault() });
