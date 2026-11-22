<?php
/**
 * Standard 4-level chart of accounts (SLFRS / IAS 1 presentation).
 *
 *   L1 Class        1 Assets
 *   L2 Group        11 Current Assets
 *   L3 Sub-group    111 Cash & Cash Equivalents
 *   L4 Ledger       1000 Cash in Hand      <- the only level that can be posted to
 *   (Sub-ledger = customer / supplier / employee via journal partner_type/partner_id)
 *
 * upgrade() is idempotent: it adds the hierarchy columns, the group accounts, missing standard
 * ledgers and mappings, files every existing ledger under a group, and moves mappings that still
 * point at the old catch-all defaults. It never deletes or renames a user's accounts.
 */
class ChartOfAccounts {
    /** [code, name, type, parent_code] for L1–L3 groups */
    const GROUPS = [
        ['1', 'Assets', 'ASSET', null],
        ['11', 'Current Assets', 'ASSET', '1'],
        ['111', 'Cash & Cash Equivalents', 'ASSET', '11'],
        ['112', 'Trade & Other Receivables', 'ASSET', '11'],
        ['113', 'Inventories', 'ASSET', '11'],
        ['114', 'Tax Receivables & Prepayments', 'ASSET', '11'],
        ['12', 'Non-current Assets', 'ASSET', '1'],
        ['121', 'Property, Plant & Equipment', 'ASSET', '12'],
        ['122', 'Accumulated Depreciation', 'ASSET', '12'],

        ['2', 'Liabilities', 'LIABILITY', null],
        ['21', 'Current Liabilities', 'LIABILITY', '2'],
        ['211', 'Trade & Other Payables', 'LIABILITY', '21'],
        ['212', 'Tax Payables', 'LIABILITY', '21'],
        ['213', 'Employee Payables', 'LIABILITY', '21'],
        ['214', 'Customer Advances & Deposits', 'LIABILITY', '21'],
        ['22', 'Non-current Liabilities', 'LIABILITY', '2'],
        ['221', 'Long-term Borrowings', 'LIABILITY', '22'],

        ['3', 'Equity', 'EQUITY', null],
        ['31', 'Owners\' Equity', 'EQUITY', '3'],
        ['311', 'Capital', 'EQUITY', '31'],
        ['312', 'Reserves & Retained Earnings', 'EQUITY', '31'],

        ['4', 'Income', 'INCOME', null],
        ['41', 'Revenue', 'INCOME', '4'],
        ['411', 'Sales', 'INCOME', '41'],
        ['412', 'Sales Deductions', 'INCOME', '41'],
        ['42', 'Other Income', 'INCOME', '4'],
        ['421', 'Other Operating Income', 'INCOME', '42'],

        ['5', 'Expenses', 'EXPENSE', null],
        ['51', 'Cost of Sales', 'EXPENSE', '5'],
        ['511', 'Cost of Goods Sold', 'EXPENSE', '51'],
        ['512', 'Inventory Losses', 'EXPENSE', '51'],
        ['52', 'Operating Expenses', 'EXPENSE', '5'],
        ['521', 'Staff Costs', 'EXPENSE', '52'],
        ['522', 'Premises & Utilities', 'EXPENSE', '52'],
        ['523', 'Administrative Expenses', 'EXPENSE', '52'],
        ['524', 'Selling & Marketing', 'EXPENSE', '52'],
        ['525', 'Depreciation', 'EXPENSE', '52'],
        ['53', 'Finance Costs', 'EXPENSE', '5'],
        ['531', 'Bank & Card Charges', 'EXPENSE', '53'],
    ];

