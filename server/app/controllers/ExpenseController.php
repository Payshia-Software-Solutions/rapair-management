<?php
/**
 * ExpenseController
 */
class ExpenseController extends Controller {
    private $expenseModel;

    public function __construct() {
        $this->expenseModel = $this->model('Expense');
    }

    public function list() {
        $this->requirePermission('accounting.read');
        $filters = [
            'from_date' => $_GET['from_date'] ?? null,
            'to_date' => $_GET['to_date'] ?? null,
            'expense_account_id' => $_GET['expense_account_id'] ?? null
        ];

        $expenses = $this->expenseModel->getAll($filters);
        $this->json(['status' => 'success', 'data' => $expenses]);
    }

    public function create() {
        $u = $this->requirePermission('accounting.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['expense_account_id']) || empty($input['payment_account_id']) || empty($input['amount'])) {
            $this->json(['status' => 'error', 'message' => 'Missing required fields'], 400);
            return;
        }

        $input['userId'] = $u['sub'];
        $id = $this->expenseModel->create($input);
        
        if ($id) {
            $this->json(['status' => 'success', 'message' => 'Payment voucher recorded', 'id' => $id]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to record expense'], 500);
        }
    }

    public function get($id) {
        $this->requireAuth();
        $expense = $this->expenseModel->getById($id);
        if (!$expense) {
            $this->json(['status' => 'error', 'message' => 'Expense not found'], 404);
            return;
        }
        $this->json(['status' => 'success', 'data' => $expense]);
    }

    public function summary() {
        $this->requirePermission('accounting.read');
        $db = new Database();
        
        // Monthly trend
        $db->query("
            SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount) as total 
            FROM acc_expenses 
            WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month 
            ORDER BY month ASC
        ");
        $monthly = $db->resultSet();

        // Top categories
        $db->query("
            SELECT a.name as category, SUM(e.amount) as total
            FROM acc_expenses e
            JOIN acc_accounts a ON e.expense_account_id = a.id
            WHERE e.payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY category
            ORDER BY total DESC
            LIMIT 5
        ");
        $categories = $db->resultSet();

        $this->json([
            'status' => 'success',
            'data' => [
                'monthly_trend' => $monthly,
                'top_categories' => $categories
            ]
        ]);
    }

    public function printVoucher($id) {
        // No permission check for print as it's often called via window.open from an auth'd session
        // but we'll check auth anyway
        $this->requireAuth();
        
        $expense = $this->expenseModel->getById($id);
        if (!$expense) die("Voucher not found");

        $companyModel = $this->model('Company');
        $company = $companyModel->get();

        $format = $_GET['format'] ?? 'voucher';

        // Include the print helper/view
        require_once '../app/helpers/NumberHelper.php';
        $amountInWords = NumberHelper::toWords($expense->amount);

        echo "<!DOCTYPE html><html><head><title>Print {$expense->voucher_no}</title>";
        echo "<style>
            @media print { .no-print { display: none; } }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
            .company-name { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
            .voucher-title { font-size: 32px; font-weight: 900; text-transform: uppercase; color: #3b82f6; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
            .value { font-size: 16px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 5px 0; }
            .amount-box { background: #f8fafc; border: 2px solid #e2e8f0; padding: 20px; text-align: center; border-radius: 12px; }
            .amount-val { font-size: 28px; font-weight: 900; color: #0f172a; }
            .footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; }
            .sig-line { border-top: 2px solid #334155; margin-top: 40px; text-align: center; padding-top: 10px; font-weight: 900; font-size: 10px; text-transform: uppercase; }
            
            /* TT Letter specific */
            .tt-letter { max-width: 800px; margin: 0 auto; line-height: 1.8; }
            
            /* Cheque Specific (Approximate positions) */
            .cheque-leaf { width: 8.5in; height: 3.5in; position: relative; border: 1px dashed #ccc; margin: 0 auto; overflow: hidden; }
            .chq-date { position: absolute; top: 30px; right: 50px; font-family: monospace; font-size: 18px; letter-spacing: 10px; }
            .chq-payee { position: absolute; top: 110px; left: 100px; font-size: 20px; font-weight: 700; }
            .chq-words { position: absolute; top: 155px; left: 120px; font-size: 16px; width: 500px; line-height: 1.4; }
            .chq-amount { position: absolute; top: 145px; right: 60px; font-size: 22px; font-weight: 900; }
        </style></head><body onload='window.print()'>";

        if ($format === 'voucher') {
            echo "
            <div class='header'>
                <div>
                    <div class='company-name'>{$company->name}</div>
                    <div style='font-size: 12px; color: #64748b;'>{$company->address}</div>
                </div>
                <div class='voucher-title'>PAYMENT VOUCHER</div>
            </div>
            <div class='grid'>
                <div>
                    <div class='label'>Voucher No</div>
                    <div class='value' style='color:#3b82f6'>{$expense->voucher_no}</div>
                    <div class='label' style='margin-top:20px'>Payment Date</div>
                    <div class='value'>{$expense->payment_date}</div>
                    <div class='label' style='margin-top:20px'>Payee / Recipient</div>
                    <div class='value'>{$expense->payee_name}</div>
                </div>
                <div>
                    <div class='amount-box'>
                        <div class='label'>Voucher Amount (LKR)</div>
                        <div class='amount-val'>" . number_format($expense->amount, 2) . "</div>
                    </div>
                    <div class='label' style='margin-top:20px'>Payment Method</div>
                    <div class='value'>{$expense->payment_method}</div>
                </div>
            </div>
            <div class='label'>Account Attribution</div>
            <div class='value'>{$expense->expense_account_name}</div>
            
            <div style='margin-top:40px'>
                <div class='label'>Description / Notes</div>
                <div style='border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-style: italic;'>
                    {$expense->notes}
                    " . ($expense->reference_no ? "<br><strong>Ref:</strong> {$expense->reference_no}" : "") . "
                    " . ($expense->cheque_no ? "<br><strong>Cheque No:</strong> {$expense->cheque_no}" : "") . "
                    " . ($expense->tt_ref_no ? "<br><strong>TT Ref:</strong> {$expense->tt_ref_no}" : "") . "
                </div>
            </div>
            
            <div style='margin-top:30px'>
                <div class='label'>Amount in Words</div>
                <div class='value' style='font-style: italic;'>{$amountInWords} Only.</div>
            </div>

            <div class='footer'>
                <div class='sig-line'>Prepared By</div>
                <div class='sig-line'>Approved By</div>
                <div class='sig-line'>Recipient Signature</div>
            </div>";
        } elseif ($format === 'tt_letter') {
            $date = date('F d, Y');
            echo "
            <div class='tt-letter'>
                <div style='text-align: right; margin-bottom: 40px;'>$date</div>
                <div style='margin-bottom: 30px;'>
                    <strong>The Manager,</strong><br>
                    {$expense->payment_account_name}<br>
                    Colombo, Sri Lanka.
                </div>
                <div style='margin-bottom: 40px;'>
                    <h2 style='text-decoration: underline; text-transform: uppercase;'>Letter of Instruction: Telegraphic Transfer (TT)</h2>
                </div>
                <p>Dear Sir/Madam,</p>
                <p>We hereby authorize you to debit our account and effect a Telegraphic Transfer (TT) as per the following details:</p>
                <table style='width: 100%; border-collapse: collapse; margin: 30px 0;'>
                    <tr><td width='200'><strong>Beneficiary Name:</strong></td><td>{$expense->payee_name}</td></tr>
                    <tr><td><strong>Beneficiary Address:</strong></td><td>" . ($expense->payee_address ?: 'As per invoice') . "</td></tr>
                    <tr><td><strong>Amount:</strong></td><td><strong>LKR " . number_format($expense->amount, 2) . "</strong></td></tr>
                    <tr><td><strong>Reference No:</strong></td><td>" . ($expense->tt_ref_no ?: $expense->voucher_no) . "</td></tr>
                    <tr><td><strong>Purpose of Payment:</strong></td><td>{$expense->expense_account_name} - Payment Voucher {$expense->voucher_no}</td></tr>
                </table>
                <p>Please find the necessary documents attached. Kindly confirm once the transfer is executed.</p>
                <p style='margin-top: 50px;'>Thanking You,<br>Yours Faithfully,</p>
                <div style='margin-top: 80px; display: flex; gap: 50px;'>
                    <div style='border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px;'>Authorized Signatory</div>
                    <div style='border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px;'>Authorized Signatory</div>
                </div>
            </div>";
        } elseif ($format === 'cheque') {
            $chqDate = date('dmY', strtotime($expense->payment_date));
            echo "
            <div class='no-print' style='background: #fffbeb; padding: 10px; border: 1px solid #fcd34d; margin-bottom: 20px; font-size: 12px;'>
                <strong>Notice:</strong> Cheque printing layout depends on your printer alignment. Ensure 'Scale' is set to 100% in print settings.
            </div>
            <div class='cheque-leaf'>
                <div class='chq-date'>$chqDate</div>
                <div class='chq-payee'>{$expense->payee_name}</div>
                <div class='chq-words'>*** {$amountInWords} Only. ***</div>
                <div class='chq-amount'>**" . number_format($expense->amount, 2) . "**</div>
            </div>";
        }

        echo "</body></html>";
    }
    public function cancel($id = null) {
        $u = $this->requirePermission('accounting.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        if (!$id) {
            $this->json(['status' => 'error', 'message' => 'Expense ID required'], 400);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $reason = $input['reason'] ?? 'Cancelled by user';

        if ($this->expenseModel->cancel($id, $reason, $u['sub'])) {
            $this->json(['status' => 'success', 'message' => 'Expense cancelled successfully']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to cancel expense'], 500);
        }
    }
}
