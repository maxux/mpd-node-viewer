var WebSocketServer = require('websocket').server;
var https = require('https');
var http = require('http');
var fs = require('fs');

var WebSocket = function(port, handler, config) {
	var httpsrv = null;

	if(config['ssl-key']) {
		console.log("[+] websocket: loading ssl");
		
		var cfg = {
			'key': fs.readFileSync(config['ssl-key']),
			'cert': fs.readFileSync(config['ssl-cert'])
		};
		
		httpsrv = https.createServer(cfg, invalid).listen(port);
		
	} else httpsrv = http.createServer(invalid).listen(port);

	wsServer = new WebSocketServer({
		httpServer: httpsrv,
		autoAcceptConnections: false
	});
	
	function invalid(req, response) {
		response.writeHead(404);
		response.end();
	}

	function valide(origin) {
		// check origin
		return true;
	}
	
	wsServer.on('request', function(request) {
		if(!valide(request.origin)) {
			request.reject();
			return;
		}
		
		// accpting connection
		try {
			var connection = request.accept('musicplayer', request.origin)
			
		} catch(err) {
			console.log("[-] websocket: error: " + err);
			return;
		}
		
		console.log('[+] websocket: client accepted: ' + request.remoteAddress);
		
		new handler(connection);
		
		connection.on('close', function() {
			console.log('[+] websocket: client disconnected');
		});
	});
};

module.exports = WebSocket;
