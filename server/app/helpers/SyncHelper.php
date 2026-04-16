<?php
/**
 * SyncHelper
 * Centralized utility to synchronize all database schemas across modules.
 */
class SyncHelper {
    public static function runAll() {
        $results = [];

        // 1. Core Master Data (Pre-requisites)
        try {
            require_once __DIR__ . '/BrandSchema.php';
            require_once __DIR__ . '/TaxSchema.php';
            require_once __DIR__ . '/UnitSchema.php';
            BrandSchema::ensure(true);
            TaxSchema::ensure(true);
            UnitSchema::ensure(true);
            $results[] = ['module' => 'Base Master Data', 'status' => 'success'];
        } catch (Exception $e) {
            $results[] = ['module' => 'Base Master Data', 'status' => 'error', 'message' => $e->getMessage()];
        }

        // 2. Inventory (Depends on Brand/Tax/Unit)
        try {
            require_once __DIR__ . '/InventorySchema.php';
            InventorySchema::ensure(true); 
            $results[] = ['module' => 'Inventory', 'status' => 'success'];
        } catch (Exception $e) {
            $results[] = ['module' => 'Inventory', 'status' => 'error', 'message' => $e->getMessage()];
        }

        // 2. Vehicles
        try {
            require_once __DIR__ . '/../models/Vehicle.php';
            $vModel = new Vehicle();
            $vModel->ensureSchema(true);
            $results[] = ['module' => 'Vehicles', 'status' => 'success'];
        } catch (Exception $e) {
            $results[] = ['module' => 'Vehicles', 'status' => 'error', 'message' => $e->getMessage()];
        }

        // 3. Taxes
        try {
            require_once __DIR__ . '/TaxSchema.php';
            TaxSchema::ensure(true);
            $results[] = ['module' => 'Taxes', 'status' => 'success'];
        } catch (Exception $e) {
            $results[] = ['module' => 'Taxes', 'status' => 'error', 'message' => $e->getMessage()];
        }

        // 4. Invoices
        try {
            require_once __DIR__ . '/InvoiceSchema.php';
            InvoiceSchema::ensure(true);
            $results[] = ['module' => 'Invoices', 'status' => 'success'];
        } catch (Exception $e) {
            $results[] = ['module' => 'Invoices', 'status' => 'error', 'message' => $e->getMessage()];
        }

        // 5. Customers & Company
        try {
            require_once __DIR__ . '/CustomerSchema.php';
            CustomerSchema::ensure(true);
            require_once __DIR__ . '/CompanySchema.php';
            CompanySchema::ensure(true);
            $results[] = ['module' => 'Profiles', 'status' => 'success'];
        } catch (Exception $e) {
            $results[] = ['module' => 'Profiles', 'status' => 'error', 'message' => $e->getMessage()];
        }

        return $results;
    }
}
