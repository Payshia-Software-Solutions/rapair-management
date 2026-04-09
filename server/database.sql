CREATE TABLE IF NOT EXISTS service_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location_type ENUM('service','warehouse') NOT NULL DEFAULT 'service',
    address VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_service_locations_name (name)
);

CREATE TABLE IF NOT EXISTS repair_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL DEFAULT 1,
    customer_name VARCHAR(255) NOT NULL,
    vehicle_model VARCHAR(255) NOT NULL,
    problem_description TEXT,
    status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Pending',
    vehicle_id INT NULL,
    vehicle_identifier VARCHAR(100) NULL,
    mileage INT NULL,
    priority VARCHAR(20) NULL,
    expected_time DATETIME NULL,
    release_time DATETIME NULL,
    comments TEXT NULL,
    categories_json TEXT NULL,
    checklist_json TEXT NULL,
    checklist_done_json TEXT NULL,
    completion_comments TEXT NULL,
    completed_at DATETIME NULL,
    attachments_json TEXT NULL,
    location VARCHAR(50) NULL,
    technician VARCHAR(255) NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(64) NULL,
    part_number VARCHAR(64) NULL,
    barcode_number VARCHAR(64) NULL,
    part_name VARCHAR(255) NOT NULL,
    unit VARCHAR(32) NULL,
    brand_id INT NULL,
    stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    cost_price DECIMAL(10, 2) NULL,
    price DECIMAL(10, 2) NOT NULL,
    reorder_level INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    image_filename VARCHAR(255) NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_parts_sku (sku)
);

CREATE TABLE IF NOT EXISTS order_parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    part_id INT,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NULL,
    unit_price DECIMAL(10,2) NULL,
    line_total DECIMAL(10,2) NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_parts_order (order_id),
    INDEX idx_order_parts_part (part_id),
    FOREIGN KEY (order_id) REFERENCES repair_orders(id),
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- Suppliers table (for purchasing)
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    address VARCHAR(255) NULL,
    tax_reg_no VARCHAR(100) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_suppliers_name (name)
);

CREATE TABLE IF NOT EXISTS part_suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_id INT NOT NULL,
    supplier_id INT NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_part_sup (part_id, supplier_id),
    INDEX idx_part_sup_part (part_id),
    INDEX idx_part_sup_supplier (supplier_id),
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Short document numbering sequences
CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type VARCHAR(30) PRIMARY KEY,
    prefix VARCHAR(10) NOT NULL,
    next_number INT NOT NULL DEFAULT 1,
    padding INT NOT NULL DEFAULT 6,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO document_sequences (doc_type, prefix, next_number, padding) VALUES
