<?php
include('tmhoauth.class.php');

class Discogs {
	private $oauth_consumer_key    = '';
	private $oauth_consumer_secret = '';
	private $oauth_token           = '';
	private $oauth_token_secret    = '';
	private $oauth                 = null;
	
	private $lastrequest = 0;
	
	function __construct() {
		$this->oauth = new tmhOAuth(array(
			'consumer_key'	   => $this->oauth_consumer_key,
			'consumer_secret'  => $this->oauth_consumer_secret,
			'user_token' 	   => $this->oauth_token,
			'user_secret' 	   => $this->oauth_token_secret
		));
	}
	
	private function request($endpoint, $parameters = array()) {
		// throtthing
		if(microtime(true) - $this->lastrequest < 1)
			sleep(1);
		
		$this->oauth->request('GET', $this->oauth->url($endpoint), $parameters);
		$this->lastrequest = microtime(true);
		
		// print_r($this->oauth->response);
		
		return $this->oauth->response['response'];
	}
	
	function endpoint($endpoint, $parameters = array()) {
		return json_decode($this->request('https://api.discogs.com/'.$endpoint, $parameters));
	}
	
	function album($artist, $album, $master = true) {
		$fields = array(
			'artist' => $artist,
			'release_title' => $album,
			'type' => ($master) ? 'master' : 'release'
		);
		
		return $this->endpoint('/database/search', $fields);
	}
	
	function artwork($master) {
		return $this->request($master->thumb);
	}
	
	function image($image) {
		return $this->request($image);
	}
	
	function releases($id) {
		return $this->endpoint('/releases/'.$id);
	}
	
	function masters($id) {
		return $this->endpoint('/masters/'.$id);
	}
	
	function check() {
		return $this->endpoint('/oauth/identity');
	}
}

/*
$discogs = new Discogs();
print_r($discogs->check());
*/

/*
$discogs = new Discogs();

$item    = $discogs->album('Klaxons', 'Love Frequency');
$artwork = $discogs->artwork($item->results[0]);

header('Content-type: image/jpeg');
echo $artwork;
*/
?>
