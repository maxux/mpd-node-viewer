<?php
class Lastfm {
	private $apikey    = '';
	private $baseurl   = 'http://ws.audioscrobbler.com/2.0';
	private $useragent = 'MaxuxLibrary/1.0 +http://clea.maxux.net/maxux/music/node/http';
	
	function __construct() {
		
	}
	
	function download($url) {
		echo "[+] lastm: downloading: $url\n";
		return $this->request($url);
	}
	
	private function request($url) {
		$c = curl_init();
		
		curl_setopt($c, CURLOPT_URL, $url);
		curl_setopt($c, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($c, CURLOPT_HEADER, false);
		curl_setopt($c, CURLOPT_USERAGENT, $this->useragent);

		if(!$output = curl_exec($c)) {
			echo "[-] lastfm: cannot download file\n";
			return null;
		}
		
		if(($code = curl_getinfo($c, CURLINFO_HTTP_CODE)) != 200) {
			echo "[-] lastfm: http code: $code\n";
			return null;
		}
		
		return $output;
	}
	
	function endpoint($endpoint, $parameters = array()) {		
		$parameters['api_key'] = $this->apikey;
		$parameters['format']  = 'json';
		
		$queries  = $this->parameters($parameters);
		$finalurl = $this->baseurl.'/?method='.$endpoint.'&'.$queries;
		
		return json_decode($this->request($finalurl));
	}
	
	function parameters($array) {
		$temp = array();
		
		foreach($array as $key => $value)
			$temp[] = $key.'='.urlencode($value);
		
		return implode('&', $temp);
	}
	
	function album($artist, $album) {
		$fields = array(
			'artist' => $artist,
			'album'  => $album
		);
		
		return $this->endpoint('album.getinfo', $fields);
	}
	
	function artwork($album, $size) {
		$items = $album->album->image;
		
		foreach($items as $image) {
			// matching size ?
			if($image->size == $size) {
				return $image->{'#text'};
			}
		}
		
		return null;
	}	
}
?>