    /** [code, name, type, parent_code] for L4 ledgers (existing codes are only re-parented) */
    const LEDGERS = [
        ['1000', 'Cash in Hand', 'ASSET', '111'],
        ['1005', 'Petty Cash', 'ASSET', '111'],
        ['1010', 'Bank Account', 'ASSET', '111'],
        ['1020', 'Card Clearing', 'ASSET', '111'],
        ['1030', 'Cheques in Hand', 'ASSET', '111'],
        ['1200', 'Accounts Receivable', 'ASSET', '112'],
        ['1210', 'Other Receivables', 'ASSET', '112'],
        ['1250', 'Purchase Tax Claimable', 'ASSET', '114'],
        ['1260', 'Prepayments', 'ASSET', '114'],
        ['1400', 'Inventory', 'ASSET', '113'],
        ['1410', 'Work in Progress (WIP)', 'ASSET', '113'],
        ['1600', 'Furniture & Fittings', 'ASSET', '121'],
        ['1610', 'Kitchen & Equipment', 'ASSET', '121'],
        ['1620', 'Motor Vehicles', 'ASSET', '121'],
        ['1630', 'Computers & IT', 'ASSET', '121'],
        ['1690', 'Accumulated Depreciation', 'ASSET', '122'],

        ['2000', 'Accounts Payable', 'LIABILITY', '211'],
        ['2010', 'Accrued Expenses', 'LIABILITY', '211'],
        ['2200', 'Other Taxes Payable', 'LIABILITY', '212'],
        ['2210', 'VAT Payable', 'LIABILITY', '212'],
        ['2220', 'SSCL Payable', 'LIABILITY', '212'],
        ['2230', 'TDL Payable', 'LIABILITY', '212'],
        ['2240', 'Service Charge Payable', 'LIABILITY', '213'],
        ['2300', 'Salaries Payable', 'LIABILITY', '213'],
        ['2310', 'EPF Payable', 'LIABILITY', '213'],
        ['2320', 'ETF Payable', 'LIABILITY', '213'],
        ['2400', 'Customer Advances', 'LIABILITY', '214'],
        ['2500', 'Bank Loans', 'LIABILITY', '221'],

        ['3000', 'Retained Earnings', 'EQUITY', '312'],
        ['3010', 'Opening Balance Equity', 'EQUITY', '312'],
        ['3100', 'Owner\'s Capital', 'EQUITY', '311'],
        ['3110', 'Drawings', 'EQUITY', '311'],

        ['4000', 'Sales Revenue', 'INCOME', '411'],
        ['4100', 'Service Income', 'INCOME', '411'],
        ['4900', 'Sales Discounts', 'INCOME', '412'],
        ['4910', 'Sales Returns', 'INCOME', '412'],
        ['4200', 'Other Income', 'INCOME', '421'],

        ['5000', 'Cost of Goods Sold', 'EXPENSE', '511'],
        ['5300', 'Stock Adjustments & Shrinkage', 'EXPENSE', '512'],
        ['5100', 'General Operating Expenses', 'EXPENSE', '523'],
        ['5200', 'Salaries & Wages', 'EXPENSE', '521'],
        ['5210', 'EPF Employer Contribution', 'EXPENSE', '521'],
        ['5220', 'ETF Contribution', 'EXPENSE', '521'],
        ['5400', 'Rent', 'EXPENSE', '522'],
        ['5410', 'Electricity & Water', 'EXPENSE', '522'],
        ['5420', 'Repairs & Maintenance', 'EXPENSE', '522'],
        ['5500', 'Marketing & Advertising', 'EXPENSE', '524'],
        ['5510', 'Complimentary & Hospitality', 'EXPENSE', '524'],
        ['5600', 'Depreciation Expense', 'EXPENSE', '525'],
        ['5700', 'Bank Charges', 'EXPENSE', '531'],
        ['5710', 'Card Commission', 'EXPENSE', '531'],
    ];

    /** New mappings: [key, account code, label, category] (INSERT IGNORE keeps a user's choice) */
    const MAPPINGS = [
        ['tax_VAT', '2210', 'VAT Output Account', 'Taxes'],
        ['tax_SSCL', '2220', 'SSCL Account', 'Taxes'],
        ['tax_TDL', '2230', 'TDL Account', 'Taxes'],
        ['tax_SC', '2240', 'Service Charge Account', 'Taxes'],
        ['payment_card', '1020', 'Card Payment Clearing Account', 'Payments'],
        ['payment_cheque', '1030', 'Cheques in Hand Account', 'Payments'],
        ['comp_expense', '5510', 'Complimentary Items Expense', 'Sales'],
    ];

