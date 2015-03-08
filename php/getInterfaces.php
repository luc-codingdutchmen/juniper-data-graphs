<?php
	require_once('RouterData.php');
	$interfaces = RouterData::get_interfaces($_GET['machine_id']);
	echo json_encode($interfaces, JSON_PRETTY_PRINT);
?>
