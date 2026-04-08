<?php
/**
 * Install Controller
 * Handles Automated Database and Table Creation via MVC Router
 */

class InstallController extends Controller {

    private function ensureSchema(PDO $pdo) {
        // RBAC tables
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                perm_key VARCHAR(100) NOT NULL UNIQUE,
                description VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INT NOT NULL,
                permission_id INT NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            )
        ");

        // Seed roles
        $pdo->exec("INSERT IGNORE INTO roles (name) VALUES ('Admin'), ('Workshop Officer'), ('Factory Officer')");

        // Core auth + logging tables
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_users_role (role_id),
                FOREIGN KEY (role_id) REFERENCES roles(id)
            )
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                action VARCHAR(100) NOT NULL,
                entity VARCHAR(100) NOT NULL,
                entity_id BIGINT NULL,
                method VARCHAR(10) NOT NULL,
                path VARCHAR(255) NOT NULL,
                ip VARCHAR(64) NULL,
                user_agent VARCHAR(255) NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_user (user_id),
                INDEX idx_audit_entity (entity, entity_id),
                INDEX idx_audit_action (action),
                INDEX idx_audit_created (created_at)
            )
        ");

        // Migrate existing installs: add role_id and backfill from legacy users.role if present.
        $hasRoleId = false;
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'role_id'");
            $hasRoleId = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $hasRoleId = false;
        }
        if (!$hasRoleId) {
            // Add nullable first so we can backfill without failing.
            $pdo->exec("ALTER TABLE users ADD COLUMN role_id INT NULL");
        }
        // Ensure role_id has values.
        $hasLegacyRoleCol = false;
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'");
            $hasLegacyRoleCol = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $hasLegacyRoleCol = false;
        }
        if ($hasLegacyRoleCol) {
            $pdo->exec("
                UPDATE users u
                INNER JOIN roles r ON r.name = COALESCE(u.role, 'Workshop Officer')
                SET u.role_id = r.id
                WHERE u.role_id IS NULL
            ");

            // After migrating, drop the legacy `role` column so users table relies only on role_id.
            // (Safe to ignore errors if column is already gone or constrained.)
            try { $pdo->exec("ALTER TABLE users DROP COLUMN role"); } catch (Exception $e) {}
        } else {
            $pdo->exec("
                UPDATE users u
                INNER JOIN roles r ON r.name = 'Workshop Officer'
                SET u.role_id = r.id
                WHERE u.role_id IS NULL
            ");
        }
        // Make role_id NOT NULL + add FK if we just added it.
        if (!$hasRoleId) {
            $pdo->exec("ALTER TABLE users MODIFY role_id INT NOT NULL");
            // Add index/fk defensively (may already exist).
            try { $pdo->exec("ALTER TABLE users ADD INDEX idx_users_role (role_id)"); } catch (Exception $e) {}
            try { $pdo->exec("ALTER TABLE users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)"); } catch (Exception $e) {}
        }

        // Seed permissions (Admin is treated as superuser in code, but we still keep a list here)
        $pdo->exec("
            INSERT IGNORE INTO permissions (perm_key, description) VALUES
            ('orders.read', 'View repair orders'),
            ('orders.write', 'Create/update repair orders'),
            ('vehicles.read', 'View vehicles'),
            ('vehicles.write', 'Create/update/delete vehicles'),
            ('bays.read', 'View service bays'),
            ('bays.write', 'Create/update/delete bays and update status'),
            ('technicians.read', 'View technicians'),
            ('technicians.write', 'Create/update/delete technicians'),
            ('makes.read', 'View vehicle makes'),
            ('makes.write', 'Create/update/delete vehicle makes'),
            ('models.read', 'View vehicle models'),
            ('models.write', 'Create/update/delete vehicle models'),
            ('categories.read', 'View repair categories'),
            ('categories.write', 'Create/update/delete repair categories'),
            ('checklists.read', 'View checklist items'),
            ('checklists.write', 'Create/update/delete checklist items'),
            ('reports.read', 'View reports')
        ");

        // Seed role permissions (Admin is superuser; mappings below are for non-admin roles)
        $roleId = function($name) use ($pdo) {
            $stmt = $pdo->prepare("SELECT id FROM roles WHERE name = ? LIMIT 1");
            $stmt->execute([$name]);
            return (int)$stmt->fetchColumn();
        };
        $permId = function($key) use ($pdo) {
            $stmt = $pdo->prepare("SELECT id FROM permissions WHERE perm_key = ? LIMIT 1");
            $stmt->execute([$key]);
            return (int)$stmt->fetchColumn();
        };
        $grant = function($roleName, $permKey) use ($pdo, $roleId, $permId) {
            $rid = $roleId($roleName);
            $pid = $permId($permKey);
            if ($rid && $pid) {
                $stmt = $pdo->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
                $stmt->execute([$rid, $pid]);
            }
        };

        // Workshop Officer: broad operational access (no make/model writes by default)
        foreach (['orders.read','orders.write','vehicles.read','vehicles.write','bays.read','bays.write','technicians.read','categories.read','checklists.read','reports.read'] as $p) {
            $grant('Workshop Officer', $p);
        }
        foreach (['makes.read','models.read'] as $p) {
            $grant('Workshop Officer', $p);
        }

        // Factory Officer: read-mostly, can update orders
        foreach (['orders.read','orders.write','vehicles.read','bays.read','technicians.read','makes.read','models.read','categories.read','checklists.read','reports.read'] as $p) {
            $grant('Factory Officer', $p);
        }

        // Ensure a default admin user exists for development.
        $rid = (int)$pdo->query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1")->fetchColumn();
        if (!$rid) {
            $pdo->exec("INSERT IGNORE INTO roles (name) VALUES ('Admin')");
            $rid = (int)$pdo->query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1")->fetchColumn();
        }
        $stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1");
        $stmt->execute(['admin@local']);
        $adminRow = $stmt->fetch(PDO::FETCH_ASSOC);
        $desiredHash = password_hash('admin123', PASSWORD_BCRYPT);
        if (!$adminRow) {
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)");
            $stmt->execute(['Admin', 'admin@local', $desiredHash, $rid]);
        } else {
            // If the password doesn't match, reset to the default dev password.
            $currentHash = (string)($adminRow['password_hash'] ?? '');
            $needsReset = !$currentHash || !password_verify('admin123', $currentHash);
            if ($needsReset) {
                $stmt = $pdo->prepare("UPDATE users SET password_hash = ?, role_id = ? WHERE id = ?");
                $stmt->execute([$desiredHash, $rid, (int)$adminRow['id']]);
            } else {
                $stmt = $pdo->prepare("UPDATE users SET role_id = ? WHERE id = ?");
                $stmt->execute([$rid, (int)$adminRow['id']]);
            }
        }

        // Ensure created_by/updated_by columns exist across tables in existing databases.
        $tables = [
            'repair_orders',
            'parts',
            'order_parts',
            'technicians',
            'service_bays',
            'repair_categories',
            'checklist_items',
            'vehicles',
            'vehicle_makes',
            'vehicle_models',
            'checklist_templates'
        ];
        foreach ($tables as $t) {
            // Create checklist_templates if missing (older installs)
            if ($t === 'checklist_templates') {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS checklist_templates (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        description TEXT NOT NULL,
                        created_by INT NULL,
                        updated_by INT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                ");
            }
            foreach (['created_by', 'updated_by'] as $col) {
                $stmt = $pdo->prepare("
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
                ");
                $stmt->execute([DB_NAME, $t, $col]);
                $exists = (int)$stmt->fetchColumn() > 0;
                if (!$exists) {
                    // Keep nullable to avoid breaking existing seed data.
                    $pdo->exec("ALTER TABLE {$t} ADD COLUMN {$col} INT NULL");
                }
            }
        }
    }

    public function index() {
        $response = [
            'status' => 'pending',
            'steps' => []
        ];

        try {
            // 1. Connect to MySQL (No DB selected)
            $dsn = "mysql:host=" . DB_HOST;
            $pdo = new PDO($dsn, DB_USER, DB_PASS);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $response['steps'][] = ['name' => 'Connection', 'status' => 'success', 'message' => 'Connected to MySQL server'];

            if ($_SERVER['REQUEST_METHOD'] == 'POST') {
                // 2. Create Database
                $pdo->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME);
                $response['steps'][] = ['name' => 'Database', 'status' => 'success', 'message' => 'Database ' . DB_NAME . ' created or already exists'];

                // 3. Switch to Database
                $pdo->exec("USE " . DB_NAME);

                // 4. Read database.sql
                // Note: We need to go up from controllers/ to apps/ then server root
                $sqlPath = APPROOT . '/database.sql';
                
                if (file_exists($sqlPath)) {
                    $sql = file_get_contents($sqlPath);
                    
                    // Split by semicolon and filter out empty statements
                    $statements = array_filter(array_map('trim', explode(';', $sql)));
                    
                    foreach ($statements as $statement) {
                        if (!empty($statement)) {
                            $pdo->exec($statement);
                        }
                    }

                    // Ensure auth + logging tables exist and are seeded.
                    $this->ensureSchema($pdo);
                    
                    $response['steps'][] = ['name' => 'Tables', 'status' => 'success', 'message' => 'Tables created and mock data inserted successfully'];
                    
                    $response['status'] = 'success';
                    $response['message'] = 'Installation completed successfully!';
                } else {
                    throw new Exception('database.sql file not found at ' . $sqlPath);
                }
            } else {
                // GET request - Check status
                $stmt = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '" . DB_NAME . "'");
                $dbExists = (bool)$stmt->fetchColumn();
                
                $response['status'] = 'ready';
                $response['exists'] = $dbExists;
                $response['message'] = $dbExists ? 'Database already exists.' : 'System is ready for installation.';
            }

        } catch (Exception $e) {
            $response['status'] = 'error';
            $response['message'] = $e->getMessage();
            $response['steps'][] = ['name' => 'Error', 'status' => 'failed', 'message' => $e->getMessage()];
        }

        $this->json($response);
    }
}