    /** Mappings that still sit on the old catch-all default move to the proper account */
    const REMAP = [
        ['sales_discount', '5100', '4900'],
        ['sales_return', '4000', '4910'],
        ['inventory_adjustment', '5100', '5300'],
    ];

    /** Where a ledger with an unknown code goes, by type + category */
    private static function fallbackParent($type, $category) {
        $c = strtolower((string)$category);
        switch ($type) {
            case 'ASSET':
                if (str_contains($c, 'cash') || str_contains($c, 'bank')) return '111';
                if (str_contains($c, 'receiv')) return '112';
                if (str_contains($c, 'invent') || str_contains($c, 'stock')) return '113';
                if (str_contains($c, 'fixed') || str_contains($c, 'equip') || str_contains($c, 'vehicle') || str_contains($c, 'asset')) return '121';
                return '114';
            case 'LIABILITY':
                if (str_contains($c, 'tax')) return '212';
                if (str_contains($c, 'loan')) return '221';
                if (str_contains($c, 'salar') || str_contains($c, 'employee') || str_contains($c, 'payroll')) return '213';
                return '211';
            case 'EQUITY': return '312';
            case 'INCOME': return (str_contains($c, 'revenue') || str_contains($c, 'sales')) ? '411' : '421';
            default:
                if (str_contains($c, 'cogs') || str_contains($c, 'cost of')) return '511';
                if (str_contains($c, 'salar') || str_contains($c, 'staff')) return '521';
                if (str_contains($c, 'bank')) return '531';
                return '523';
        }
    }

    private static function hasColumn(PDO $pdo, $col) {
        return (bool)$pdo->query("SHOW COLUMNS FROM acc_accounts LIKE '$col'")->fetch();
    }

    public static function upgrade(PDO $pdo) {
        if (!self::hasColumn($pdo, 'parent_id')) $pdo->exec("ALTER TABLE acc_accounts ADD COLUMN parent_id INT NULL AFTER id, ADD INDEX idx_acc_parent (parent_id)");
        if (!self::hasColumn($pdo, 'level')) $pdo->exec("ALTER TABLE acc_accounts ADD COLUMN level TINYINT NOT NULL DEFAULT 4 AFTER parent_id");
        if (!self::hasColumn($pdo, 'is_group')) $pdo->exec("ALTER TABLE acc_accounts ADD COLUMN is_group TINYINT(1) NOT NULL DEFAULT 0 AFTER level");

        $idOf = function ($code) use ($pdo) {
            $s = $pdo->prepare("SELECT id FROM acc_accounts WHERE code = ?");
            $s->execute([$code]);
            $v = $s->fetchColumn();
            return $v ? (int)$v : null;
        };

        // Groups (L1–L3)
        $ins = $pdo->prepare("INSERT IGNORE INTO acc_accounts (code, name, type, category, is_system, is_group, level, parent_id) VALUES (?, ?, ?, 'Group', 1, 1, ?, ?)");
        foreach (self::GROUPS as [$code, $name, $type, $parent]) {
            $ins->execute([$code, $name, $type, strlen($code), $parent ? $idOf($parent) : null]);
            $pdo->prepare("UPDATE acc_accounts SET is_group = 1, level = ?, parent_id = ? WHERE code = ?")
                ->execute([strlen($code), $parent ? $idOf($parent) : null, $code]);
        }

        // Standard ledgers (L4): create missing ones, re-parent known ones (names a user changed stay)
        $insL = $pdo->prepare("INSERT IGNORE INTO acc_accounts (code, name, type, category, is_system, is_group, level, parent_id) VALUES (?, ?, ?, ?, 1, 0, 4, ?)");
        foreach (self::LEDGERS as [$code, $name, $type, $parent]) {
            $pid = $idOf($parent);
            $insL->execute([$code, $name, $type, $code === '1010' ? 'Bank' : self::categoryFor($parent), $pid]);
            $pdo->prepare("UPDATE acc_accounts SET parent_id = ?, level = 4, is_group = 0 WHERE code = ? AND (parent_id IS NULL OR parent_id = 0)")->execute([$pid, $code]);
        }
        // Bank ledgers carry category 'Bank' (reconciliation and settlements list only these)
        $pdo->exec("UPDATE acc_accounts SET category = 'Bank' WHERE code = '1010' AND (category IS NULL OR category = 'Cash')");
        // Old generic names -> clearer ones (only when still the original seed name)
        $pdo->exec("UPDATE acc_accounts SET name = 'Other Taxes Payable' WHERE code = '2200' AND name = 'Sales Tax Payable'");
        $pdo->exec("UPDATE acc_accounts SET name = 'General Operating Expenses' WHERE code = '5100' AND name = 'Operating Expenses'");

        // Any other ledger without a parent: file it by type/category
        foreach ($pdo->query("SELECT id, type, category FROM acc_accounts WHERE is_group = 0 AND (parent_id IS NULL OR parent_id = 0)")->fetchAll(PDO::FETCH_OBJ) as $a) {
            $pid = $idOf(self::fallbackParent($a->type, $a->category));
            if ($pid) $pdo->prepare("UPDATE acc_accounts SET parent_id = ?, level = 4 WHERE id = ?")->execute([$pid, $a->id]);
        }

        // Mappings
        foreach (self::MAPPINGS as [$key, $code, $label, $cat]) {
            $aid = $idOf($code);
            if ($aid) $pdo->prepare("INSERT IGNORE INTO acc_mappings (map_key, account_id, label, category) VALUES (?, ?, ?, ?)")->execute([$key, $aid, $label, $cat]);
        }
        foreach (self::REMAP as [$key, $from, $to]) {
            $f = $idOf($from); $t = $idOf($to);
            if ($f && $t) $pdo->prepare("UPDATE acc_mappings SET account_id = ? WHERE map_key = ? AND account_id = ?")->execute([$t, $key, $f]);
        }

        self::journalLocations($pdo);
    }

