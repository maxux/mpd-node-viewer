var MusicPlayer = require('./musicplayer.js');
var WebSocket   = require('./websocket.js');

var player = new MusicPlayer();
var websocket = new WebSocket(9911, syncronize, null);

function syncronize(connection, extra) {
	//
	// send the current track
	//
	var refresh = function(data) {
		connection.sendUTF(JSON.stringify({event: 'refresh', payload: data}));
	};
	
	//
	// send the playlist
	//
	var playlist = function(data) {
		connection.sendUTF(JSON.stringify({event: 'playlist', payload: data}));
	};
	
	//
	// send the current status
	//
	var status = function(data) {
		connection.sendUTF(JSON.stringify({event: 'status', payload: data}));
	};
	
	//
	// send the library
	//
	var library = function(data) {
		connection.sendUTF(JSON.stringify({event: 'library', payload: data}));
	};
	
	//
	// send the next song information
	//
	var nextsong = function(data) {
		connection.sendUTF(JSON.stringify({event: 'nextsong', payload: data}));
	};
	
	//
	// events binding
	//
	player.on('refresh', refresh);
	player.on('status', status);
	player.on('nextsong', nextsong);
	
	//
	// removing each handlers listeners on close
	//
	connection.on('close', function() {
		connection.removeAllListeners();
		player.removeListener('refresh', refresh);
		player.removeListener('refresh', status);
		player.removeListener('refresh', nextsong);
	});
	
	//
	// initial state on connection
	//
	playlist(player.playlist);
	refresh(player.current);
	library(player.library);
	nextsong(player.nextsong);
	
	player.updater();
	
	
	console.log("[+] syncronize: ready");
}



