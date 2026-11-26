<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/config.php';

function json_response(int $status, mixed $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function uuid_v4(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function iso_timestamp(?string $mysqlTs): ?string {
    if ($mysqlTs === null || $mysqlTs === '') {
        return null;
    }
    $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $mysqlTs, new DateTimeZone('UTC'));
    if ($dt === false) {
        return $mysqlTs;
    }
    return $dt->format(DateTimeInterface::ATOM);
}

function get_session_secret(PDO $pdo): string {
    if (ODM_SESSION_SECRET !== '') {
        return ODM_SESSION_SECRET;
    }
    $stmt = $pdo->query('SELECT session_secret FROM app_settings WHERE id = 1');
    $row = $stmt->fetch();
    if ($row && !empty($row['session_secret'])) {
        return (string) $row['session_secret'];
    }
    $secret = bin2hex(random_bytes(32));
    $upd = $pdo->prepare('UPDATE app_settings SET session_secret = ? WHERE id = 1');
    $upd->execute([$secret]);
    return $secret;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string|false {
    $padded = str_pad(strtr($data, '-_', '+/'), strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + 4 - (strlen($data) % 4), '=');
    return base64_decode($padded, true);
}

function issue_token(PDO $pdo): string {
    $payload = base64url_encode(json_encode([
        'sub' => 'admin',
        'jti' => uuid_v4(),
        'exp' => time() + (60 * 60 * 12),
    ], JSON_THROW_ON_ERROR));
    $sig = base64url_encode(hash_hmac('sha256', $payload, get_session_secret($pdo), true));
    return $payload . '.' . $sig;
}

function extract_bearer_token(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if ($auth === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strcasecmp((string) $k, 'Authorization') === 0) {
                $auth = (string) $v;
                break;
            }
        }
    }
    if (!str_starts_with($auth, 'Bearer ')) {
        return null;
    }
    $token = trim(substr($auth, 7));
    return $token !== '' ? $token : null;
}

function verify_token(PDO $pdo, ?string $token): bool {
    if ($token === null) {
        return false;
    }
    $dot = strpos($token, '.');
    if ($dot === false || $dot === 0) {
        return false;
    }
    $payload = substr($token, 0, $dot);
    $sig = substr($token, $dot + 1);
    $expected = base64url_encode(hash_hmac('sha256', $payload, get_session_secret($pdo), true));
    if (!hash_equals($expected, $sig)) {
        return false;
    }
    $decoded = base64url_decode($payload);
    if ($decoded === false) {
        return false;
    }
    $claims = json_decode($decoded, true);
    if (!is_array($claims)) {
        return false;
    }
    return ($claims['sub'] ?? null) === 'admin' && is_int($claims['exp'] ?? null) && $claims['exp'] >= time();
}

function require_auth(PDO $pdo): void {
    if (!verify_token($pdo, extract_bearer_token())) {
        json_response(401, ['error' => 'Unauthorized']);
    }
}

function verify_admin_password(PDO $pdo, string $password): bool {
    if (ODM_ADMIN_PASSWORD !== '') {
        return hash_equals(ODM_ADMIN_PASSWORD, $password);
    }
    $stmt = $pdo->query('SELECT admin_password_hash FROM app_settings WHERE id = 1');
    $row = $stmt->fetch();
    if (!$row || empty($row['admin_password_hash'])) {
        return false;
    }
    return password_verify($password, (string) $row['admin_password_hash']);
}

function clean_text(mixed $val): string {
    return is_string($val) ? trim($val) : '';
}

function clean_optional_text(mixed $val): ?string {
    if (!is_string($val)) {
        return null;
    }
    $trimmed = trim($val);
    return $trimmed !== '' ? $trimmed : null;
}

function is_valid_date(string $val): bool {
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $val) === 1;
}

