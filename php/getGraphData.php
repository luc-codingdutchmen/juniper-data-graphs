<?php
	require_once('RouterData.php');
	$data = RouterData::get_graph_data($_GET['device'], $_GET['interface']);
	echo json_encode($data, JSON_PRETTY_PRINT);
?>
