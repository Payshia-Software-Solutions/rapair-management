<?php
class MarketingController extends Controller {

    public function __construct() {
        require_once __DIR__ . '/../helpers/SmsHelper.php';
        require_once __DIR__ . '/../models/Customer.php';
    }

    /**
     * POST /api/marketing/send-sms
     * Send single SMS to a customer
     */
    public function send_sms() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $recipient = $data['phone'] ?? null;
        $message = $data['message'] ?? null;
        $customerId = $data['customer_id'] ?? null;

        if (!$recipient || !$message) {
            $this->json(['status' => 'error', 'message' => 'Phone and message required.'], 422);
            return;
        }

        $res = SmsHelper::send($recipient, $message);

        // Log it
        $db = new Database();
        $db->query("INSERT INTO sms_logs (customer_id, recipient, message, status, error_message) VALUES (:cid, :rec, :msg, :status, :err)");
        $db->bind(':cid', $customerId);
        $db->bind(':rec', $recipient);
        $db->bind(':msg', $message);
        $db->bind(':status', $res['status'] === 'success' ? 'Success' : 'Failed');
        $db->bind(':err', $res['message'] ?? null);
        $db->execute();

        $this->json($res);
    }

    /**
     * POST /api/marketing/bulk-sms
     * Create and send a bulk SMS campaign
     */
    public function bulk_sms($data = null) {
        if (!$data) {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
        }
        
        $name = $data['name'] ?? 'Bulk Campaign ' . date('Y-m-d H:i');
        $message = $data['message'] ?? null;
        $segment = $data['segment'] ?? 'all'; // all, loyalty, high-spender, inactive

        if (!$message) {
            $this->json(['status' => 'error', 'message' => 'Message is required.'], 422);
            return;
        }

        // 1. Create Campaign
        $db = new Database();
        $db->query("INSERT INTO sms_campaigns (name, message, target_segment, status, sent_at) VALUES (:name, :msg, :seg, 'Sent', NOW())");
        $db->bind(':name', $name);
        $db->bind(':msg', $message);
        $db->bind(':seg', $segment);
        $db->execute();
        $campaignId = $db->lastInsertId();

        // 2. Fetch Customers based on segment
        $customerModel = new Customer();
        $customers = [];
        
        if ($segment === 'all') {
            $customers = $customerModel->getAll();
        } else if ($segment === 'active') {
             $db->query("SELECT * FROM customers WHERE is_active = 1");
             $customers = $db->resultSet();
        } else if (is_numeric($segment)) {
             // Custom Segment ID
             $db->query("SELECT name, phone, email, id FROM segment_contacts WHERE segment_id = :sid");
             $db->bind(':sid', $segment);
             $customers = $db->resultSet();
        }

        $successCount = 0;
        $failCount = 0;

        foreach ($customers as $c) {
            if (empty($c->phone)) continue;
            
            // Anti-spam delay: 500ms between messages
            usleep(500000); 

            $res = SmsHelper::send($c->phone, $message);
            
            // Log it
            $db->query("INSERT INTO sms_logs (campaign_id, customer_id, recipient, message, status, error_message) VALUES (:cam, :cid, :rec, :msg, :status, :err)");
            $db->bind(':cam', $campaignId);
            $db->bind(':cid', $c->id);
            $db->bind(':rec', $c->phone);
            $db->bind(':msg', $message);
            $db->bind(':status', $res['status'] === 'success' ? 'Success' : 'Failed');
            $db->bind(':err', $res['message'] ?? null);
            $db->execute();

            if ($res['status'] === 'success') $successCount++;
            else $failCount++;
        }

        $this->json([
            'status' => 'success', 
            'message' => "Campaign sent to $successCount customers. $failCount failed.",
            'stats' => ['success' => $successCount, 'failed' => $failCount]
        ]);
    }

    /**
     * POST /api/marketing/rerun-campaign
     */
    public function rerun_campaign() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = $data['id'] ?? null;

        if (!$id) {
            $this->json(['status' => 'error', 'message' => 'Campaign ID is required.'], 422);
            return;
        }

        $db = new Database();
        $db->query("SELECT * FROM sms_campaigns WHERE id = :id");
        $db->bind(':id', $id);
        $campaign = $db->single();

        if (!$campaign) {
            $this->json(['status' => 'error', 'message' => 'Campaign not found.'], 404);
            return;
        }

        $reRunData = [
            'name' => $campaign->name . ' (Re-run)',
            'message' => $campaign->message,
            'segment' => $campaign->target_segment
        ];
        
        $this->bulk_sms($reRunData);
    }

    /**
     * GET /api/marketing/sms-logs
     */
    public function logs() {
        $db = new Database();
        $db->query("SELECT l.*, c.name as customer_name FROM sms_logs l LEFT JOIN customers c ON l.customer_id = c.id ORDER BY l.id DESC LIMIT 100");
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * GET /api/marketing/segments
     */
    public function segments() {
        $db = new Database();
        $db->query("SELECT s.*, (SELECT COUNT(*) FROM segment_contacts WHERE segment_id = s.id) as contact_count FROM customer_segments s ORDER BY s.id DESC");
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * GET /api/marketing/segment-details/:id
     */
    public function segment_details($id) {
        $db = new Database();
        
        // 1. Get Segment Info
        $db->query("SELECT * FROM customer_segments WHERE id = :id");
        $db->bind(':id', $id);
        $segment = $db->single();

        if (!$segment) {
            $this->json(['status' => 'error', 'message' => 'Segment not found.'], 404);
            return;
        }

        // 2. Get Contacts
        $db->query("SELECT * FROM segment_contacts WHERE segment_id = :id ORDER BY id DESC");
        $db->bind(':id', $id);
        $contacts = $db->resultSet();

        $this->json([
            'status' => 'success', 
            'data' => [
                'segment' => $segment,
                'contacts' => $contacts
            ]
        ]);
    }

    /**
     * POST /api/marketing/create-segment
     */
    public function create_segment() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = $data['name'] ?? null;
        $desc = $data['description'] ?? '';

        if (!$name) {
            $this->json(['status' => 'error', 'message' => 'Segment name is required.'], 422);
            return;
        }

        $db = new Database();
        $db->query("INSERT INTO customer_segments (name, description) VALUES (:name, :desc)");
        $db->bind(':name', $name);
        $db->bind(':desc', $desc);
        $db->execute();
        
        $this->json(['status' => 'success', 'id' => $db->lastInsertId()]);
    }

    /**
     * POST /api/marketing/update-segment
     */
    public function update_segment() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = $data['id'] ?? null;
        $name = $data['name'] ?? null;
        $desc = $data['description'] ?? '';

        if (!$id || !$name) {
            $this->json(['status' => 'error', 'message' => 'Segment ID and name are required.'], 422);
            return;
        }

        $db = new Database();
        $db->query("UPDATE customer_segments SET name = :name, description = :desc WHERE id = :id");
        $db->bind(':name', $name);
        $db->bind(':desc', $desc);
        $db->bind(':id', $id);
        $db->execute();

        $this->json(['status' => 'success', 'message' => 'Segment updated.']);
    }

    /**
     * POST /api/marketing/delete-segment
     */
    public function delete_segment() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = $data['id'] ?? null;

        if (!$id) {
            $this->json(['status' => 'error', 'message' => 'Segment ID is required.'], 422);
            return;
        }

        $db = new Database();
        $db->query("DELETE FROM customer_segments WHERE id = :id");
        $db->bind(':id', $id);
        $db->execute();

        $this->json(['status' => 'success', 'message' => 'Segment deleted.']);
    }

    /**
     * POST /api/marketing/import-contacts
     */
    public function import_contacts() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $segmentId = $data['segment_id'] ?? null;
        $contacts = $data['contacts'] ?? []; // Array of {name, phone, email}

        if (!$segmentId || empty($contacts)) {
            $this->json(['status' => 'error', 'message' => 'Segment ID and contacts are required.'], 422);
            return;
        }

        $db = new Database();
        $count = 0;
        foreach ($contacts as $c) {
            if (empty($c['phone'])) continue;
            $db->query("INSERT INTO segment_contacts (segment_id, name, phone, email) VALUES (:sid, :name, :phone, :email)");
            $db->bind(':sid', $segmentId);
            $db->bind(':name', $c['name'] ?? null);
            $db->bind(':phone', $c['phone']);
            $db->bind(':email', $c['email'] ?? null);
            $db->execute();
            $count++;
        }

        $this->json(['status' => 'success', 'message' => "Imported $count contacts."]);
    }

    /**
     * POST /api/marketing/update-contact
     */
    public function update_contact() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = $data['id'] ?? null;
        $name = $data['name'] ?? null;
        $phone = $data['phone'] ?? null;
        $email = $data['email'] ?? null;

        if (!$id || !$phone) {
            $this->json(['status' => 'error', 'message' => 'Contact ID and phone are required.'], 422);
            return;
        }

        $db = new Database();
        $db->query("UPDATE segment_contacts SET name = :name, phone = :phone, email = :email WHERE id = :id");
        $db->bind(':name', $name);
        $db->bind(':phone', $phone);
        $db->bind(':email', $email);
        $db->bind(':id', $id);
        $db->execute();

        $this->json(['status' => 'success', 'message' => 'Contact updated.']);
    }

    /**
     * POST /api/marketing/delete-contact
     */
    public function delete_contact() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = $data['id'] ?? null;

        if (!$id) {
            $this->json(['status' => 'error', 'message' => 'Contact ID is required.'], 422);
            return;
        }

        $db = new Database();
        $db->query("DELETE FROM segment_contacts WHERE id = :id");
        $db->bind(':id', $id);
        $db->execute();

        $this->json(['status' => 'success', 'message' => 'Contact deleted.']);
    }

    /**
     * GET /api/marketing/campaigns
     */
    public function campaigns() {
        $db = new Database();
        $db->query("SELECT * FROM sms_campaigns ORDER BY id DESC LIMIT 50");
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }
}