    /** Branch on every journal entry (for branch P&L), filled from the source document. */
    public static function journalLocations(PDO $pdo) {
        if (!$pdo->query("SHOW COLUMNS FROM acc_journal_entries LIKE 'location_id'")->fetch()) {
            $pdo->exec("ALTER TABLE acc_journal_entries ADD COLUMN location_id INT NULL AFTER ref_id, ADD INDEX idx_je_location (location_id)");
        }
        $sources = [
            'Invoice' => 'invoices', 'CogsCorrection' => 'invoices', 'Payment' => 'invoices',
            'PaymentReceipt' => 'payment_receipts', 'Refund' => 'refunds', 'SalesReturn' => 'sales_returns',
            'GRN' => 'goods_receive_notes', 'StockMovement' => 'stock_movements', 'Adjustment' => 'stock_adjustments',
            'IssueNote' => 'issue_notes', 'ProductionOrder' => 'production_orders',
        ];
        foreach ($sources as $ref => $table) {
            try {
                $pdo->exec("UPDATE acc_journal_entries e JOIN $table s ON s.id = e.ref_id
                            SET e.location_id = s.location_id
                            WHERE e.ref_type = '$ref' AND e.location_id IS NULL AND s.location_id IS NOT NULL");
            } catch (Exception $e) { /* table not on this install */ }
        }
        $pdo->exec("UPDATE acc_journal_entries e JOIN acc_journal_entries o ON o.id = e.ref_id
                    SET e.location_id = o.location_id
                    WHERE e.ref_type = 'Reclass' AND e.location_id IS NULL AND o.location_id IS NOT NULL");
    }

    /** Category labels other screens filter on (e.g. Cash/Bank for reconciliation). */
    public static function categoryFor($parent) {
        $map = ['111' => 'Cash', '112' => 'Receivables', '113' => 'Inventory', '114' => 'Tax', '121' => 'Fixed Assets', '122' => 'Fixed Assets',
            '211' => 'Payables', '212' => 'Tax', '213' => 'Employee', '214' => 'Advances', '221' => 'Loans', '311' => 'Equity', '312' => 'Equity',
            '411' => 'Revenue', '412' => 'Revenue', '421' => 'Other Income', '511' => 'COGS', '512' => 'COGS'];
        return $map[$parent] ?? 'Expense';
    }
}
