<?php
require_once 'api/db.php';
$db = getDB();
$sql = "SELECT team_id, team_name, short_name FROM teams";
$stmt = $db->query($sql);
$teams = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($teams, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