function hydrate_mission_order_row(array $row): array {
    return [
        'id' => $row['id'],
        'order_number' => $row['order_number'],
        'employee_id' => $row['employee_id'],
        'vehicle_id' => $row['vehicle_id'],
        'project_id' => $row['project_id'],
        'destination' => $row['destination'],
        'start_date' => $row['start_date'],
        'end_date' => $row['end_date'],
        'status' => $row['status'],
        'authorized_by' => $row['authorized_by'],
        'notes' => $row['notes'],
        'created_at' => iso_timestamp($row['created_at']),
        'employee' => [
            'id' => $row['emp_id'],
            'first_name' => $row['emp_first_name'],
            'last_name' => $row['emp_last_name'],
            'position' => $row['emp_position'],
            'created_at' => iso_timestamp($row['emp_created_at']),
        ],
        'vehicle' => [
            'id' => $row['veh_id'],
            'model' => $row['veh_model'],
            'registration_plate' => $row['veh_registration_plate'],
            'created_at' => iso_timestamp($row['veh_created_at']),
        ],
        'project' => $row['proj_id'] !== null ? [
            'id' => $row['proj_id'],
            'name' => $row['proj_name'],
            'description' => $row['proj_description'],
            'created_at' => iso_timestamp($row['proj_created_at']),
        ] : null,
    ];
}

function fetch_mission_order_by_id(PDO $pdo, string $id): ?array {
    $sql = '
        SELECT
            mo.*,
            e.id AS emp_id, e.first_name AS emp_first_name, e.last_name AS emp_last_name,
            e.position AS emp_position, e.created_at AS emp_created_at,
            v.id AS veh_id, v.model AS veh_model, v.registration_plate AS veh_registration_plate,
            v.created_at AS veh_created_at,
            p.id AS proj_id, p.name AS proj_name, p.description AS proj_description,
            p.created_at AS proj_created_at
        FROM mission_orders mo
        INNER JOIN employees e ON e.id = mo.employee_id
        INNER JOIN vehicles v ON v.id = mo.vehicle_id
        LEFT JOIN projects p ON p.id = mo.project_id
        WHERE mo.id = ?
    ';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? hydrate_mission_order_row($row) : null;
}

function resolve_api_route(): string {
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $apiPos = strrpos($uriPath, '/api/');
    if ($apiPos !== false) {
        return '/' . trim(substr($uriPath, $apiPos + 5), '/');
    }
    if (str_ends_with($uriPath, '/api')) {
        return '/';
    }
    return '/' . trim((string) ($_GET['route'] ?? ''), '/');
}

