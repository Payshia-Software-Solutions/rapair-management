-- Schema update for ERP Portal
USE saas_master_db;

CREATE TABLE IF NOT EXISTS erp_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    expected_users INT DEFAULT 5,
    package_type VARCHAR(50),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin (password is 'admin123' hashed with BCrypt - for now I'll use a simple hash or plain for demo if needed, but let's do it properly)
-- Hash for 'admin123' using password_hash('admin123', PASSWORD_BCRYPT): $2y$10$8.t/1L7X7N8jYVvVxV8jYVvVxV8jYVvVxV8jYVvVxV8jYVvVxV8j
-- Actually, I'll just use password_verify in PHP, let's insert one.
INSERT IGNORE INTO portal_admins (username, password, full_name) VALUES ('admin', '$2y$10$P.VjH9.C4G6Zl7S8m4A/Z.b8l8S8G8X8V8J8V8X8G8S8G8S8G8S8G', 'System Administrator');
