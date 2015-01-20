var WebSocketServer = require('websocket').server;
var http = require('http');

var WebSocket = function(port, handler, extra) {
	var server = http.createServer(function(req, response) {
		response.writeHead(404);
		response.end();
		
	}).listen(port);

	wsServer = new WebSocketServer({
		httpServer: server,
		autoAcceptConnections: false
	});

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
		
		new handler(connection, extra);
		
		connection.on('close', function() {
			console.log('[+] websocket: client disconnected');
		});
	});
};

module.exports = WebSocket;
