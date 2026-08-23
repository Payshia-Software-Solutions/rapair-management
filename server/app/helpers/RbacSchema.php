<?php
/**
 * RbacSchema Helper
 * Ensures all RBAC permissions, core roles, and mappings are fully seeded in the database.
 */
class RbacSchema {
    public static function ensure() {
        try {
            $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Ensure permissions table exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS permissions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    perm_key VARCHAR(100) NOT NULL UNIQUE,
                    description VARCHAR(255) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");

            // Ensure roles table exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS roles (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(50) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");

            // Ensure role_permissions table exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS role_permissions (
                    role_id INT NOT NULL,
                    permission_id INT NOT NULL,
                    PRIMARY KEY (role_id, permission_id),
                    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
                )
            ");

            // Ensure core roles
            $coreRoles = ['Admin', 'Workshop Officer', 'Factory Officer'];
            $roleStmt = $pdo->prepare("INSERT IGNORE INTO roles (name) VALUES (?)");
            foreach ($coreRoles as $r) {
                $roleStmt->execute([$r]);
            }

            // Complete catalog of system permissions
            $permissions = [
                // Core / Reports / POS
                ['reports.read', 'View dashboards, analytics, and business intelligence reports'],
                ['pos.read', 'View POS terminal and sales transactions'],
                ['pos.write', 'Process POS sales, refunds, and discounts'],
                
                // Fleet & Service Management
                ['orders.read', 'View repair and banquet service orders'],
                ['orders.write', 'Create, update, and manage repair and banquet orders'],
                ['vehicles.read', 'View vehicle registry, documents, and fuel logs'],
                ['vehicles.write', 'Create, update, and delete vehicle and fuel records'],
                ['bays.read', 'View service bays and restaurant table boards'],
                ['bays.write', 'Create, update, and manage service bays and restaurant tables'],
                ['technicians.read', 'View technician profiles and assignments'],
                ['technicians.write', 'Create, update, and manage technicians'],
                ['makes.read', 'View vehicle makes'],
                ['makes.write', 'Manage vehicle makes'],
                ['models.read', 'View vehicle models'],
                ['models.write', 'Manage vehicle models'],
                ['categories.read', 'View repair and service categories'],
                ['categories.write', 'Manage repair and service categories'],
                ['checklists.read', 'View vehicle inspection checklist items and templates'],
                ['checklists.write', 'Manage vehicle inspection checklists and templates'],
                
                // Inventory & Supply Chain
                ['parts.read', 'View item master, parts inventory, and room rates'],
                ['parts.write', 'Create, update, and manage items, parts, and rooms'],
                ['suppliers.read', 'View suppliers and vendors'],
                ['suppliers.write', 'Create, update, and manage suppliers and vendors'],
                ['purchase.read', 'View purchase orders'],
                ['purchase.write', 'Create, approve, and manage purchase orders'],
                ['grn.read', 'View Goods Receive Notes (GRN)'],
                ['grn.write', 'Create and manage Goods Receive Notes (GRN)'],
                ['stock.read', 'View stock movements, counts, and balance levels'],
                ['stock.adjust', 'Perform stock adjustments and commit counts'],
                ['transfer.read', 'View stock transfer requests and requisitions'],
                ['transfer.write', 'Create, approve, and fulfill stock transfer requests'],
                
                // CRM & Inquiries
                ['customers.read', 'View customer directories, vehicles, and delivery routes'],
                ['customers.write', 'Create, update, and manage customers and routes'],
                ['crm.inquiries.view', 'View CRM sales leads and customer inquiries'],
                ['crm.inquiries.write', 'Create and update customer inquiries'],
                ['crm.inquiries.manage', 'Assign and advance inquiry lifecycle status'],
                ['crm.inquiries.delete', 'Delete CRM inquiry records'],
                
                // Sales & Invoicing
                ['sales.read', 'View sales targets, quotations, and commercial proposals'],
                ['sales.create', 'Create sales quotes and estimates'],
                ['sales.update', 'Update and negotiate sales quotes'],
                ['sales.write', 'Manage sales targets and commercial terms'],
                ['invoices.read', 'View customer invoices, recurring billing, and e-commerce orders'],
                ['invoices.write', 'Issue, cancel, and manage invoices and order statuses'],
                ['invoices.create', 'Create and draft new invoices'],
                ['payments.read', 'View payment receipts, cheque registry, and ledger credits'],
                ['payments.write', 'Record customer payments and manage cheque statuses'],
                
                // Marketing & Promotions
                ['promotions.read', 'View promotions, SMS campaigns, and email marketing templates'],
                ['promotions.write', 'Create and execute SMS/email campaigns and discounts'],
                ['reviews.manage', 'Moderate and publish customer reviews and feedback'],
                
                // Accounting & Finance
                ['accounting.read', 'View chart of accounts, journal entries, and financial statements'],
                ['accounting.write', 'Manage chart of accounts, post journal entries, and record expenses'],
                ['accounting.setup', 'Configure accounting fiscal rules and structural ledgers'],
                ['accounting.transactions', 'Authorize and execute financial transactions'],
                ['accounting.reconcile', 'Perform bank account reconciliations'],
                ['fiscal.read', 'View fiscal year periods and tax calendars'],
                ['fiscal.write', 'Open, close, and configure fiscal years'],
                ['costing.manage', 'Create and manage product costing formulas and export templates'],
                
                // Production & Manufacturing
                ['production.read', 'View production orders and Bills of Materials (BOM)'],
                ['production.write', 'Create, execute, and complete production orders and BOMs'],
                
                // Human Resources (HRM)
                ['hrm.read', 'View employee directories, departments, and payroll profiles'],
                ['hrm.write', 'Manage employee files, salary structures, and HR documents'],
                ['attendance.write', 'Log, edit, and approve employee attendance'],
                ['leave.write', 'Review, approve, and manage leave applications'],
                ['payroll.write', 'Process, adjust, and finalize employee payrolls'],
                
                // Master Data & Configuration
                ['units.read', 'View measurement units'],
                ['units.write', 'Manage measurement units'],
                ['taxes.read', 'View tax rules and rates'],
                ['taxes.write', 'Configure tax rules and rates'],
                ['banks.read', 'View banks, branches, and banking institutions'],
                ['banks.write', 'Manage banks and sync branch directories'],
                ['locations.read', 'View branch locations, shipping zones, and districts'],
                ['locations.write', 'Manage locations, shipping carriers, and regional zones'],
                ['departments.read', 'View business departments'],
                ['departments.write', 'Manage business departments'],
                ['shipping.manage', 'Configure shipping carriers and delivery matrix'],
                
                // System & Admin
                ['users.read', 'View system user accounts'],
                ['users.write', 'Create, edit, activate, and manage system user accounts'],
                ['rbac.read', 'View RBAC roles and assigned permissions'],
                ['rbac.write', 'Create custom roles and configure role permissions'],
                ['company.write', 'Update company profile, branding, and billing info'],
                ['settings.read', 'View system settings, hardware, and printer profiles'],
                ['settings.write', 'Update system settings, hardware configs, and printer profiles'],
                ['ecommerce.read', 'View storefront configuration and content'],
                ['ecommerce.write', 'Manage storefront content, menus, and e-commerce configurations'],
            ];

            $permStmt = $pdo->prepare("INSERT IGNORE INTO permissions (perm_key, description) VALUES (?, ?)");
            foreach ($permissions as $p) {
                $permStmt->execute([$p[0], $p[1]]);
            }

            // Sync newly added permissions into default roles if not present
            $woRole = (int)$pdo->query("SELECT id FROM roles WHERE name = 'Workshop Officer' LIMIT 1")->fetchColumn();
            if ($woRole) {
                $grantStmt = $pdo->prepare("
                    INSERT IGNORE INTO role_permissions (role_id, permission_id)
                    SELECT ?, id FROM permissions WHERE perm_key = ?
                ");
                $defaultWoPerms = [
                    'orders.read','orders.write','vehicles.read','vehicles.write',
                    'bays.read','bays.write','technicians.read','categories.read','checklists.read',
                    'reports.read','makes.read','models.read','parts.read','parts.write',
                    'suppliers.read','purchase.read','purchase.write','grn.read','grn.write',
                    'stock.read','transfer.read','transfer.write','payments.read','payments.write',
                    'accounting.read','accounting.write','units.read','pos.read','pos.write',
                    'invoices.read','invoices.write','customers.read','customers.write'
                ];
                foreach ($defaultWoPerms as $dp) {
                    $grantStmt->execute([$woRole, $dp]);
                }
            }
        } catch (Exception $e) {
            // Defensive error handling
        }
    }
}
