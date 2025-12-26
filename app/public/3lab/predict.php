<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data) || empty($data['image_base64']) || !is_string($data['image_base64'])) {
  http_response_code(400);
  echo json_encode(['error' => 'image_base64 is required'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (strlen($data['image_base64']) > 2_000_000) {
  http_response_code(413);
  echo json_encode(['error' => 'Image too large'], JSON_UNESCAPED_UNICODE);
  exit;
}

$payload = json_encode(['image_base64' => $data['image_base64']], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($payload === false) {
  http_response_code(500);
  echo json_encode(['error' => 'JSON encode failed'], JSON_UNESCAPED_UNICODE);
  exit;
}

$url = 'http://python3lab:8001/predict';

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CONNECTTIMEOUT => 5,
  CURLOPT_TIMEOUT => 20,
]);

$res = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($res === false) {
  http_response_code(502);
  echo json_encode(['error' => 'Python service unavailable', 'details' => $err], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code($code ?: 502);
echo $res;
