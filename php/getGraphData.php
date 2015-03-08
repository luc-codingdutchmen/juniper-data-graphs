<?php
	require_once('RouterData.php');
	$data = RouterData::get_graph_data($_GET['machine_id'], $_GET['device_id']);
	echo json_encode($data, JSON_PRETTY_PRINT);
?>
