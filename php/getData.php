<?php
	require_once('RouterData.php');

	$host = "10.0.100.1";
	$host = "192.168.2.254";
	if(isset($_GET['host'])) {
		$host = $_GET['host'];
	}

	$resolution = 60;

	$time = time();
	$timestamp = ($time - ($time % $resolution));
	RouterData::run($host, $timestamp);
?>
