-- Seed saas_master_db with packages and tenant data

INSERT INTO saas_packages (id, name, package_key, monthly_price, modules, services, server_info, max_users, max_locations, is_public) VALUES
(1, 'Starter', 'starter', 0.00, '["serviceCenter","promotions","frontOffice"]', '[]', '', 5, 1, 1),
(2, 'Professional', 'professional', 49.99, '["serviceCenter","inventory","vendors","crm","sales","masterData","promotions","frontOffice"]', '[]', '', 15, 3, 1),
(3, 'Enterprise', 'enterprise', 149.99, '["*"]', '[]', '', 999, 999, 1);

INSERT INTO saas_tenants (id, name, address, business_type, admin_email, slug, package_id, db_name, api_url, status, trial_expiry, license_key, api_key) VALUES
(1, 'Main Office', '', 'Service Center', '', 'main_office', 3, 'repair_management_db', 'http://localhost/rapair-management/server', 'Active', '2027-12-31', 'RM-PAYSHIA-1d2f-f8d5-c247', 'NX-773043f3a13ee8e1982d6320c22aca1f');

INSERT INTO portal_admins (id, tenant_id, username, password, full_name, email_verified, role) VALUES
(1, NULL, 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 1, 'super_admin');
