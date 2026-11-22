<?php
/**
 * AccountingHelper
 * Maps business events to automated journal entries.
 */
class AccountingHelper {
    public function __construct() {
        require_once '../app/models/Journal.php';
        require_once '../app/models/Account.php';
    }
    
    /**
     * Post Accounting for a New Invoice
     */
    public static function getMappedId($key) {
        require_once '../app/models/AccountMapping.php';
        $map = new AccountMapping();
        $res = $map->getMapping($key);
        return $res ? (int)$res->account_id : null;
    }

    /** Value of complimentary lines on an invoice (booked prices). */
    public static function invoiceCompAmount($invoiceId) {
        try {
            $db = new Database();
            $db->query("SELECT COALESCE(SUM(comp_amount), 0) AS v FROM invoice_items WHERE invoice_id = :id AND is_complimentary = 1");
            $db->bind(':id', (int)$invoiceId);
            return round((float)($db->single()->v ?? 0), 2);
        } catch (Exception $e) {
            return 0.0; // columns not on this install yet
        }
    }

    /**
     * "Complimentary & Hospitality" expense account (mapping comp_expense). Created on first
     * use (ledger 5510 under Marketing) when the chart-of-accounts upgrade hasn't run yet.
     */
    public static function compExpenseAccountId() {
        $id = self::getMappedId('comp_expense');
        if ($id) return $id;
        try {
            $db = new Database();
            $db->query("SELECT id FROM acc_accounts WHERE code = '5510' LIMIT 1");
            $acc = $db->single();
            if ($acc) {
                $id = (int)$acc->id;
            } else {
                $db->query("SELECT id FROM acc_accounts WHERE code = '524' LIMIT 1");
                $parent = $db->single();
                $db->query("INSERT INTO acc_accounts (code, name, type, category, is_system, is_group, level, parent_id)
                            VALUES ('5510', 'Complimentary & Hospitality', 'EXPENSE', 'Expense', 1, 0, 4, :p)");
                $db->bind(':p', $parent ? (int)$parent->id : null);
                $db->execute();
                $id = (int)$db->lastInsertId();
            }
            if ($id) {
                $db->query("INSERT IGNORE INTO acc_mappings (map_key, account_id, label, category)
                            VALUES ('comp_expense', :a, 'Complimentary Items Expense', 'Sales')");
                $db->bind(':a', $id);
                $db->execute();
            }
            return $id ?: null;
        } catch (Exception $e) {
            error_log('AccountingHelper: comp expense account: ' . $e->getMessage());
            return null;
        }
    }

    public static function postInvoice($invoiceId) {
        $invoiceModel = new Invoice();
        $journalModel = new Journal();

        $invoice = $invoiceModel->getById($invoiceId);
        if (!$invoice) return false;

        $arId = self::getMappedId('invoice_ar');
        $revId = self::getMappedId('invoice_revenue');
        $taxId = self::getMappedId('invoice_tax');
        $discId = self::getMappedId('sales_discount');
        $cogsId = self::getMappedId('cogs_account');
        $invId = self::getMappedId('grn_inventory');

        if (!$arId || !$revId || !$taxId) {
            error_log("AccountingHelper: Missing core mappings for Invoice.");
            return false;
        }

        $items = [];
        $description = "Sale Invoice #{$invoice->invoice_no}";

        // 1. REVENUE COMPONENT
        // DEBIT: Accounts Receivable
        $items[] = [
            'account_id' => $arId,
            'debit' => $invoice->grand_total,
            'credit' => 0,
            'partner_type' => 'Customer',
            'partner_id' => $invoice->customer_id,
            'notes' => $description
        ];

        // Complimentary items: full price is in subtotal and in discount_total; that part is
        // moved out of discounts to the Complimentary expense account.
        $compAmt = min((float)$invoice->discount_total, self::invoiceCompAmount($invoiceId));
        $compId = $compAmt > 0 ? self::compExpenseAccountId() : null;
        if (!$compId) $compAmt = 0;
        $otherDisc = round((float)$invoice->discount_total - $compAmt, 2);

        // DEBIT: Complimentary expense
        if ($compAmt > 0) {
            $items[] = [
                'account_id' => $compId,
                'debit' => $compAmt,
                'credit' => 0,
                'notes' => 'Complimentary items'
            ];
        }

        // DEBIT: Sales Discount (if any)
        if ($otherDisc > 0 && $discId) {
            $items[] = [
                'account_id' => $discId,
                'debit' => $otherDisc,
                'credit' => 0,
                'notes' => 'Discount allowed'
            ];
        }

        // CREDIT: Revenue (Gross)
        $items[] = [
            'account_id' => $revId,
            'debit' => 0,
            'credit' => $invoice->subtotal + ($discId ? 0 : -$otherDisc),
            'notes' => 'Sales Revenue'
        ];

        // CREDIT: each tax (VAT, SSCL, TDL, Service Charge) to its own account
        if ($invoice->tax_total > 0) {
            foreach (self::taxSplit($invoiceId, (float)$invoice->tax_total, $taxId) as $accId => $t) {
                $items[] = ['account_id' => $accId, 'debit' => 0, 'credit' => $t['amount'], 'notes' => $t['label'] . ' on ' . $description];
            }
        }

        // 2. COGS COMPONENT (Integrated into same entry)
        // Cost = what actually left stock for this invoice (sold items, recipe ingredients,
        // FIFO batches at their cost). Assembly plus/minus pairs for recipe dishes cancel out,
        // leaving the ingredient cost. Falls back to item cost only when no stock moved.
        $totalCost = self::invoiceStockCost($invoiceId);
        if ($totalCost === null) {
            $totalCost = 0;
            foreach ($invoiceModel->getItems($invoiceId) as $ii) {
                $totalCost += ((float)$ii->cost_price * (float)$ii->quantity);
            }
        }

        if ($totalCost > 0 && $cogsId && $invId) {
            $items[] = [
                'account_id' => $cogsId, 
                'debit' => $totalCost, 
                'credit' => 0, 
                'notes' => "COGS for {$invoice->invoice_no}"
            ];
            $items[] = [
                'account_id' => $invId, 
                'debit' => 0, 
                'credit' => $totalCost, 
                'notes' => "Inventory reduction"
            ];
        }

        // POST SINGLE COMPREHENSIVE ENTRY
        return $journalModel->post([
            'entry_date' => $invoice->issue_date,
            'description' => $description,
            'ref_type' => 'Invoice',
            'ref_id' => $invoiceId,
            'userId' => $invoice->created_by,
            'items' => $items
        ]);
    }

    /**
     * Moves needed to bring an older entry onto the current accounts:
     * tax total -> VAT/SSCL/TDL/SC accounts, discounts -> Sales Discounts,
     * returns -> Sales Returns, stock gains/losses -> Stock Adjustments.
     * Returns [[from_id, to_id, signed amount (debit +)], ...].
     */
    public static function reclassMoves($entryId) {
        $db = new Database();
        $db->query("SELECT * FROM acc_journal_entries WHERE id = :id");
        $db->bind(':id', (int)$entryId);
        $e = $db->single();
        if (!$e || strpos((string)$e->description, 'REVERSAL:') === 0) return [];
        $db->query("SELECT account_id, debit, credit, notes FROM acc_journal_items WHERE entry_id = :id");
        $db->bind(':id', (int)$entryId);
        $lines = $db->resultSet() ?: [];

        $taxAcc = self::getMappedId('invoice_tax');
        $oldOpex = null;
        $db->query("SELECT id FROM acc_accounts WHERE code = '5100'");
        if ($r = $db->single()) $oldOpex = (int)$r->id;
        $revAcc = self::getMappedId('invoice_revenue');
        $moves = [];

        if ($e->ref_type === 'Invoice') {
            $taxCredit = 0;
            foreach ($lines as $l) if ((int)$l->account_id === $taxAcc) $taxCredit += (float)$l->credit - (float)$l->debit;
            if ($taxCredit > 0.005) {
                foreach (self::taxSplit((int)$e->ref_id, $taxCredit, $taxAcc) as $acc => $t) {
                    if ((int)$acc !== $taxAcc) $moves[] = [$taxAcc, (int)$acc, -$t['amount']];
                }
            }
            $disc = self::getMappedId('sales_discount');
            foreach ($lines as $l) {
                if ($oldOpex && $disc && $disc !== $oldOpex && (int)$l->account_id === $oldOpex && $l->notes === 'Discount allowed') {
                    $moves[] = [$oldOpex, $disc, (float)$l->debit - (float)$l->credit];
                }
            }
        } elseif ($e->ref_type === 'SalesReturn') {
            $ret = self::getMappedId('sales_return');
            foreach ($lines as $l) {
                if ($ret && $ret !== $revAcc && (int)$l->account_id === $revAcc && $l->notes === 'Sales Return') {
                    $moves[] = [$revAcc, $ret, (float)$l->debit - (float)$l->credit];
                }
            }
        } elseif (in_array($e->ref_type, ['StockMovement', 'Adjustment'], true)) {
            $adj = self::getMappedId('inventory_adjustment');
            foreach ($lines as $l) {
                if ($oldOpex && $adj && $adj !== $oldOpex && (int)$l->account_id === $oldOpex) {
                    $moves[] = [$oldOpex, $adj, (float)$l->debit - (float)$l->credit];
                }
            }
        }
        return array_values(array_filter($moves, fn($m) => abs($m[2]) >= 0.01));
    }

    /** Post one reclassification entry for an older journal entry (once). */
    public static function postReclass($entryId) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        if (self::hasEntry('Reclass', $entryId)) return true;
        // A reversed entry is already cancelled out; moving its lines would leave them unbalanced per account.
        $chk = new Database();
        $chk->query("SELECT 1 FROM acc_journal_items WHERE notes = :n LIMIT 1");
        $chk->bind(':n', 'Reversal of entry #' . (int)$entryId);
        if ($chk->single()) return true;
        $moves = self::reclassMoves($entryId);
        if (!$moves) return true;
        $db = new Database();
        $db->query("SELECT entry_date, description FROM acc_journal_entries WHERE id = :id");
        $db->bind(':id', (int)$entryId);
        $e = $db->single();
        $items = [];
        foreach ($moves as [$from, $to, $v]) {
            $note = "Reclass from entry #$entryId";
            $items[] = ['account_id' => $to, 'debit' => $v > 0 ? $v : 0, 'credit' => $v < 0 ? -$v : 0, 'notes' => $note];
            $items[] = ['account_id' => $from, 'debit' => $v < 0 ? -$v : 0, 'credit' => $v > 0 ? $v : 0, 'notes' => $note];
        }
        return (new Journal())->post([
            'entry_date' => $e->entry_date, 'description' => 'Reclass: ' . $e->description,
            'ref_type' => 'Reclass', 'ref_id' => (int)$entryId, 'userId' => null, 'items' => $items,
        ]);
    }

    /** Tax code of an invoice tax line (lines may hold the code or the tax's full name). */
    public static function taxCode($codeOrName) {
        $v = trim((string)$codeOrName);
        if ($v === '') return '';
        $db = new Database();
        $db->query("SELECT code FROM taxes WHERE code = :v OR name = :v2 LIMIT 1");
        $db->bind(':v', $v); $db->bind(':v2', $v);
        $r = $db->single();
        return strtoupper($r ? (string)$r->code : $v);
    }

    /**
     * Split an invoice's tax total by account: [account_id => ['amount', 'label']].
     * Each tax code uses mapping tax_<CODE> (tax_VAT, tax_SSCL, tax_TDL, tax_SC); anything
     * unmapped, and any rounding remainder, goes to the general invoice tax account.
     */
    public static function taxSplit($invoiceId, $taxTotal, $fallbackId) {
        $db = new Database();
        $db->query("SELECT tax_code, tax_name, amount FROM invoice_taxes WHERE invoice_id = :id");
        $db->bind(':id', (int)$invoiceId);
        $out = [];
        $sum = 0.0;
        foreach ($db->resultSet() ?: [] as $t) {
            $amt = round((float)$t->amount, 2);
            if (abs($amt) < 0.005) continue;
            $code = self::taxCode($t->tax_code ?: $t->tax_name);
            $acc = self::getMappedId('tax_' . $code) ?: $fallbackId;
            if (!isset($out[$acc])) $out[$acc] = ['amount' => 0, 'label' => $code === 'SC' ? 'Service charge' : $code];
            elseif ($out[$acc]['label'] !== $code) $out[$acc]['label'] = 'Tax';
            $out[$acc]['amount'] += $amt;
            $sum += $amt;
        }
        $rest = round($taxTotal - $sum, 2);
        if (abs($rest) >= 0.01) {
            if (!isset($out[$fallbackId])) $out[$fallbackId] = ['amount' => 0, 'label' => 'Tax'];
            $out[$fallbackId]['amount'] += $rest;
        }
        foreach ($out as $k => $v) { $out[$k]['amount'] = round($v['amount'], 2); if (abs($out[$k]['amount']) < 0.01) unset($out[$k]); }
        return $out;
    }

    /** Account money comes in to / goes out from, by payment method. */
    public static function fundsAccount($method) {
        $m = strtolower(trim((string)$method));
        if ($m === 'cash') return self::getMappedId('payment_cash');
        if ($m === 'card') return self::getMappedId('payment_card') ?: self::getMappedId('payment_bank');
        if ($m === 'cheque') return self::getMappedId('payment_cheque') ?: self::getMappedId('payment_bank');
        return self::getMappedId('payment_bank');
    }

    /** Net cost of stock that left inventory for an invoice, or null when nothing moved. */
    public static function invoiceStockCost($invoiceId) {
        $db = new Database();
        $db->query("SELECT COUNT(*) AS n, COALESCE(SUM(qty_change * COALESCE(unit_cost, 0)), 0) AS v
                    FROM stock_movements
                    WHERE ref_table = 'invoices' AND ref_id = :id AND movement_type <> 'SALE_CANCEL'");
        $db->bind(':id', (int)$invoiceId);
        $r = $db->single();
        if (!$r || (int)$r->n === 0) return null;
        return round(-(float)$r->v, 2);
    }

    /** Cash refund to a customer: Dr Receivable (clears the return credit), Cr Cash/Bank. */
    public static function postRefund($refundId) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        $db = new Database();
        $db->query("SELECT r.*, i.customer_id, i.invoice_no FROM refunds r LEFT JOIN invoices i ON i.id = r.invoice_id WHERE r.id = :id");
        $db->bind(':id', (int)$refundId);
        $r = $db->single();
        if (!$r || (float)$r->amount <= 0) return false;
        if (self::hasEntry('Refund', $refundId)) return true;

        $arId = self::getMappedId('invoice_ar');
        $outId = self::fundsAccount($r->payment_method);
        if (!$arId || !$outId) return false;

        $amt = (float)$r->amount;
        return (new Journal())->post([
            'entry_date' => $r->refund_date ?: date('Y-m-d'),
            'description' => "Refund {$r->refund_no}" . ($r->invoice_no ? " for #{$r->invoice_no}" : ''),
            'ref_type' => 'Refund', 'ref_id' => (int)$refundId, 'userId' => $r->created_by,
            'items' => [
                ['account_id' => $arId, 'debit' => $amt, 'credit' => 0, 'partner_type' => 'Customer', 'partner_id' => $r->customer_id, 'notes' => 'Refund paid'],
                ['account_id' => $outId, 'debit' => 0, 'credit' => $amt, 'notes' => 'Refund paid out'],
            ],
        ]);
    }

    /**
     * Stock changes made outside a document (manual adjust, item import opening stock).
     * Opening stock: Dr Inventory / Cr Opening Balance Equity. Manual: Inventory vs Stock Adjustment.
     */
    public static function postStockMovement($movementId) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        $db = new Database();
        $db->query("SELECT sm.*, p.part_name, p.cost_price FROM stock_movements sm LEFT JOIN parts p ON p.id = sm.part_id WHERE sm.id = :id");
        $db->bind(':id', (int)$movementId);
        $m = $db->single();
        if (!$m) return false;
        if (self::hasEntry('StockMovement', $movementId)) return true;

        $cost = (float)($m->unit_cost ?: $m->cost_price ?: 0);
        $value = round((float)$m->qty_change * $cost, 2);
        if (abs($value) < 0.01) return true; // nothing to book

        $invId = self::getMappedId('grn_inventory');
        $isOpening = ($m->ref_table === 'import');
        $otherId = $isOpening ? self::getMappedId('opening_balance_equity') : self::getMappedId('inventory_adjustment');
        if (!$invId || !$otherId) return false;

        $abs = abs($value);
        $gain = $value > 0;
        $label = $isOpening ? 'Opening stock' : ($gain ? 'Stock gain' : 'Stock loss');
        return (new Journal())->post([
            'entry_date' => substr((string)$m->created_at, 0, 10) ?: date('Y-m-d'),
            'description' => "$label: " . ($m->part_name ?: "item #{$m->part_id}") . " (" . (float)$m->qty_change . ")",
            'ref_type' => 'StockMovement', 'ref_id' => (int)$movementId, 'userId' => $m->created_by,
            'items' => [
                ['account_id' => $gain ? $invId : $otherId, 'debit' => $abs, 'credit' => 0, 'notes' => $label],
                ['account_id' => $gain ? $otherId : $invId, 'debit' => 0, 'credit' => $abs, 'notes' => $label],
            ],
        ]);
    }

