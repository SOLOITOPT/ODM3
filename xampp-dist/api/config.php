<?php
declare(strict_types=1);

// Optional local override file (create api/config.local.php to customize credentials without editing tracked files)
$localConfigPath = __DIR__ . '/config.local.php';
$localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
if (!is_array($localConfig)) {
    $localConfig = [];
}

function odm_env(string $key, array $localConfig, string $default = ''): string {
    if (isset($localConfig[$key]) && is_string($localConfig[$key])) {
        return $localConfig[$key];
    }
    $val = getenv($key);
    return $val !== false ? $val : $default;
}

define('ODM_DB_HOST', odm_env('ODM_DB_HOST', $localConfig, '127.0.0.1'));
define('ODM_DB_PORT', odm_env('ODM_DB_PORT', $localConfig, '3306'));
define('ODM_DB_NAME', odm_env('ODM_DB_NAME', $localConfig, 'odm_db'));
define('ODM_DB_USER', odm_env('ODM_DB_USER', $localConfig, 'root'));
define('ODM_DB_PASS', odm_env('ODM_DB_PASS', $localConfig, ''));
define('ODM_ADMIN_PASSWORD', odm_env('ODM_ADMIN_PASSWORD', $localConfig, ''));
define('ODM_SESSION_SECRET', odm_env('ODM_SESSION_SECRET', $localConfig, ''));

function odm_pdo(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        ODM_DB_HOST,
        ODM_DB_PORT,
        ODM_DB_NAME
    );

    $pdo = new PDO($dsn, ODM_DB_USER, ODM_DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
