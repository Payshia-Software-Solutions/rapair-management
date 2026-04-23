USE saas_master_db;
INSERT INTO saas_packages (name, package_key, modules, monthly_price) VALUES 
('Free Trial', 'free_trial', '["serviceCenter","inventory"]', 0.00),
('Starter', 'starter', '["serviceCenter","inventory","cms"]', 49.00),
('Pro', 'pro', '["serviceCenter","inventory","cms","accounting","hrm"]', 99.00),
('Ultra', 'ultra', '["*"]', 199.00),
('Custom', 'custom', '["serviceCenter"]', 0.00);