    /**
     * Cheque life cycle after the receipt (which booked Dr Cheques in Hand / Cr Receivable):
     *   Cleared  -> Dr Bank / Cr Cheques in Hand
     *   Bounced  -> Dr Receivable / Cr wherever the money sits now (bank if it had cleared)
     * Older receipts that went straight to Bank need no clearing entry.
     */
    public static function postChequeStatus($chequeId, $status, $date = null) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        $db = new Database();
        $db->query("SELECT ci.*, pr.customer_id, pr.invoice_no, pr.receipt_no FROM cheque_inventory ci JOIN payment_receipts pr ON pr.id = ci.receipt_id WHERE ci.id = :id");
        $db->bind(':id', (int)$chequeId);
        $c = $db->single();
        if (!$c) return false;
        $arId = self::getMappedId('invoice_ar');
        $bankId = self::getMappedId('payment_bank');

        // Where the receipt put the cheque
        $db->query("SELECT ji.account_id FROM acc_journal_entries je JOIN acc_journal_items ji ON ji.entry_id = je.id
                    WHERE je.ref_type = 'PaymentReceipt' AND je.ref_id = :r AND ji.debit > 0 AND je.description NOT LIKE 'REVERSAL:%' LIMIT 1");
        $db->bind(':r', (int)$c->receipt_id);
        $h = $db->single();
        if (!$h || !$arId || !$bankId) return false;
        $holding = (int)$h->account_id;
        $amt = (float)$c->amount;
        $day = $date ?: date('Y-m-d');
        $label = "cheque #{$c->cheque_no_last6} ({$c->receipt_no})";

        if ($status === 'Cleared') {
            if ($holding === $bankId || self::hasEntry('ChequeClear', $chequeId)) return true;
            return (bool)(new Journal())->post([
                'entry_date' => $day, 'description' => "Cleared $label", 'ref_type' => 'ChequeClear', 'ref_id' => (int)$chequeId,
                'location_id' => null, 'userId' => null,
                'items' => [
                    ['account_id' => $bankId, 'debit' => $amt, 'credit' => 0, 'notes' => 'Cheque deposited'],
                    ['account_id' => $holding, 'debit' => 0, 'credit' => $amt, 'notes' => 'Cheque cleared'],
                ],
            ]);
        }
        if ($status === 'Bounced') {
            if (self::hasEntry('ChequeBounce', $chequeId)) return true;
            $from = self::hasEntry('ChequeClear', $chequeId) ? $bankId : $holding;
            return (bool)(new Journal())->post([
                'entry_date' => $day, 'description' => "Bounced $label", 'ref_type' => 'ChequeBounce', 'ref_id' => (int)$chequeId,
                'userId' => null,
                'items' => [
                    ['account_id' => $arId, 'debit' => $amt, 'credit' => 0, 'partner_type' => 'Customer', 'partner_id' => $c->customer_id, 'notes' => 'Cheque returned unpaid'],
                    ['account_id' => $from, 'debit' => 0, 'credit' => $amt, 'notes' => 'Cheque bounced'],
                ],
            ]);
        }
        return true;
    }

