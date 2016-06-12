var MusicPlayer = require('./classes/musicplayer.js');
var WebSocket   = require('./classes/websocket.js');
var GlobalConf  = require('./config.js');

//
// Music Player Daemon process
//
var player = new MusicPlayer(GlobalConf, true);

//
// websocket handler
//
var websocket = new WebSocket(GlobalConf['ws-port'], syncronize, GlobalConf);

function syncronize(connection) {
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
	player.on('playlist', playlist);
	
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

//
// static and restful web server
//
var express = require('express');
var bodyParser = require('body-parser')
var https = require('https');
var http = require('http');
var fs  = require('fs');
var app = express();

app.use(express.static('../http'));
app.use('/covers/', express.static('../covers'));
app.use(bodyParser.urlencoded({extended: true})); 

// http or https
if(GlobalConf['ssl-key'] !== false) {
	var cfg = {
		key: fs.readFileSync(GlobalConf['ssl-key']),
		cert: fs.readFileSync(GlobalConf['ssl-cert'])
	};
	
	console.log("[+] web: listening https server (port " + GlobalConf['web-port'] + ")");
	https.createServer(cfg, app).listen(GlobalConf['web-port']);
	
} else {
	console.log("[+] web: listening http server (port " + GlobalConf['web-port'] + ")");
	http.createServer(app).listen(GlobalConf['web-port']);
}

//
// REST Requests
//
app.get('/query/info', function(req, res) {
	res.writeHead(200, {'Content-Type': 'application/json'});
	
	var info = {
		'ssl': !(GlobalConf['ssl-key'] === false),
		'port': GlobalConf['ws-port'],
	};
	
	player.querySuccess(res, info);
});

app.post('/query/album', function(req, res) {
	res.writeHead(200, {'Content-Type': 'application/json'});
	
	var artist = req.body.artist;
	var album = req.body.album;
	
	player.getAlbum(artist, album, res);
});