try {
    $pdo = odm_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $route = resolve_api_route();

    if ($route === '/health' && $method === 'GET') {
        json_response(200, ['ok' => true, 'backend' => 'php-mysql']);
    }

    if ($route === '/auth/status' && $method === 'GET') {
        $stmt = $pdo->query('SELECT admin_password_hash, admin_password_set_at FROM app_settings WHERE id = 1');
        $row = $stmt->fetch() ?: ['admin_password_hash' => null, 'admin_password_set_at' => null];
        $envOverride = ODM_ADMIN_PASSWORD !== '';
        $needsSetup = !$envOverride && empty($row['admin_password_hash']);
        json_response(200, [
            'needsSetup' => $needsSetup,
            'envOverride' => $envOverride,
            'passwordSetAt' => iso_timestamp($row['admin_password_set_at'] ?? null),
        ]);
    }

    if ($route === '/auth/setup' && $method === 'POST') {
        if (ODM_ADMIN_PASSWORD !== '') {
            json_response(409, ['error' => 'Admin password is already configured']);
        }
        $body = read_json_body();
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        if (strlen($password) < 6) {
            json_response(400, ['error' => 'Password must be at least 6 characters']);
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $upd = $pdo->prepare('UPDATE app_settings SET admin_password_hash = ?, admin_password_set_at = NOW() WHERE id = 1 AND admin_password_hash IS NULL');
        $upd->execute([$hash]);
        if ($upd->rowCount() === 0) {
            json_response(409, ['error' => 'Admin password is already configured']);
        }
        $row = $pdo->query('SELECT admin_password_set_at FROM app_settings WHERE id = 1')->fetch();
        json_response(201, [
            'token' => issue_token($pdo),
            'passwordSetAt' => iso_timestamp($row['admin_password_set_at'] ?? null),
        ]);
    }

    if ($route === '/auth/login' && $method === 'POST') {
        $body = read_json_body();
        $username = clean_text($body['username'] ?? '');
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        if ($username !== 'admin' || $password === '' || !verify_admin_password($pdo, $password)) {
            json_response(401, ['error' => 'Invalid username or password']);
        }
        $row = $pdo->query('SELECT admin_password_set_at FROM app_settings WHERE id = 1')->fetch();
        json_response(200, [
            'token' => issue_token($pdo),
            'passwordSetAt' => iso_timestamp($row['admin_password_set_at'] ?? null),
        ]);
    }

    if ($route === '/auth/logout' && $method === 'POST') {
        json_response(200, ['ok' => true]);
    }

    // All endpoints below require a valid Bearer token
    require_auth($pdo);

    if ($route === '/settings' && $method === 'GET') {
        $row = $pdo->query('SELECT admin_password_set_at FROM app_settings WHERE id = 1')->fetch();
        json_response(200, [
            'admin_password_set_at' => iso_timestamp($row['admin_password_set_at'] ?? null),
            'envOverride' => ODM_ADMIN_PASSWORD !== '',
        ]);
    }

    if ($route === '/settings/password' && $method === 'PUT') {
        if (ODM_ADMIN_PASSWORD !== '') {
            json_response(400, [
                'error' => 'Admin password is managed by server environment configuration',
                'code' => 'ENV_MANAGED',
            ]);
        }
        $body = read_json_body();
        $currentPassword = is_string($body['currentPassword'] ?? null) ? $body['currentPassword'] : '';
        $newPassword = is_string($body['newPassword'] ?? null) ? $body['newPassword'] : '';
        if (!verify_admin_password($pdo, $currentPassword)) {
            json_response(400, ['error' => 'Current password is incorrect', 'code' => 'WRONG_PASSWORD']);
        }
        if (strlen($newPassword) < 6) {
            json_response(400, ['error' => 'Password must be at least 6 characters']);
        }
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $upd = $pdo->prepare('UPDATE app_settings SET admin_password_hash = ?, admin_password_set_at = NOW() WHERE id = 1');
        $upd->execute([$hash]);
        $row = $pdo->query('SELECT admin_password_set_at FROM app_settings WHERE id = 1')->fetch();
        json_response(200, [
            'admin_password_set_at' => iso_timestamp($row['admin_password_set_at'] ?? null),
        ]);
    }

    // Employees
    if ($route === '/employees' && $method === 'GET') {
        $rows = $pdo->query('SELECT id, first_name, last_name, position, created_at FROM employees ORDER BY last_name ASC')->fetchAll();
        foreach ($rows as &$r) {
            $r['created_at'] = iso_timestamp($r['created_at']);
        }
        json_response(200, $rows);
    }

    if ($route === '/employees' && $method === 'POST') {
        $body = read_json_body();
        $first = clean_text($body['first_name'] ?? '');
        $last = clean_text($body['last_name'] ?? '');
        $pos = clean_text($body['position'] ?? '');
        if ($first === '' || $last === '' || $pos === '') {
            json_response(400, ['error' => 'First name, last name, and position are required']);
        }
        $id = uuid_v4();
        $stmt = $pdo->prepare('INSERT INTO employees (id, first_name, last_name, position) VALUES (?, ?, ?, ?)');
        $stmt->execute([$id, $first, $last, $pos]);
        $sel = $pdo->prepare('SELECT id, first_name, last_name, position, created_at FROM employees WHERE id = ?');
        $sel->execute([$id]);
        $row = $sel->fetch();
        $row['created_at'] = iso_timestamp($row['created_at']);
        json_response(201, $row);
    }

    if (preg_match('#^/employees/([a-f0-9-]+)$#i', $route, $m)) {
        $id = $m[1];
        if ($method === 'PUT') {
            $body = read_json_body();
            $first = clean_text($body['first_name'] ?? '');
            $last = clean_text($body['last_name'] ?? '');
            $pos = clean_text($body['position'] ?? '');
            if ($first === '' || $last === '' || $pos === '') {
                json_response(400, ['error' => 'First name, last name, and position are required']);
            }
            $upd = $pdo->prepare('UPDATE employees SET first_name = ?, last_name = ?, position = ? WHERE id = ?');
            $upd->execute([$first, $last, $pos, $id]);
            $sel = $pdo->prepare('SELECT id, first_name, last_name, position, created_at FROM employees WHERE id = ?');
            $sel->execute([$id]);
            $row = $sel->fetch();
            if (!$row) {
                json_response(404, ['error' => 'Employee not found']);
            }
            $row['created_at'] = iso_timestamp($row['created_at']);
            json_response(200, $row);
        }
        if ($method === 'DELETE') {
            try {
                $del = $pdo->prepare('DELETE FROM employees WHERE id = ?');
                $del->execute([$id]);
                if ($del->rowCount() === 0) {
                    json_response(404, ['error' => 'Employee not found']);
                }
                json_response(200, ['ok' => true]);
            } catch (PDOException $e) {
                if ((string) $e->getCode() === '23000') {
                    json_response(409, ['error' => 'Employee is referenced by existing mission orders']);
                }
                throw $e;
            }
        }
    }

    // Vehicles
    if ($route === '/vehicles' && $method === 'GET') {
        $rows = $pdo->query('SELECT id, model, registration_plate, created_at FROM vehicles ORDER BY model ASC')->fetchAll();
        foreach ($rows as &$r) {
            $r['created_at'] = iso_timestamp($r['created_at']);
        }
        json_response(200, $rows);
    }

    if ($route === '/vehicles' && $method === 'POST') {
        $body = read_json_body();
        $model = clean_text($body['model'] ?? '');
        $plate = clean_text($body['registration_plate'] ?? '');
        if ($model === '' || $plate === '') {
            json_response(400, ['error' => 'Vehicle model and registration plate are required']);
        }
        $id = uuid_v4();
        $stmt = $pdo->prepare('INSERT INTO vehicles (id, model, registration_plate) VALUES (?, ?, ?)');
        $stmt->execute([$id, $model, $plate]);
        $sel = $pdo->prepare('SELECT id, model, registration_plate, created_at FROM vehicles WHERE id = ?');
        $sel->execute([$id]);
        $row = $sel->fetch();
        $row['created_at'] = iso_timestamp($row['created_at']);
        json_response(201, $row);
    }

    if (preg_match('#^/vehicles/([a-f0-9-]+)$#i', $route, $m)) {
        $id = $m[1];
        if ($method === 'PUT') {
            $body = read_json_body();
            $model = clean_text($body['model'] ?? '');
            $plate = clean_text($body['registration_plate'] ?? '');
            if ($model === '' || $plate === '') {
                json_response(400, ['error' => 'Vehicle model and registration plate are required']);
            }
            $upd = $pdo->prepare('UPDATE vehicles SET model = ?, registration_plate = ? WHERE id = ?');
            $upd->execute([$model, $plate, $id]);
            $sel = $pdo->prepare('SELECT id, model, registration_plate, created_at FROM vehicles WHERE id = ?');
            $sel->execute([$id]);
            $row = $sel->fetch();
            if (!$row) {
                json_response(404, ['error' => 'Vehicle not found']);
            }
            $row['created_at'] = iso_timestamp($row['created_at']);
            json_response(200, $row);
        }
        if ($method === 'DELETE') {
            try {
                $del = $pdo->prepare('DELETE FROM vehicles WHERE id = ?');
                $del->execute([$id]);
                if ($del->rowCount() === 0) {
                    json_response(404, ['error' => 'Vehicle not found']);
                }
                json_response(200, ['ok' => true]);
            } catch (PDOException $e) {
                if ((string) $e->getCode() === '23000') {
                    json_response(409, ['error' => 'Vehicle is referenced by existing mission orders']);
                }
                throw $e;
            }
        }
    }

    // Projects
    if ($route === '/projects' && $method === 'GET') {
        $sql = '
            SELECT p.id, p.name, p.description, p.created_at, COUNT(mo.id) AS mission_count
            FROM projects p
            LEFT JOIN mission_orders mo ON mo.project_id = p.id
            GROUP BY p.id, p.name, p.description, p.created_at
            ORDER BY p.name ASC
        ';
        $rows = $pdo->query($sql)->fetchAll();
        foreach ($rows as &$r) {
            $r['mission_count'] = (int) $r['mission_count'];
            $r['created_at'] = iso_timestamp($r['created_at']);
        }
        json_response(200, $rows);
    }

    if ($route === '/projects' && $method === 'POST') {
        $body = read_json_body();
        $name = clean_text($body['name'] ?? '');
        $desc = clean_optional_text($body['description'] ?? null);
        if ($name === '') {
            json_response(400, ['error' => 'Project name is required']);
        }
        $id = uuid_v4();
        $stmt = $pdo->prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)');
        $stmt->execute([$id, $name, $desc]);
        $sel = $pdo->prepare('SELECT id, name, description, created_at FROM projects WHERE id = ?');
        $sel->execute([$id]);
        $row = $sel->fetch();
        $row['created_at'] = iso_timestamp($row['created_at']);
        $row['mission_count'] = 0;
        json_response(201, $row);
    }

    if (preg_match('#^/projects/([a-f0-9-]+)$#i', $route, $m)) {
        $id = $m[1];
        if ($method === 'PUT') {
            $body = read_json_body();
            $name = clean_text($body['name'] ?? '');
            $desc = clean_optional_text($body['description'] ?? null);
            if ($name === '') {
                json_response(400, ['error' => 'Project name is required']);
            }
            $upd = $pdo->prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?');
            $upd->execute([$name, $desc, $id]);
            $sel = $pdo->prepare('
                SELECT p.id, p.name, p.description, p.created_at, COUNT(mo.id) AS mission_count
                FROM projects p
                LEFT JOIN mission_orders mo ON mo.project_id = p.id
                WHERE p.id = ?
                GROUP BY p.id, p.name, p.description, p.created_at
            ');
            $sel->execute([$id]);
            $row = $sel->fetch();
            if (!$row) {
                json_response(404, ['error' => 'Project not found']);
            }
            $row['mission_count'] = (int) $row['mission_count'];
            $row['created_at'] = iso_timestamp($row['created_at']);
            json_response(200, $row);
        }
        if ($method === 'DELETE') {
            $del = $pdo->prepare('DELETE FROM projects WHERE id = ?');
            $del->execute([$id]);
            if ($del->rowCount() === 0) {
                json_response(404, ['error' => 'Project not found']);
            }
            json_response(200, ['ok' => true]);
        }
    }

    // Mission Orders
    if ($route === '/mission-orders' && $method === 'GET') {
        $orderBy = ($_GET['orderBy'] ?? '') === 'start_date' ? 'mo.start_date DESC' : 'mo.created_at DESC';
        $sql = "
            SELECT
                mo.*,
                e.id AS emp_id, e.first_name AS emp_first_name, e.last_name AS emp_last_name,
                e.position AS emp_position, e.created_at AS emp_created_at,
                v.id AS veh_id, v.model AS veh_model, v.registration_plate AS veh_registration_plate,
                v.created_at AS veh_created_at,
                p.id AS proj_id, p.name AS proj_name, p.description AS proj_description,
                p.created_at AS proj_created_at
            FROM mission_orders mo
            INNER JOIN employees e ON e.id = mo.employee_id
            INNER JOIN vehicles v ON v.id = mo.vehicle_id
            LEFT JOIN projects p ON p.id = mo.project_id
            ORDER BY {$orderBy}
        ";
        $rows = $pdo->query($sql)->fetchAll();
        $result = array_map('hydrate_mission_order_row', $rows);
        json_response(200, $result);
    }

    if ($route === '/mission-orders' && $method === 'POST') {
        $body = read_json_body();
        $employeeId = clean_text($body['employee_id'] ?? '');
        $vehicleId = clean_text($body['vehicle_id'] ?? '');
        $projectId = clean_optional_text($body['project_id'] ?? null);
        $destination = clean_text($body['destination'] ?? '');
        $startDate = clean_text($body['start_date'] ?? '');
        $endDate = clean_text($body['end_date'] ?? '');
        $status = $body['status'] ?? 'issued';
        $authorizedBy = $body['authorized_by'] ?? null;
        if ($authorizedBy === '') {
            $authorizedBy = null;
        }
        $notes = clean_optional_text($body['notes'] ?? null);

        if (
            $employeeId === '' ||
            $vehicleId === '' ||
            $destination === '' ||
            !is_valid_date($startDate) ||
            !is_valid_date($endDate) ||
            $endDate < $startDate ||
            !in_array($status, ['draft', 'issued', 'archived'], true) ||
            !in_array($authorizedBy, [null, 'operations', 'administration'], true)
        ) {
            json_response(400, ['error' => 'Invalid mission order payload']);
        }

        $pdo->beginTransaction();
        try {
            $year = (int) date('Y');
            $insSeq = $pdo->prepare('INSERT INTO order_sequences (year_num, last_seq) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_seq = last_seq + 1');
            $insSeq->execute([$year]);
            $seqStmt = $pdo->prepare('SELECT last_seq FROM order_sequences WHERE year_num = ?');
            $seqStmt->execute([$year]);
            $seqRow = $seqStmt->fetch();
            $seqNum = (int) ($seqRow['last_seq'] ?? 1);
            $orderNumber = sprintf('MO-%d-%03d', $year, $seqNum);

            $id = uuid_v4();
            $insOrder = $pdo->prepare('
                INSERT INTO mission_orders (id, order_number, employee_id, vehicle_id, project_id, destination, start_date, end_date, status, authorized_by, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $insOrder->execute([
                $id,
                $orderNumber,
                $employeeId,
                $vehicleId,
                $projectId,
                $destination,
                $startDate,
                $endDate,
                $status,
                $authorizedBy,
                $notes,
            ]);
            $pdo->commit();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ((string) $e->getCode() === '23000') {
                json_response(400, ['error' => 'Invalid employee, vehicle, or project reference']);
            }
            throw $e;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $created = fetch_mission_order_by_id($pdo, $id);
        json_response(201, $created);
    }

    if (preg_match('#^/mission-orders/([a-f0-9-]+)$#i', $route, $m)) {
        $id = $m[1];
        if ($method === 'PUT') {
            $body = read_json_body();
            $employeeId = clean_text($body['employee_id'] ?? '');
            $vehicleId = clean_text($body['vehicle_id'] ?? '');
            $projectId = clean_optional_text($body['project_id'] ?? null);
            $destination = clean_text($body['destination'] ?? '');
            $startDate = clean_text($body['start_date'] ?? '');
            $endDate = clean_text($body['end_date'] ?? '');
            $status = $body['status'] ?? 'issued';
            $authorizedBy = $body['authorized_by'] ?? null;
            if ($authorizedBy === '') {
                $authorizedBy = null;
            }
            $notes = clean_optional_text($body['notes'] ?? null);

            if (
                $employeeId === '' ||
                $vehicleId === '' ||
                $destination === '' ||
                !is_valid_date($startDate) ||
                !is_valid_date($endDate) ||
                $endDate < $startDate ||
                !in_array($status, ['draft', 'issued', 'archived'], true) ||
                !in_array($authorizedBy, [null, 'operations', 'administration'], true)
            ) {
                json_response(400, ['error' => 'Invalid mission order payload']);
            }

            try {
                $upd = $pdo->prepare('
                    UPDATE mission_orders
                    SET employee_id = ?, vehicle_id = ?, project_id = ?, destination = ?,
                        start_date = ?, end_date = ?, status = ?, authorized_by = ?, notes = ?
                    WHERE id = ?
                ');
                $upd->execute([
                    $employeeId,
                    $vehicleId,
                    $projectId,
                    $destination,
                    $startDate,
                    $endDate,
                    $status,
                    $authorizedBy,
                    $notes,
                    $id,
                ]);
            } catch (PDOException $e) {
                if ((string) $e->getCode() === '23000') {
                    json_response(400, ['error' => 'Invalid employee, vehicle, or project reference']);
                }
                throw $e;
            }
            $updated = fetch_mission_order_by_id($pdo, $id);
            if (!$updated) {
                json_response(404, ['error' => 'Mission order not found']);
            }
            json_response(200, $updated);
        }
        if ($method === 'DELETE') {
            $del = $pdo->prepare('DELETE FROM mission_orders WHERE id = ?');
            $del->execute([$id]);
            if ($del->rowCount() === 0) {
                json_response(404, ['error' => 'Mission order not found']);
            }
            json_response(200, ['ok' => true]);
        }
    }

    json_response(404, ['error' => 'Not found']);
} catch (PDOException $e) {
    json_response(500, ['error' => 'Database error: ' . $e->getMessage()]);
} catch (Throwable $e) {
    json_response(500, ['error' => 'Server error']);
}
