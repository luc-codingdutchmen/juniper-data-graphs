<?php
	require_once('RouterData.php');
	$devices = RouterData::get_devices();
	echo json_encode($devices, JSON_PRETTY_PRINT);
?>
