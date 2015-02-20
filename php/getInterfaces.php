<?php
	require_once('RouterData.php');
	$interfaces = RouterData::get_interfaces($_GET['device']);
	echo json_encode($interfaces, JSON_PRETTY_PRINT);
?>
