<?php
class MusicPlayerDaemon {
	private $socket;
	
	public $stats    = array();
	public $current  = array();
	public $playlist = array();
	public $library  = array();
	
	function __construct($host = 'localhost', $port = 6600) {
		if(!($this->socket = @fsockopen($host, $port, $errno, $errstr)))
			die("$errstr\n");
		
		$check = $this->read();		
		$this->stats();
	}
	
	//
	// read from server and return an array of lines
	//
	function read() {
		$output = array();
		
		while($temp = fgets($this->socket)) {
			$output[] = trim($temp);
			
			if(($value = $this->validate($temp))) {
				// removing OK if success
				if($value == 1)
					array_pop($output);
				
				break;
			}
		}
		
		return $output;
	}
	
	//
	// query server and return the whole response
	//
	function request($request) {
		fwrite($this->socket, "$request\n");
		return $this->read();
	}
	
	//
	// check a end-of-message
	//
	function validate($line) {
		if(substr($line, 0, 2) == 'OK')
			return 1;
		
		if(substr($line, 0, 4) == 'ACK ')
			return 2;
		
		return false;
	}
	
	//
	// update mpd stats
	//
	function stats() {
		$data = $this->request("stats");
		
		foreach($data as $line) {
			$temp = explode(': ', $line);
			$this->stats[$temp[0]] = $temp[1];
		}
	}
	
	//
	// current playing song
	//
	function current() {
		$data = $this->request('currentsong');
		
		foreach($data as $line) {
			$temp = explode(': ', $line);
			$this->current[strtolower($temp[0])] = $temp[1];
		}
		
		return $this->current;
	}
	
	//
	// load playlist
	//
	function playlist() {
		$data = $this->request('playlistinfo');
		
		$index = -1;
		foreach($data as $line) {
			$temp = explode(':', $line);
			$key  = strtolower($temp[0]);
			
			if($temp[0] == 'file')
				$index++;
				
			$this->playlist[$index][$key] = trim($temp[1]);
		}
		
		return $this->playlist;
	}
	
	function filename($file) {
		$data = $this->request('search filename "'.$file.'"');
		$list = array();
		
		foreach($data as $line) {
			$temp = explode(': ', $line);
			$list[strtolower($temp[0])] = trim($temp[1]);
		}
		
		return $list;
	}
	
	
	//
	// extract albums name from albums list response
	//
	function albums($list) {
		$output = array();
		
		// fetching albums
		foreach($list as $line) {
			$temp = substr($line, 7);
			$output[$temp] = array();
		}
		
		// sorting artists
		ksort($output);
		
		return $output;
	}
	
	//
	// extract artists name from artists list response
	//
	function artists($list) {
		$output = array();
		
		// fetching artists
		foreach($list as $line) {
			$artist = substr($line, 8);
			$output[$artist] = array();
		}
		
		// sorting artists
		ksort($output);
		
		return $output;
	}
	
	//
	// time formater helper
	//
	function timeinfo($value) {
		$min = sprintf("%02d", $value / 60);
		$sec = sprintf("%02d", $value % 60);
		return "$min:$sec";
	}
	
	//
	// dump artists and albums from the whole library
	//
	function library() {
		// clear current library
		$this->library = array();
		
		// list artists
		$data = $this->request("list artist");
		$this->library = $this->artists($data);
		
		
		// fetching artists's albums
		foreach($this->library as $artist => $void) {
			$data = $this->request("list album artist \"$artist\"");
			$this->library[$artist] = $this->albums($data);
		}
	}
	
	//
	// return album information from a given artist and album pair
	//
	function album($artist, $album) {
		$content = array();
		
		$data = $this->request("list file artist \"$artist\" album \"$album\"");
		
		foreach($data as $line) {
			$temp = explode(': ', $line);
			$content[] = $this->filename($temp[1]);
		}
		
		return $content;
	}
}
?>
