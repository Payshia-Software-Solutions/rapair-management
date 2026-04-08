CREATE TABLE IF NOT EXISTS repair_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    vehicle_model VARCHAR(255) NOT NULL,
    problem_description TEXT,
    status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_name VARCHAR(255) NOT NULL,
    stock_quantity INT DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_parts (
    order_id INT,
    part_id INT,
    quantity INT NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES repair_orders(id),
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- Insert some initial mock data
INSERT INTO repair_orders (customer_name, vehicle_model, problem_description, status) VALUES
('John Doe', 'Toyota Camry', 'Engine oil leak', 'Pending'),
('Jane Smith', 'Honda Civic', 'Brake pad replacement', 'In Progress'),
('Alex Brown', 'Ford F-150', 'Transmission issue', 'Completed');

INSERT INTO parts (part_name, stock_quantity, price) VALUES
('Oil Filter', 50, 12.99),
('Brake Pads', 20, 45.00),
('Transmission Fluid', 15, 25.50);
-- Technicians table
CREATE TABLE IF NOT EXISTS technicians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service bays table
CREATE TABLE IF NOT EXISTS service_bays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    status ENUM('Available','Occupied','Out of Service') DEFAULT 'Available',
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repair categories table
CREATE TABLE IF NOT EXISTS repair_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checklist items table (per order)
CREATE TABLE IF NOT EXISTS checklist_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
);

-- Global checklist templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description TEXT NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed data for technicians
INSERT INTO technicians (name, role) VALUES
('John Smith','Technician'),
('Sarah Johnson','Technician'),
('Mike Ross','Technician'),
('Emily Davis','Technician'),
('David Wilson','Technician');

-- Seed data for service bays
INSERT INTO service_bays (name) VALUES
('Bay 1'),('Bay 2'),('Bay 3'),('Bay 4'),('Bay 5'),('Bay 6'),('Bay 7'),('Bay 8'),('Bay 9'),('Outside');

-- Seed data for repair categories
INSERT INTO repair_categories (name) VALUES
('Brake System'),('Engine System'),('Cooling System'),('General Service');

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year YEAR NOT NULL,
    vin VARCHAR(17) UNIQUE NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle makes table
CREATE TABLE IF NOT EXISTS vehicle_makes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle models table
CREATE TABLE IF NOT EXISTS vehicle_models (
    id INT AUTO_INCREMENT PRIMARY KEY,
    make_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_vehicle_models_make_name (make_id, name),
    FOREIGN KEY (make_id) REFERENCES vehicle_makes(id) ON DELETE CASCADE
);

-- Seed vehicles (IGNORE allows rerunning install without unique VIN failures)
INSERT IGNORE INTO vehicles (make, model, year, vin) VALUES
('Toyota', 'Camry', 2020, '1HGCM82633A004352'),
('Honda', 'Civic', 2019, '2HGFB2F5XCH512345'),
('Ford', 'F-150', 2021, '1FTFW1E53LKD12345');

-- Seed vehicle makes/models (IGNORE makes the install rerunnable)
INSERT IGNORE INTO vehicle_makes (name) VALUES
('Toyota'),
('Honda'),
('Ford');

INSERT IGNORE INTO vehicle_models (make_id, name) VALUES
((SELECT id FROM vehicle_makes WHERE name = 'Toyota'), 'Camry'),
((SELECT id FROM vehicle_makes WHERE name = 'Toyota'), 'Corolla'),
((SELECT id FROM vehicle_makes WHERE name = 'Honda'), 'Civic'),
((SELECT id FROM vehicle_makes WHERE name = 'Honda'), 'Accord'),
((SELECT id FROM vehicle_makes WHERE name = 'Ford'), 'F-150');
