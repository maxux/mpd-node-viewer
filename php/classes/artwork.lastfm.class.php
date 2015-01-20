<?php
class Artworks {
	private $database = null; // sqlite database handler
	private $lastfm   = null; // lastfm class
	private $library  = null; // mpd library array
	private $cache    = null; // sql table in memory
	
	private $directory = '../../cache/';
	private $datafile  = '../databases/artworks.sqlite3';
	
	private $console   = null;
	
	function __construct($lastfm = null, $library = null, $console = false) {
		$this->console = $console;
		
		$this->debug('[+] opening database');
		$this->database = new SQLite3($this->datafile);
		$this->database->busyTimeout(10000);
		
		// linking classes
		$this->debug('[+] linking classes');
		$this->library = $library;
		$this->lastfm  = $lastfm;
		
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
		$remove = array('Deluxe', 'Special', 'Edition', '(', ')', 'EP');
		$tag = str_replace($remove, '', $tag);
		
		$remove  = array(' And ', ',');
		$replace = array(' & ', '.');
		$tag = str_replace($remove, $replace, $tag);
		
		// pass 2: removing extra words
		if(($temp = strstr($tag, ' -', true)))
			$tag = $temp;
		
		if(($temp = stristr($tag, ' feat', true)))
			$tag = $temp;
		
		return trim($tag);
	}
	
	function save($artist, $album, $data) {		
		//
		// thumbnail
		//
		$sizes  = array('large', 'extralarge', 'medium');
		foreach($sizes as $size) {
			$thurl  = $this->lastfm->artwork($data, $size);
			$thdata = $this->lastfm->download($thurl);
			
			if($thdata != null)
				break;
		}
		
		$thhash = md5($thdata);
		$thfile = $thhash.'.jpg';
		
		// saving image
		$write = file_put_contents($this->directory.$thfile, $thdata);
		$this->debug("[+] $thfile: $write bytes written");
		
		//
		// fullsize
		//
		$fsurl  = $this->lastfm->artwork($data, 'mega');
		$fsdata = $this->lastfm->download($fsurl);
		$fshash = md5($fsdata);
		$fsfile = $fshash.'.jpg';
		
		// saving image
		$write = file_put_contents($this->directory.$fsfile, $fsdata);
		$this->debug("[+] $fsfile: $write bytes written");
		
		// updating database
		$this->insert($artist, $album, 0, $thfile, $fsfile);
	}
	
	function alternative($artist, $album) {
		$alternate1 = $this->clean($artist);
		$alternate2 = $this->clean($album);
		
		$this->debug('[+] trying with: '.$alternate1.' - '.$alternate2);
		$data = $this->lastfm->album($alternate1, $alternate2);
		
		if(isset($data->error)) {
			$this->debug('[-] '.$data->message);
			return;
		}
		
		if($this->lastfm->artwork($data, 'mega') == '') {
			$this->debug('[-] release found, but no covers found');
			$this->debug('[-] more info: '.$data->album->url);
			$this->debug('[-] skipping this album. sorry');
			return;
		}
		
		$this->save($artist, $album, $data);
	}
	
	function cache($artist, $album) {
		// request image from discogs
		$data = $this->lastfm->album($artist, $album);
		
		if(isset($data->error)) {
			$this->debug('[-] '.$data->message);
			return;
		}
		
		if($this->lastfm->artwork($data, 'mega') == '') {
			$this->debug('[-] release found, but no covers found');
			$this->debug('[-] more info: '.$data->album->url);
			$this->alternative($artist, $album);
			return;
		}
		
		$this->save($artist, $album, $data);
	}
	
	//
	// hit cache to check if download is required
	//
	function hit($artist, $album) {
		// $this->debug("[+] checking: $artist - $album");
		
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
}
?>
