<?php
class Artworks {
	private $database = null; // sqlite database handler
	private $discogs  = null; // discogs class
	private $library  = null; // mpd library array
	private $cache    = null; // sql table in memory
	
	private $directory = '../http/cache/';
	private $datafile  = '../databases/artworks.sqlite3';
	
	private $console   = null;
	
	function __construct($discogs = null, $library = null, $console = false) {
		$this->console = $console;
		
		$this->debug('[+] opening database');
		$this->database = new SQLite3($this->datafile);
		$this->database->busyTimeout(10000);
		
		// linking classes
		$this->debug('[+] linking classes');
		$this->library = $library;
		$this->discogs = $discogs;
		
		
		$this->import();
	}
	
	function debug($str) {
		if($this->console)
			echo "$str\n";
	}
	
	//
	// load database in memory
	//
	function import() {
		$this->debug('[+] loading database on memory');
		
		$req = $this->database->query('SELECT * FROM artwork');
		while($data = $req->fetchArray()) {
			$this->cache[$data['artist']][$data['album']] = array(
				'thumb' => $data['thumb'],
				'fullsize' => $data['fullsize']
			);
		}
	}
	
	//
	// search on memory
	//
	function thumbnail($artist, $album) {
		if(isset($this->cache[$artist][$album]))
			return $this->cache[$artist][$album]['thumb'];
		
		return 'default-release.png';
	}
	
	function fullsize($artist, $album) {
		if(isset($this->cache[$artist][$album]))
			return $this->cache[$artist][$album]['fullsize'];
		
		return 'default-release.png';
	}
}
?>
