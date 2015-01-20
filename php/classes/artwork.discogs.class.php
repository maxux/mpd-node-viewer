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
	
	function insert($artist, $album, $release, $thumb, $fullsize) {
		$stmt = $this->database->prepare('
			INSERT INTO artwork (artist, album, release, thumb, fullsize)
			VALUES (:artist, :album, :release, :thumb, :fullsize)
		');
		
		$stmt->bindValue(':artist', $artist, SQLITE3_TEXT);
		$stmt->bindValue(':album', $album, SQLITE3_TEXT);
		$stmt->bindValue(':release', $release, SQLITE3_INTEGER);
		$stmt->bindValue(':thumb', $thumb, SQLITE3_TEXT);
		$stmt->bindValue(':fullsize', $fullsize, SQLITE3_TEXT);
		$stmt->execute();
	}
	
	function clean($tag) {
		// pass 1: removing some pattern
		$remove = array('Deluxe', 'Special', 'Edition', '(', ')', 'EP', ',');
		$tag = str_replace($remove, '', $tag);
		
		$remove  = array(' And ');
		$replace = array(' & ');
		$tag = str_replace($remove, $replace, $tag);
		
		// pass 2: removing extra words
		if(($temp = strstr($tag, ' -', true)))
			$tag = $temp;
		
		if(($temp = stristr($tag, ' feat', true)))
			$tag = $temp;
		
		return trim($tag);
	}
	
	function save($artist, $album, $artwork) {
		//
		// finding the first release with a thumbnail
		//
		for($i = 0; $i < count($artwork->results); $i++) {
			if($artwork->results[$i]->thumb != '') {
				$item = $artwork->results[$i];
				break;
			}
		}
		
		$image = $item->thumb;
		$this->debug('[+] artwork: '.$image);
		
		if($item->type == 'release')
			$release = $this->discogs->releases($item->id);
			
		else if($item->type == 'master')
			$release = $this->discogs->masters($item->id);
		
		//
		// thumbnail
		//
		$data = $this->discogs->artwork($item);
		$hash = md5($data);
		$file = $hash.'.jpg';
		
		// saving image
		$write = file_put_contents($this->directory.$file, $data);
		$this->debug("[+] $file: $write bytes written");
		
		//
		// fullsize
		//
		$fsdata = $this->discogs->image($release->images[0]->uri);
		$fshash = md5($fsdata);
		$fsfile = $fshash.'.jpg';
		
		// saving image
		$write = file_put_contents($this->directory.$fsfile, $fsdata);
		$this->debug("[+] $fsfile: $write bytes written");
		
		// updating database
		$this->insert($artist, $album, $item->id, $file, $fsfile);
	}
	
	function cache($artist, $album) {
		// request image from discogs
		$data = $this->discogs->album($artist, $album);
		
		if(count($data->results) > 0) {
			$this->save($artist, $album, $data);
			
		} else {
			$alternate1 = $this->clean($artist);
			$alternate2  = $this->clean($album);
			
			$this->debug("[+] not found, trying: $alternate1 - $alternate2");
			$data = $this->discogs->album($alternate1, $alternate2, false);
			
			if(count($data->results) > 0) {
				$this->save($artist, $album, $data);
				
			} else $this->debug('[-] no match found, skipping');	
		} 
	}
	
	//
	// hit cache to check if download is required
	//
	function hit($artist, $album) {
		$this->debug("[+] checking: $artist - $album");
		
		// already on cache
		if(isset($this->cache[$artist][$album]['thumb']))
			return;
		
		// fetching cover
		$this->cache($artist, $album);
	}
	
	//
	// checking library's cache
	//
	function process() {
		// caching the whole library
		foreach($this->library as $artist => $albums)
			foreach($albums as $album => $void)
				$this->hit($artist, $album);
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
