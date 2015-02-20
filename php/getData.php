<?php
	require_once('RouterData.php');

	$host = "10.0.100.1";
	$host = "192.168.2.254";
	
	$resolution = 60;
	
	$j = 0;
	while(true || $j < 5) {
		$time = time();
		$go = (($time % $resolution) == 0);
		usleep(500000);
		if(true == $go) {
			$j++;
			$timestamp = ($time - ($time % $resolution));
			RouterData::run($host, $timestamp);
			usleep(500000);
		}
	}
?>