('PO', 'PO-', 1, 6),
('GRN', 'GRN-', 1, 6);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL DEFAULT 1,
    supplier_id INT NOT NULL,
    po_number VARCHAR(50) NOT NULL,
    status ENUM('Draft','Sent','Partially Received','Received','Cancelled') NOT NULL DEFAULT 'Draft',
    notes TEXT NULL,
    ordered_at DATETIME NULL,
    expected_at DATETIME NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_purchase_orders_number (po_number),
    INDEX idx_purchase_orders_location (location_id),
    INDEX idx_purchase_orders_supplier (supplier_id),
    FOREIGN KEY (location_id) REFERENCES service_locations(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    part_id INT NOT NULL,
    qty_ordered DECIMAL(12,3) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    received_qty DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    line_total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_poi_po (purchase_order_id),
    INDEX idx_poi_part (part_id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- Goods Receive Notes
CREATE TABLE IF NOT EXISTS goods_receive_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_number VARCHAR(50) NOT NULL,
    purchase_order_id INT NULL,
    location_id INT NOT NULL DEFAULT 1,
    supplier_id INT NOT NULL,
    received_at DATETIME NOT NULL,
    notes TEXT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_grn_number (grn_number),
    INDEX idx_grn_location (location_id),
    INDEX idx_grn_supplier (supplier_id),
    INDEX idx_grn_po (purchase_order_id),
    FOREIGN KEY (location_id) REFERENCES service_locations(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);

CREATE TABLE IF NOT EXISTS grn_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_id INT NOT NULL,
    part_id INT NOT NULL,
    qty_received DECIMAL(12,3) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    INDEX idx_grni_grn (grn_id),
    INDEX idx_grni_part (part_id),
    FOREIGN KEY (grn_id) REFERENCES goods_receive_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- Stock movements ledger (audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL DEFAULT 1,
    part_id INT NOT NULL,
    qty_change DECIMAL(12,3) NOT NULL,
    movement_type ENUM('GRN','ORDER_ISSUE','ADJUSTMENT') NOT NULL,
    ref_table VARCHAR(64) NULL,
    ref_id INT NULL,
    unit_cost DECIMAL(10,2) NULL,
    unit_price DECIMAL(10,2) NULL,
    notes VARCHAR(255) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_movements_location (location_id),
    INDEX idx_stock_movements_part (part_id),
    INDEX idx_stock_movements_type (movement_type),
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- Units master data
CREATE TABLE IF NOT EXISTS units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Taxes master data (supports compound taxes like VAT on base + previous taxes)
CREATE TABLE IF NOT EXISTS taxes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    rate_percent DECIMAL(9,4) NOT NULL DEFAULT 0.0000,
    apply_on ENUM('base','base_plus_previous') NOT NULL DEFAULT 'base',
    sort_order INT NOT NULL DEFAULT 100,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Supplier available taxes (used by PO/GRN calculations)
CREATE TABLE IF NOT EXISTS supplier_taxes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    tax_id INT NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_supplier_tax (supplier_id, tax_id),
    INDEX idx_supplier_tax_supplier (supplier_id),
    INDEX idx_supplier_tax_tax (tax_id)
);

-- Stock adjustment batches (one adjustment number can include multiple items)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL DEFAULT 1,
    adjustment_number VARCHAR(50) NOT NULL,
    adjusted_at DATETIME NOT NULL,
    reason VARCHAR(255) NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_stock_adjustments_number (adjustment_number),
    INDEX idx_stock_adjustments_location (location_id),
    INDEX idx_stock_adjustments_date (adjusted_at)
);

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
     id INT AUTO_INCREMENT PRIMARY KEY,
     stock_adjustment_id INT NOT NULL,
     part_id INT NOT NULL,
     system_stock DECIMAL(12,3) NOT NULL DEFAULT 0.000,
     physical_stock DECIMAL(12,3) NOT NULL DEFAULT 0.000,
     qty_change DECIMAL(12,3) NOT NULL,
     notes VARCHAR(255) NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_sai_adj (stock_adjustment_id),
    INDEX idx_sai_part (part_id),
    FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transfer_number VARCHAR(50) NOT NULL,
    requisition_id INT NULL,
    from_location_id INT NOT NULL,
    to_location_id INT NOT NULL,
    status ENUM('Requested','Received','Cancelled') NOT NULL DEFAULT 'Requested',
    requested_at DATETIME NULL,
    notes TEXT NULL,
    created_by INT NULL,
    received_by INT NULL,
    received_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_str_req (requisition_id),
    INDEX idx_str_from (from_location_id),
    INDEX idx_str_to (to_location_id),
    INDEX idx_str_status (status),
    UNIQUE KEY uq_str_number (transfer_number)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transfer_id INT NOT NULL,
    part_id INT NOT NULL,
    qty DECIMAL(12,3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sti_transfer (transfer_id),
    INDEX idx_sti_part (part_id),
    FOREIGN KEY (transfer_id) REFERENCES stock_transfer_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_requisitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requisition_number VARCHAR(50) NOT NULL,
    to_location_id INT NOT NULL,
    status ENUM('Requested','Approved','Cancelled','Fulfilled') NOT NULL DEFAULT 'Requested',
    requested_at DATETIME NULL,
    notes TEXT NULL,
    created_by INT NULL,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strq_to (to_location_id),
    INDEX idx_strq_status (status),
    UNIQUE KEY uq_strq_number (requisition_number)
);

CREATE TABLE IF NOT EXISTS stock_transfer_requisition_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requisition_id INT NOT NULL,
    part_id INT NOT NULL,
    qty_requested DECIMAL(12,3) NOT NULL,
    qty_fulfilled DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strqi_req (requisition_id),
    INDEX idx_strqi_part (part_id),
    FOREIGN KEY (requisition_id) REFERENCES stock_transfer_requisitions(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

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
    location_id INT NOT NULL DEFAULT 1,
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

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year YEAR NOT NULL,
    vin VARCHAR(17) UNIQUE NOT NULL,
    image_filename VARCHAR(255) NULL,
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
