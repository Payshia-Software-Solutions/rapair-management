-- Database Performance Optimization Script
-- This script adds missing indexes to optimize query performance.
-- Run this on your deployed server via phpMyAdmin or MySQL CLI.

-- 1. Invoices & Sales
ALTER TABLE `invoices` ADD INDEX `idx_inv_date` (`issue_date`);
ALTER TABLE `invoices` ADD INDEX `idx_inv_status` (`status`);
ALTER TABLE `invoices` ADD INDEX `idx_inv_created` (`created_at`);
ALTER TABLE `invoice_items` ADD INDEX `idx_ii_item` (`item_id`);

-- 2. Purchase Orders
ALTER TABLE `purchase_orders` ADD INDEX `idx_po_date` (`ordered_at`);
ALTER TABLE `purchase_orders` ADD INDEX `idx_po_status` (`status`);
ALTER TABLE `purchase_order_items` ADD INDEX `idx_poi_item` (`part_id`);

-- 3. Inventory & Stock
ALTER TABLE `goods_receive_notes` ADD INDEX `idx_grn_date` (`received_at`);
ALTER TABLE `grn_items` ADD INDEX `idx_grni_item` (`part_id`);
ALTER TABLE `inventory_batches` ADD INDEX `idx_ib_grn` (`grn_id`);
ALTER TABLE `stock_movements` ADD INDEX `idx_sm_ref` (`ref_id`);
ALTER TABLE `stock_movements` ADD INDEX `idx_sm_created` (`created_at`);
ALTER TABLE `stock_transfer_items` ADD INDEX `idx_sti_item` (`part_id`);

-- 4. CRM
ALTER TABLE `crm_inquiries` ADD INDEX `idx_inq_created` (`created_at`);
ALTER TABLE `crm_inquiry_items` ADD INDEX `idx_inqi_item` (`item_id`);

-- 5. Accounting
ALTER TABLE `acc_journal_items` ADD INDEX `idx_aji_partner` (`partner_id`);
ALTER TABLE `acc_expenses` ADD INDEX `idx_exp_payee` (`payee_id`);
