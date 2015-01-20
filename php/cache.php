<?php
include('classes/lastfm.class.php');
include('classes/mpd.class.php');
include('classes/artwork.lastfm.class.php');

$lastfm = new Lastfm();

$mpd = new MusicPlayerDaemon();
$mpd->library();

$artwork = new Artworks($lastfm, $mpd->library, true);
$artwork->process();
?>
