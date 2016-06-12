
var MpdUIConfig = {
    // music player daemon
    'mpd-host': 'localhost',
    'mpd-port': 6600,
    
    // lastfm api
    // http://www.last.fm/api/account/create
    'lastfm-key': '',
    'lastfm-secret': '',
    
    // websocket and webserver
    'ws-port': 9911,
    'web-port': 9910,
    
    // for https, put your ssl keys
    // for http, just put false here
    'ssl-key': false,
    'ssl-cert': false,
    // 'ssl-key': 'ssl/your-ssl.key',
    // 'ssl-cert': 'ssl/your-ssl.crt',
};

module.exports = MpdUIConfig;
