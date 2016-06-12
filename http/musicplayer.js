var wsport = 0;
var wsprotocol = "ws";

var RemotePlayer = function() {
	this.self = this;
	
	self.socket;
	self.playlist = [{}];
	self.current  = {};
	self.playing  = null;
	self.library  = {};

	function connect() {
		var self = this;
		
		// saving from source
		this.remote = wsprotocol + "://" + window.location.hostname + ":" + wsport;
		
		console.log(remote + ": connecting");
		this.socket = new WebSocket(self.remote, "musicplayer");
		
		this.socket.onopen = function() {
			console.log(self.remote + ': connected');
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
			
			if(json.event == 'refresh')
				self.current = json.payload;
			
			if(json.event == 'playlist')
				self.playlist = json.payload;
			
			if(json.event == 'library' && $('#library').length)
				return library(json.payload);
				
			update();
		};
		
		this.socket.onclose = function() {
			console.log(self.remote + ': disconnected');
			setTimeout(function() { connect() }, 2000);
		};
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
	
	function playing() {
		var index = parseInt(self.current.position);
		var count = self.playlist.length;
		var float = 3;
		var start = ((index - (float - 1)) < 0) ? 0 : index - float;
		var end   = ((index + (float + 1)) > count) ? count : index + float + 1;
	
		$('#playlist tbody').empty();
		
		for(var i = start; i < end; i++) {
			var item = self.playlist[i];
			
			var tr = $('<tr>');			
			tr.append($('<td>').html(item.artist));
			tr.append($('<td>').html(item.album));
			tr.append($('<td>').html(item.title));
			tr.append($('<td>').html(timeinfo(item.time)));
			
			if(i == index)
				tr.attr('class', 'success');
				
			$('#playlist tbody').append(tr);
		}
	}
	
	function minimal() {
		if(self.playing) {
			// progress bar
			var percent = (self.playing.elapsed / self.current.time) * 100;
			$('#progress').css('width', percent + '%');
			
			// timeinfo
			// $('#bitrate').html(self.playing.bitrate + ' kbps');
			var text = timeinfo(self.playing.elapsed) + ' / ' + timeinfo(self.current.time);
			// text += ' [' + self.playing.bitrate + ' kbps]';
			
			$('#timestamp').html(text);
		}
	}
	
	function update() {
		$('.now-artist').html(self.current.artist);
		$('.now-title').html(self.current.title);
		$('.now-album').html(self.current.album);
		
		document.title = self.current.artist + ' - ' + self.current.title;
		
		if(!self.current.cover)
			self.current.cover = '../default-release.jpg';
		
		if(!$('html').hasClass('full')) {
			$('#cover').attr('src', '/covers/cache/' + self.current.cover);
			
		} else $('html').css('background-image', 'url(/covers/cache/' + self.current.cover + ')');
		
		minimal();
		playing();
	};
	
	function library(data) {
		var index = 1;
		var row = $('#library .row');
		
		for(var artist in data) {
			for(var album in data[artist]) {
				var that = data[artist][album];
				var cover = (that.artworks) ? '/covers/cache/' + that.artworks.thumb : '/covers/default-release.jpg';
				
				var item  = $('<div>', {'class': 'col-lg-2 col-md-4 col-xs-6 thumb'});
				var link  = $('<a>', {'class': 'thumbnail', 'onclick': "return album('" + artist + "', '" + album + "');"});
				var image = $('<img>', {src: cover});
				var text  = $('<div>', {'class': 'title'}).html('<strong>' + artist + '</strong><br />' + album);
				
				link.append(image);
				item.append(link);
				item.append(text);
				
				row.append(item);
				
				if(!(index % 6)) row.append($('<div>', {'class': 'clearfix visible-lg-block'}));
				if(!(index % 3)) row.append($('<div>', {'class': 'clearfix visible-md-block'}));
				if(!(index % 2)) row.append($('<div>', {'class': 'clearfix visible-xs-block'}));
				index++;
			}
		}
	}
	
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


//
// FIXME !!! FIXME !!! FIXME
//
function show(data) {
	$('#album-content #album-artist').html(data.artist);
	$('#album-content #album-name').html(data.album);
	$('#album-content #album-cover').attr('src', '/covers/cache/' + data.artwork);
	
	// content
	var tbody = $('#album-content #album-tracks tbody');
	$(tbody).empty();
	
	
	for(var i = 0; i < data.tracks.length; i++) {
		var tr = $('<tr>');
		
		tr.append($('<td>').html(data.tracks[i].track));
		tr.append($('<td>').html(data.tracks[i].title));
		tr.append($('<td>').html(data.tracks[i].time));
		
		// adding line
		tbody.append(tr);
	}
	
	$('#album-content').modal();
}

function album(artist, album) {
	$.ajax({
		type: "POST",
		url: "/query/album",
		data: {action: "album", artist: artist, album: album}
		
	}).done(function(data) {
		console.log(data);
		
		if(data.status == 'success') {
			show(data.payload);
			
		} else failure(data.message);
	});
	
	return false;
}
