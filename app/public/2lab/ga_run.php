<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed, use POST'], JSON_UNESCAPED_UNICODE);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON body'], JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Минимальная валидация входа
 * (можешь расширить/убрать — но так безопаснее)
 */
$required = ['a','b','c','d'];
foreach ($required as $key) {
  if (!array_key_exists($key, $data) || !is_numeric($data[$key])) {
    http_response_code(400);
    echo json_encode(['error' => "Missing/invalid parameter: $key"], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

// Значения по умолчанию (если фронт не передал)
$defaults = [
  'x_min' => -10,
  'x_max' => 53,
  'pop_size' => 80,
  'generations' => 80,
  'seed' => 1
];
$payload = array_merge($defaults, $data);

// URL python-сервиса внутри docker сети
$pythonUrl = 'http://python:8000/run';

$ch = curl_init($pythonUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_CONNECTTIMEOUT => 3,
  CURLOPT_TIMEOUT => 30
]);

$response = curl_exec($ch);
$curlErr = curl_error($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
  http_response_code(502);
  echo json_encode(['error' => 'Python service unreachable', 'details' => $curlErr], JSON_UNESCAPED_UNICODE);
  exit;
}

// Если python вернул ошибку — прокидываем как есть, но с корректным кодом
if ($httpCode < 200 || $httpCode >= 300) {
  http_response_code($httpCode ?: 502);
  echo $response;
  exit;
}

http_response_code(200);
echo $response;