    /**
     * Card settlement from the bank: Dr Bank (net) + Dr Card Commission / Cr Card Clearing (gross).
     */
    public static function postCardSettlement($data) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        $gross = round((float)($data['gross'] ?? 0), 2);
        $fee = round((float)($data['commission'] ?? 0), 2);
        if ($gross <= 0 || $fee < 0 || $fee >= $gross) return false;
        $clearing = self::getMappedId('payment_card');
        $bank = !empty($data['bank_account_id']) ? (int)$data['bank_account_id'] : self::getMappedId('payment_bank');
        $db = new Database();
        $db->query("SELECT id FROM acc_accounts WHERE code = '5710'");
        $feeAcc = ($r = $db->single()) ? (int)$r->id : null;
        if (!$clearing || !$bank || ($fee > 0 && !$feeAcc)) return false;
        $items = [['account_id' => $bank, 'debit' => round($gross - $fee, 2), 'credit' => 0, 'notes' => 'Card settlement received']];
        if ($fee > 0) $items[] = ['account_id' => $feeAcc, 'debit' => $fee, 'credit' => 0, 'notes' => 'Card commission'];
        $items[] = ['account_id' => $clearing, 'debit' => 0, 'credit' => $gross, 'notes' => 'Card sales settled'];
        return (new Journal())->post([
            'entry_date' => $data['date'] ?? date('Y-m-d'),
            'description' => 'Card settlement' . (!empty($data['reference']) ? ' ' . $data['reference'] : ''),
            'ref_type' => 'CardSettlement', 'ref_id' => null,
            'location_id' => !empty($data['location_id']) ? (int)$data['location_id'] : null,
            'userId' => $data['userId'] ?? null, 'items' => $items,
        ]);
    }

    private static function accountByCode($code) {
        $db = new Database();
        $db->query("SELECT id FROM acc_accounts WHERE code = :c AND COALESCE(is_group,0) = 0");
        $db->bind(':c', $code);
        return ($r = $db->single()) ? (int)$r->id : null;
    }

    /**
     * Payroll approved -> accrue the month's cost:
     *   Dr Salaries & Wages (basic + allowances; penalty deductions reduce it)
     *   Dr EPF employer (12% of basic) / Dr ETF (3% of basic)
     *   Cr Salaries Payable (net pay), Cr EPF Payable (employee EPF line + employer 12%),
     *   Cr ETF Payable (3%), Cr Other Receivables for advance / loan recoveries.
     * Rates come from HR settings PAYROLL_EPF_EMPLOYER_RATE / PAYROLL_ETF_RATE (default 12 / 3).
     */
    public static function postPayrollAccrual($payrollId) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        if (self::hasEntry('PayrollAccrual', $payrollId)) return true;
        $db = new Database();
        $db->query("SELECT p.*, CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS emp_name FROM payroll p LEFT JOIN employees e ON e.id = p.employee_id WHERE p.id = :id");
        $db->bind(':id', (int)$payrollId);
        try { $p = $db->single(); } catch (Exception $e) {
            $db->query("SELECT p.* FROM payroll p WHERE p.id = :id");
            $db->bind(':id', (int)$payrollId);
            $p = $db->single();
        }
        if (!$p) return false;

        $rate = function ($key, $def) use ($db) {
            try {
                $db->query("SELECT setting_value FROM hr_settings WHERE setting_key = :k");
                $db->bind(':k', $key);
                $r = $db->single();
                return $r && is_numeric($r->setting_value) ? (float)$r->setting_value : $def;
            } catch (Exception $e) { return $def; }
        };
        $erEpf = round((float)$p->basic_salary * $rate('PAYROLL_EPF_EMPLOYER_RATE', 12) / 100, 2);
        $etf = round((float)$p->basic_salary * $rate('PAYROLL_ETF_RATE', 3) / 100, 2);

        $wages = self::accountByCode('5200'); $epfExp = self::accountByCode('5210'); $etfExp = self::accountByCode('5220');
        $payable = self::accountByCode('2300'); $epfPay = self::accountByCode('2310'); $etfPay = self::accountByCode('2320');
        $advances = self::accountByCode('1210');
        if (!$wages || !$payable || !$epfPay || !$etfPay || !$epfExp || !$etfExp) return false;

        $gross = round((float)$p->basic_salary + (float)$p->allowances, 2);
        $epfEmployee = 0.0; $recover = 0.0; $penalties = 0.0;
        foreach (json_decode((string)$p->breakdown, true) ?: [] as $b) {
            if (($b['type'] ?? '') !== 'Deduction') continue;
            $amt = (float)($b['amount'] ?? 0);
            $n = strtolower((string)($b['name'] ?? ''));
            if (str_contains($n, 'epf')) $epfEmployee += $amt;
            elseif (str_contains($n, 'advance') || str_contains($n, 'loan')) $recover += $amt;
            else $penalties += $amt; // lateness / absence: pay not earned
        }
        $net = round((float)$p->net_salary, 2);
        $who = ($p->emp_name ?? null) ?: "employee #{$p->employee_id}";
        $period = sprintf('%04d-%02d', $p->year, $p->month);

        $items = [
            ['account_id' => $wages, 'debit' => round($gross - $penalties, 2), 'credit' => 0, 'notes' => "Salary $period"],
            ['account_id' => $epfExp, 'debit' => $erEpf, 'credit' => 0, 'notes' => 'EPF employer contribution'],
            ['account_id' => $etfExp, 'debit' => $etf, 'credit' => 0, 'notes' => 'ETF contribution'],
            ['account_id' => $payable, 'debit' => 0, 'credit' => $net, 'partner_type' => 'Employee', 'partner_id' => $p->employee_id, 'notes' => 'Net pay due'],
            ['account_id' => $epfPay, 'debit' => 0, 'credit' => round($epfEmployee + $erEpf, 2), 'notes' => 'EPF due (employee + employer)'],
            ['account_id' => $etfPay, 'debit' => 0, 'credit' => $etf, 'notes' => 'ETF due'],
        ];
        if ($recover > 0 && $advances) $items[] = ['account_id' => $advances, 'debit' => 0, 'credit' => round($recover, 2), 'partner_type' => 'Employee', 'partner_id' => $p->employee_id, 'notes' => 'Advance / loan recovered'];
        elseif ($recover > 0) $items[0]['debit'] = round($items[0]['debit'] - $recover, 2);

        return (new Journal())->post([
            'entry_date' => date('Y-m-t', strtotime("$period-01")),
            'description' => "Payroll $period – $who", 'ref_type' => 'PayrollAccrual', 'ref_id' => (int)$payrollId,
            'userId' => $p->created_by, 'items' => $items,
        ]);
    }

    /** Payroll paid -> Dr Salaries Payable / Cr Bank. */
    public static function postPayrollPayment($payrollId) {
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        if (self::hasEntry('PayrollPayment', $payrollId)) return true;
        if (!self::hasEntry('PayrollAccrual', $payrollId) && !self::postPayrollAccrual($payrollId)) return false;
        $db = new Database();
        $db->query("SELECT * FROM payroll WHERE id = :id");
        $db->bind(':id', (int)$payrollId);
        $p = $db->single();
        $payable = self::accountByCode('2300');
        $bank = self::getMappedId('payment_bank');
        if (!$p || !$payable || !$bank) return false;
        $net = round((float)$p->net_salary, 2);
        return (new Journal())->post([
            'entry_date' => $p->paid_at ? substr($p->paid_at, 0, 10) : date('Y-m-d'),
            'description' => sprintf('Salary paid %04d-%02d (employee #%d)', $p->year, $p->month, $p->employee_id),
            'ref_type' => 'PayrollPayment', 'ref_id' => (int)$payrollId, 'userId' => null,
            'items' => [
                ['account_id' => $payable, 'debit' => $net, 'credit' => 0, 'partner_type' => 'Employee', 'partner_id' => $p->employee_id, 'notes' => 'Salary paid'],
                ['account_id' => $bank, 'debit' => 0, 'credit' => $net, 'notes' => 'Salary paid'],
            ],
        ]);
    }

    public static function hasEntry($refType, $refId) {
        $db = new Database();
        // a live (not reversed) entry; reversed ones may be posted again
        $db->query("SELECT e.id FROM acc_journal_entries e WHERE e.ref_type = :t AND e.ref_id = :i AND e.description NOT LIKE 'REVERSAL:%'
                    AND NOT EXISTS (SELECT 1 FROM acc_journal_items r WHERE r.notes = CONCAT('Reversal of entry #', e.id)) LIMIT 1");
        $db->bind(':t', $refType); $db->bind(':i', (int)$refId);
        return (bool)$db->single();
    }

    public static function postPayment($invoiceId, $paymentData) {
        $invoiceModel = new Invoice();
        $journalModel = new Journal();
        $invoice = $invoiceModel->getById($invoiceId);
        if (!$invoice) return false;

        $arId = self::getMappedId('invoice_ar');
        $cashId = self::getMappedId('payment_cash');
        $bankId = self::getMappedId('payment_bank');
        $destId = self::fundsAccount($paymentData['payment_method'] ?? 'Cash');

        if (!$arId || !$destId) return false;

        $items = [
            ['account_id' => $destId, 'debit' => $paymentData['amount'], 'credit' => 0, 'notes' => "Payment for #{$invoice->invoice_no}"],
            ['account_id' => $arId, 'debit' => 0, 'credit' => $paymentData['amount'], 'partner_type' => 'Customer', 'partner_id' => $invoice->customer_id, 'notes' => "Payment received"]
        ];

        return $journalModel->post([
            'entry_date' => $paymentData['payment_date'] ?? date('Y-m-d'),
            'description' => "Payment for Invoice #{$invoice->invoice_no}",
            // Booked against the receipt when known, so cancelling one receipt reverses exactly its entry
            'ref_type' => !empty($paymentData['receipt_id']) ? 'PaymentReceipt' : 'Payment',
            'ref_id' => !empty($paymentData['receipt_id']) ? (int)$paymentData['receipt_id'] : $invoiceId,
            'userId' => $paymentData['userId'], 'items' => $items
        ]);
    }

    public static function postGRN($grnId) {
        require_once '../app/models/GoodsReceiveNote.php';
        $grnModel = new GoodsReceiveNote();
        $journalModel = new Journal();
        $data = $grnModel->getById($grnId);
        if (!$data) return false;
        $grn = $data->grn;

        $invId = self::getMappedId('grn_inventory');
        $apId = self::getMappedId('grn_ap');
        $taxId = self::getMappedId('purchase_tax');

        if (!$invId || !$apId) return false;

        $items = [];
        $description = "GRN Receipt #{$grn->grn_number}";

        // DEBIT: Inventory (Net)
        $items[] = [
            'account_id' => $invId,
            'debit' => (float)($grn->subtotal ?? 0),
            'credit' => 0,
            'notes' => $description
        ];

        // DEBIT: Input Tax
        if ((float)($grn->tax_total ?? 0) > 0 && $taxId) {
            $items[] = [
                'account_id' => $taxId,
                'debit' => (float)$grn->tax_total,
                'credit' => 0,
                'notes' => 'Input Tax on ' . $description
            ];
        }

        // CREDIT: Accounts Payable
        $items[] = [
            'account_id' => $apId,
            'debit' => 0,
            'credit' => (float)($grn->subtotal ?? 0) + (float)($grn->tax_total ?? 0),
            'partner_type' => 'Supplier',
            'partner_id' => $grn->supplier_id,
            'notes' => $description
        ];

        return $journalModel->post([
            'entry_date' => $grn->received_at,
            'description' => $description,
            'ref_type' => 'GRN', 'ref_id' => $grnId, 'userId' => $grn->created_by, 'items' => $items
        ]);
    }

    public static function postStockAdjustment($adjId) {
        require_once '../app/models/StockAdjustment.php';
        $adjModel = new StockAdjustment();
        $journalModel = new Journal();
        $data = $adjModel->getById($adjId);
        if (!$data) return false;
        $adj = $data->adjustment;
        $lines = $data->items;

        $invId = self::getMappedId('grn_inventory');
        $adjExpId = self::getMappedId('inventory_adjustment');

        if (!$invId || !$adjExpId) return false;

        $totalValueChange = 0;
        foreach ($lines as $line) {
            // Standard approach: value variance at current cost
            $cost = (float)($line->unit_cost ?? 0);
            $totalValueChange += ($line->qty_change * $cost);
        }

        if (abs($totalValueChange) < 0.01) return true;

        $items = [];
        if ($totalValueChange > 0) {
            // STOCK GAIN
            $items[] = ['account_id' => $invId, 'debit' => $totalValueChange, 'credit' => 0, 'notes' => 'Inventory Gain'];
            $items[] = ['account_id' => $adjExpId, 'debit' => 0, 'credit' => $totalValueChange, 'notes' => 'Stock variance entry'];
        } else {
            // STOCK LOSS
            $items[] = ['account_id' => $adjExpId, 'debit' => abs($totalValueChange), 'credit' => 0, 'notes' => 'Inventory Loss'];
            $items[] = ['account_id' => $invId, 'debit' => 0, 'credit' => abs($totalValueChange), 'notes' => 'Stock variance entry'];
        }

        return $journalModel->post([
            'entry_date' => $adj->adjusted_at,
            'description' => "Stock Adjustment #{$adj->adjustment_number}",
            'ref_type' => 'Adjustment', 'ref_id' => $adjId, 'userId' => $adj->created_by, 'items' => $items
        ]);
    }

    public static function postSalesReturn($returnId, $data) {
        $journalModel = new Journal();
        $retId = self::getMappedId('sales_return');
        $arId = self::getMappedId('invoice_ar');
        if (!$retId || !$arId) return false;

        $items = [
            ['account_id' => $retId, 'debit' => $data['total_amount'], 'credit' => 0, 'notes' => 'Sales Return'],
            ['account_id' => $arId, 'debit' => 0, 'credit' => $data['total_amount'], 'partner_type' => 'Customer', 'partner_id' => $data['customer_id'] ?? null, 'notes' => 'Return credit']
        ];

        // Goods back on the shelf: Dr Inventory / Cr COGS at the cost they left at
        $db = new Database();
        $db->query("SELECT COALESCE(SUM(qty_change * COALESCE(unit_cost, 0)), 0) AS v FROM stock_movements WHERE ref_table = 'sales_returns' AND ref_id = :id");
        $db->bind(':id', (int)$returnId);
        $back = round((float)($db->single()->v ?? 0), 2);
        $invId = self::getMappedId('grn_inventory');
        $cogsId = self::getMappedId('cogs_account');
        if ($back > 0 && $invId && $cogsId) {
            $items[] = ['account_id' => $invId, 'debit' => $back, 'credit' => 0, 'notes' => 'Returned stock'];
            $items[] = ['account_id' => $cogsId, 'debit' => 0, 'credit' => $back, 'notes' => 'COGS reversed on return'];
        }

        return $journalModel->post([
            'entry_date' => $data['return_date'] ?? date('Y-m-d'),
            'description' => "Sales Return #{$returnId}",
            'ref_type' => 'SalesReturn', 'ref_id' => $returnId, 'userId' => $data['userId'], 'items' => $items
        ]);
    }

    public static function postSupplierPayment($paymentId, $data) {
        $journalModel = new Journal();
        $apId = self::getMappedId('grn_ap');
        $cashId = self::getMappedId('payment_cash');
        $bankId = self::getMappedId('payment_bank');
        $payAccId = ($data['payment_method'] === 'Cash') ? $cashId : $bankId;

        if (!$apId || !$payAccId) return false;

        $items = [
            ['account_id' => $apId, 'debit' => $data['amount'], 'credit' => 0, 'partner_type' => 'Supplier', 'partner_id' => $data['supplier_id'], 'notes' => 'Payment out'],
            ['account_id' => $payAccId, 'debit' => 0, 'credit' => $data['amount'], 'notes' => 'Fund reduction']
        ];

        return $journalModel->post([
            'entry_date' => $data['payment_date'] ?? date('Y-m-d'),
            'description' => "Supplier Payment #{$paymentId}",
            'ref_type' => 'SupplierPayment', 'ref_id' => $paymentId, 'userId' => $data['userId'], 'items' => $items
        ]);
    }

    public static function postPurchaseReturn($returnId, $data) {
        $journalModel = new Journal();
        $apId = self::getMappedId('grn_ap');
        $purRetId = self::getMappedId('purchase_return');
        $taxId = self::getMappedId('purchase_tax');

        if (!$apId || !$purRetId) return false;

        $total = (float)($data['total_amount'] ?? 0);
        $taxTotal = (float)($data['tax_total'] ?? 0);
        $subtotal = (float)($data['subtotal'] ?? ($total - $taxTotal));

        $items = [];
        // DEBIT: Accounts Payable (Full amount)
        $items[] = [
            'account_id' => $apId, 
            'debit' => $total, 
            'credit' => 0, 
            'partner_type' => 'Supplier', 
            'partner_id' => $data['supplier_id'], 
            'notes' => 'Purchase Return'
        ];

        // CREDIT: Purchase Return / Inventory (Net)
        $items[] = [
            'account_id' => $purRetId, 
            'debit' => 0, 
            'credit' => $subtotal, 
            'notes' => 'Inventory reduction (Net)'
        ];

        // CREDIT: Input Tax (Reversal)
        if ($taxTotal > 0 && $taxId) {
            $items[] = [
                'account_id' => $taxId, 
                'debit' => 0, 
                'credit' => $taxTotal, 
                'notes' => 'Tax reversal on return'
            ];
        }

        return $journalModel->post([
            'entry_date' => $data['return_date'] ?? date('Y-m-d'),
            'description' => "Purchase Return #{$returnId}",
            'ref_type' => 'PurchaseReturn', 'ref_id' => $returnId, 'userId' => $data['userId'], 'items' => $items
        ]);
    }

    public static function postIssueNote($issueNoteId) {
        require_once '../app/models/IssueNote.php';
        $isnModel = new IssueNote();
        $journalModel = new Journal();
        $data = $isnModel->getById($issueNoteId);
        if (!$data || !$data->issue_note) return false;
        $isn = $data->issue_note;
        $lines = $data->items;

        $expId = self::getMappedId('issue_note_expense');
        $invId = self::getMappedId('issue_note_inventory');

        if (!$expId || !$invId) return false;

        $totalCost = 0;
        foreach ($lines as $line) {
            $totalCost += (float)$line->line_total;
        }

        if ($totalCost <= 0) return true;

        $ccName = $isn->cost_center_name ?? ("Location ID: " . $isn->cost_center_id);
        $description = "Issue Note #{$isn->issue_number} to {$ccName}";
        $items = [
            [
                'account_id' => $expId,
                'debit' => $totalCost,
                'credit' => 0,
                'notes' => $description
            ],
            [
                'account_id' => $invId,
                'debit' => 0,
                'credit' => $totalCost,
                'notes' => 'Inventory reduction'
            ]
        ];

        return $journalModel->post([
            'entry_date' => $isn->issued_at ?? date('Y-m-d H:i:s'),
            'description' => $description,
            'ref_type' => 'IssueNote',
            'ref_id' => $issueNoteId,
            'userId' => $isn->created_by,
            'items' => $items
        ]);
    }

    public static function postExpenseVoucher($expenseId, $data) {
        require_once '../app/models/Journal.php';
        require_once '../app/models/Account.php';
        $journalModel = new Journal();
        
        $items = [
            [
                'account_id' => $data['expense_account_id'],
                'debit' => $data['amount'],
                'credit' => 0,
                'notes' => ($data['payee_name'] ?? '') . ' - ' . ($data['notes'] ?? 'Expense payment')
            ],
            [
                'account_id' => $data['payment_account_id'],
                'debit' => 0,
                'credit' => $data['amount'],
                'notes' => 'Voucher payment'
            ]
        ];

        return $journalModel->post([
            'entry_date' => $data['payment_date'] ?? date('Y-m-d'),
            'description' => "Expense Voucher #{$expenseId}",
            'ref_type' => 'Expense',
            'ref_id' => $expenseId,
            'userId' => $data['userId'],
            'items' => $items
        ]);
    }
}
